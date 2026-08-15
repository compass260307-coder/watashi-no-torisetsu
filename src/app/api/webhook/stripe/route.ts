// プレミアム化 v2 Week 2 T2-7: Stripe Webhook ハンドラ
//
// POST /api/webhook/stripe
//   - Stripe からの Webhook を受信、署名検証して event 別に処理
//   - 認可: Stripe 署名 (STRIPE_WEBHOOK_SECRET) のみ。LIFF id_token は不要
//   - 対応 event:
//       checkout.session.completed   即時決済が paid のときだけ購入特典を解放
//       checkout.session.async_payment_succeeded 遅延決済の支払い確定後に購入特典を解放
//       checkout.session.async_payment_failed    遅延決済の失敗ログ + Slack アラート
//       payment_intent.payment_failed 失敗ログ + Slack アラート (DB 更新なし)
//
// Idempotency (二重 Webhook 着信耐性):
//   第 1 層: payment_history.stripe_session_id UNIQUE 制約
//            upsert ignoreDuplicates で吸収
//   第 2 層: integrated_trisetsu.payment_id UNIQUE 部分インデックス
//            existing チェック + INSERT race condition は code='23505' で吸収
//
// 設計判断 (計画書 v2 O4 / O5 反映):
//   - 内部 fetch を廃止、AI 生成は after() で同 Function 内直接呼び出し
//     (INTERNAL_API_TOKEN 不要、HTTP 往復不要)
//   - Webhook は 200 を素早く返す (Stripe のリトライ機構を発火させない)
//     after() の AI 生成は最大 100 秒程度かかるため maxDuration を引き上げ
//   - 差額購入の前提商品が全額返金された場合は、依存する上位購入も冪等に自動返金

import crypto from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe-server";
import { sendSlackAlert } from "@/lib/slack-alert";
import { sendDetailedReportEmail } from "@/lib/email";
import { classifyType } from "@/lib/diagnosis";
import { runForUser } from "@/lib/unmei/generateWorker.mjs";
import { normalizePaywallSource } from "@/lib/paywall-source";
import {
  isUndiagnosedPlaceholderUser,
  PLACEHOLDER_SCORES,
} from "@/lib/placeholder-user";
import {
  isCoreKpiPaymentSchemaPending,
  isMissingCoreKpiColumn,
} from "@/lib/core-kpis";
import {
  ensureHoshiyomiCreditsFromPurchase,
  grantHoshiyomiCreditsToTarget,
  isMissingHoshiyomiStore,
  revokeHoshiyomiCredits,
} from "@/lib/hoshiyomi/store";
import {
  validAccessPaymentRows,
  type AccessPaymentRow,
} from "@/lib/entitlements";
import {
  purchaseIncludesDestinyFeatures,
  purchaseIncludesFriendFeatures,
} from "@/lib/access-products";

function guestToken(bytes: number): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export const runtime = "nodejs";
// AI 生成 (after) で最大 100 秒程度 + 余裕
export const maxDuration = 150;

export async function POST(request: NextRequest) {
  // ===== Stripe 環境チェック =====
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  // ===== 署名検証 (raw body 必須) =====
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }
  // Next.js App Router の Request.text() は raw body をそのまま返すので
  // 署名検証に使える (middleware で body を変更していない前提)
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook/stripe] signature verify failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  // ===== event 別ハンドラ =====
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") {
          // completed は「Checkout 入力完了」であり、遅延決済ではまだ未払いの場合がある。
          // この時点では権限・購入イベント・メールを一切発行せず、
          // async_payment_succeeded が届くまで待つ。
          if (event.type === "checkout.session.completed") {
            // PayPay 等の遅延決済では completed 時点で未払いが正常。想定内なので
            // 200 で受領し(break)、後続の async_payment_succeeded を待つ。warn ログのみ残す。
            console.warn("[webhook/stripe] checkout awaiting payment (deferred)", {
              session_id: session.id,
              payment_status: session.payment_status,
            });
            break;
          }

          // async_payment_succeeded なのに paid でない状態は想定外。
          // 500 を返して Stripe に再送させ、権限の取りこぼしを防ぐ。
          throw new Error(
            `async payment succeeded but session is ${session.payment_status}: ${session.id}`,
          );
        }
        await handleCheckoutPaid(session);
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutAsyncPaymentFailed(session);
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(intent);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }
      default:
        // 未対応 event は静かにスキップ (Stripe Dashboard で多めにイベント送付している場合の保険)
        break;
    }
  } catch (err) {
    console.error("[webhook/stripe] handler error:", err);
    await sendSlackAlert("🚨 Stripe Webhook 処理失敗", {
      event_type: event.type,
      event_id: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // 500 を返すと Stripe がリトライしてくれる。Idempotency 対応済なので安全。
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------- 全課金経路共通: ログイン用 email バックフィル ----------
// マジックリンク復元 (POST /api/auth/request-magic-link) は users.email が
// 埋まっている行しか救えない。従来 email を永続化するのは create-session の
// body 入力経路のみで、perception_unlock (¥500 個別解除) や Stripe 側の email
// 入力欄経由では users.email が NULL のまま残り、機種変・キャッシュ削除で
// 課金済みユーザーが復元不能になる穴があった。全 checkout.session.completed が
// payment_kind 分岐の手前で必ず通るここで、Stripe 確定 email を 1 箇所で埋める。
//
// 冪等 & 非破壊: WHERE id = userId AND email IS NULL。
//   - 二重 Webhook 着信 → 2 回目は既設なので 0 行更新の no-op
//   - create-session が事前に入れた「ログイン用メール」を上書きしない
//     (先に入れた方が残る fill-if-empty)。両者は競合せず相補的。
//   - users.email は UNIQUE ではない (再診断で複数行が同一 email を持ち得る) ため
//     id 指定の UPDATE で UNIQUE 衝突は起きない。
// best-effort: 失敗しても throw しない (決済記録と Webhook 200 応答を止めない)。
//
// スコープ外メモ (課金本格開始前・実害小のため今回は未対応・別 PR):
//   ① 本 PR 以前に email=NULL のまま課金済みの既存行はここでは埋まらない
//      (Webhook は新規イベントのみ)。要・一度きりのバックフィル是正。
//   ② request-magic-link は同一 email 複数行のうち created_at 最新 1 行しか
//      復元先にしない。複数端末で別 user_id 課金した場合、旧行の課金が
//      取り残される。復元先マージ / 課金集約は別課題。
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v.length === 0 || v.length > 254) return null;
  // create-session / request-magic-link と同じ簡易 email 検証
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

async function persistLoginEmailIfEmpty(
  userId: string,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // 優先順: 客が Checkout で確定した値 > prefill(customer_email) > metadata 保険
  const email =
    normalizeEmail(session.customer_details?.email) ??
    normalizeEmail(session.customer_email) ??
    normalizeEmail(session.metadata?.email);
  if (!email) return;

  // best-effort: この関数は決済記録より前に呼ばれるため、DB エラーでも例外でも
  // 絶対に外へ throw しない (throw すると handleCheckoutCompleted が中断し
  // payment_history の記録が飛ぶ)。返り値 error・予期せぬ reject の両方を握りつぶす。
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ email })
      .eq("id", userId)
      .is("email", null); // 冪等 & 非破壊の肝: 空の行だけ埋める

    if (error) {
      console.error(
        "[webhook/stripe] login email backfill failed (continuing):",
        error.message,
      );
    }
  } catch (err) {
    console.error(
      "[webhook/stripe] login email backfill threw (continuing):",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function persistPurchaseLocale(
  session: Stripe.Checkout.Session,
  userId: string | null,
): Promise<void> {
  if (session.metadata?.locale !== "ko") return;
  const email =
    normalizeEmail(session.customer_details?.email) ??
    normalizeEmail(session.customer_email) ??
    normalizeEmail(session.metadata?.email);
  try {
    if (email) {
      await supabaseAdmin
        .from("users")
        .update({ preferred_locale: "ko" })
        .eq("email", email);
    }
    if (userId) {
      await supabaseAdmin
        .from("users")
        .update({ preferred_locale: "ko" })
        .eq("id", userId);
    }
  } catch (err) {
    console.error("[webhook/stripe] preferred locale update failed", err);
  }
}

async function resolveUserIdForSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const metadataUserId = typeof session.metadata?.user_id === "string" && session.metadata.user_id.length > 0 ? session.metadata.user_id : null;
  if (metadataUserId) return metadataUserId;

  const email = normalizeEmail(session.customer_details?.email) ?? normalizeEmail(session.customer_email) ?? normalizeEmail(session.metadata?.email);
  if (!email) return null;

  const { data } = await supabaseAdmin.from("users").select("id").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

// ---------- フルアクセス(全解放) 完了: email 優先で紐付け (ゲスト決済対応) ----------
// 紐付けキー: Stripe 確定 email を優先 → user_id (metadata)。片方でもあれば紐付く。
//   ① email があれば: 同 email の users を全部 plan='full' (再診断で複数行あっても全部有効)。
//   ② user_id があれば: その行も plan='full' + email backfill (空なら埋める)。
//   ③ どちらにも紐付かない完全ゲスト: email でプレースホルダー users を新規作成 (plan='full')。
//      後日ログイン→診断で本物のトリセツに UPDATE され、plan は保持される。
// 冪等: plan/full_access_at の UPDATE は何度届いても同結果。②③は ① で拾えなければ通る。
async function grantFullAccessByEmailOrId(
  session: Stripe.Checkout.Session,
  userId: string | null,
): Promise<string> {
  const email =
    normalizeEmail(session.customer_details?.email) ??
    normalizeEmail(session.customer_email) ??
    normalizeEmail(session.metadata?.email);
  const nowIso = new Date().toISOString();
  let linked = false;
  let paymentUserId = userId;

  // ① email 優先: 同 email の全 users を full に
  if (email) {
    const linkResult = await supabaseAdmin
      .from("users")
      .update({ plan: "full" })
      .eq("email", email)
      .select("id, diagnosis_completed_at, created_at");

    let linkedUsers = linkResult.data as Array<{
      id: string;
      diagnosis_completed_at: string | null;
      created_at: string;
    }> | null;
    let linkError = linkResult.error;
    if (isMissingCoreKpiColumn(linkError, "diagnosis_completed_at")) {
      const legacyResult = await supabaseAdmin
        .from("users")
        .update({ plan: "full" })
        .eq("email", email)
        .select("id, created_at");
      linkError = legacyResult.error;
      linkedUsers = legacyResult.data
        ? legacyResult.data.map((row) => ({
            ...row,
            diagnosis_completed_at: null,
          }))
        : null;
    }
    if (linkError) {
      throw new Error(`[full_access] email link failed: ${linkError.message}`);
    }
    if (linkedUsers && linkedUsers.length > 0) {
      linked = true;
      // Anonymous checkout with an already-known email has no metadata.user_id.
      // Attribute it deterministically to the most recently diagnosed row.
      const candidate = [...linkedUsers].sort((a, b) => {
        const aAt = Date.parse(
          (a.diagnosis_completed_at as string | null) ??
            (a.created_at as string),
        );
        const bAt = Date.parse(
          (b.diagnosis_completed_at as string | null) ??
            (b.created_at as string),
        );
        return bAt - aAt;
      })[0];
      paymentUserId ??= candidate.id as string;
      await supabaseAdmin
        .from("users")
        .update({ full_access_at: nowIso })
        .eq("email", email)
        .is("full_access_at", null);
    }
  }

  // ② user_id 行も full + email backfill (空なら)
  if (userId) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ plan: "full" })
      .eq("id", userId);
    if (error) {
      throw new Error(`[full_access] id link failed: ${error.message}`);
    }
    linked = true;
    await supabaseAdmin
      .from("users")
      .update({ full_access_at: nowIso })
      .eq("id", userId)
      .is("full_access_at", null);
    if (email) {
      await supabaseAdmin
        .from("users")
        .update({ email })
        .eq("id", userId)
        .is("email", null);
    }
  }

  // ③ 完全ゲスト: email でプレースホルダー users を新規作成 (ログイン→診断で本物に UPDATE)
  if (!linked) {
    if (!email) {
      // email も user_id も無い = 復元不能 (Stripe が email を収集する前提なので通常来ない)。
      throw new Error(
        `[full_access] no email and no user_id for session ${session.id}`,
      );
    }
    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        email,
        plan: "full",
        full_access_at: nowIso,
        owner_token: guestToken(16),
        invite_code: guestToken(8),
        type_id: classifyType(PLACEHOLDER_SCORES),
        scores: PLACEHOLDER_SCORES,
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      throw new Error(
        `[full_access] guest user create failed: ${error?.message ?? "no id returned"}`,
      );
    }
    paymentUserId = data.id as string;
  }

  if (!paymentUserId) {
    throw new Error(
      `[full_access] payment user could not be resolved for session ${session.id}`,
    );
  }

  console.log("[webhook/stripe] full_access granted", {
    user_id: userId ?? "(guest)",
    email: email ? "set" : "none",
    linked,
  });
  return paymentUserId;
}

// Full-access revenue source of truth. Unlike the analytics event, this record is
// required: an insert failure makes Stripe retry the webhook until the fact is saved.
async function recordFullAccessPayment(
  session: Stripe.Checkout.Session,
  userId: string,
  product: "full_access" | "premium_bundle" = "full_access",
): Promise<void> {
  if (session.amount_total === null || !session.currency) {
    throw new Error(
      `[full_access] missing amount/currency for paid session ${session.id}`,
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const paidAt = new Date().toISOString();
  const paymentKind =
    product === "premium_bundle" ? "premium_bundle" : "full_access";
  const paymentRecord = {
    user_id: userId,
    payment_kind: paymentKind,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    // Legacy column name. Values are minor units for the row's currency (JPY/KRW
    // are both zero-decimal), so currency must always be read alongside it.
    amount_jpy: session.amount_total,
    amount_refunded_minor: 0,
    currency: session.currency,
    status: "completed" as const,
    paid_at: paidAt,
    updated_at: paidAt,
    metadata: {
      product,
      upgrade_from: session.metadata?.upgrade_from ?? "none",
      destiny_access_policy:
        session.metadata?.destiny_access_policy ?? "legacy_included",
      friend_access_policy:
        session.metadata?.friend_access_policy ?? "legacy_included",
      source: normalizePaywallSource(session.metadata?.paywall_source),
      locale: session.metadata?.locale === "ko" ? "ko" : "ja",
    },
  };

  const { error } = await supabaseAdmin
    .from("payment_history")
    .upsert(paymentRecord, {
      onConflict: "stripe_session_id",
      ignoreDuplicates: true,
    });
  if (isCoreKpiPaymentSchemaPending(error)) {
    console.warn(
      "[webhook/stripe] core KPI payment schema pending; purchase event remains the temporary fallback",
      { stripe_session_id: session.id },
    );
    return;
  }
  if (error) {
    throw new Error(`[${product}] payment record failed: ${error.message}`);
  }
}

// ¥199 自己診断＋PDFの権限源。plan='full' は付けず、この completed 決済だけを
// hasSelfReportAccess() が読むため、友達診断・相性・アップグレード資格は解放されない。
async function recordSelfReportPayment(
  session: Stripe.Checkout.Session,
  userId: string,
): Promise<void> {
  if (session.amount_total === null || !session.currency) {
    throw new Error(
      `[self_report] missing amount/currency for paid session ${session.id}`,
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const paidAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("payment_history").upsert(
    {
      user_id: userId,
      payment_kind: "self_report",
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      amount_jpy: session.amount_total,
      amount_refunded_minor: 0,
      currency: session.currency,
      status: "completed",
      paid_at: paidAt,
      updated_at: paidAt,
      metadata: {
        product: "self_report",
        friend_access_policy:
          session.metadata?.friend_access_policy ?? "legacy_included",
        source: normalizePaywallSource(session.metadata?.paywall_source),
        locale: session.metadata?.locale === "ko" ? "ko" : "ja",
      },
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  // self_report はこの行自体が権限源。制約未適用などで保存できない場合は必ず
  // webhook を再試行させ、支払い済みなのにロックされた状態を確定させない。
  if (error) {
    throw new Error(`[self_report] payment record failed: ${error.message}`);
  }
}

async function recordUnmeiPayment(
  session: Stripe.Checkout.Session,
  userId: string,
  product: "unmei" | "unmei_upgrade",
): Promise<void> {
  if (session.amount_total === null || !session.currency) {
    throw new Error(`[${product}] missing amount/currency for ${session.id}`);
  }
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin.from("payment_history").upsert(
    {
      user_id: userId,
      payment_kind: product,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      amount_jpy: session.amount_total,
      amount_refunded_minor: 0,
      currency: session.currency,
      status: "completed",
      paid_at: nowIso,
      updated_at: nowIso,
      metadata: {
        product,
        locale: session.metadata?.locale === "ko" ? "ko" : "ja",
      },
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  if (error) {
    throw new Error(`[${product}] payment record failed: ${error.message}`);
  }
}

// self_report の購入先ユーザーを解決する。既存ユーザーの plan は変更しない。
// 完全ゲストは診断前プレースホルダーを plan='free' で作り、診断時に同じ行を更新する。
async function resolveSelfReportUser(
  session: Stripe.Checkout.Session,
  userId: string | null,
): Promise<string> {
  const email =
    normalizeEmail(session.customer_details?.email) ??
    normalizeEmail(session.customer_email) ??
    normalizeEmail(session.metadata?.email);

  if (userId) {
    if (email) {
      await supabaseAdmin
        .from("users")
        .update({ email })
        .eq("id", userId)
        .is("email", null);
    }
    return userId;
  }

  if (!email) {
    throw new Error(
      `[self_report] no email and no user_id for session ${session.id}`,
    );
  }

  const { data: existing, error: selectError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .order("diagnosis_completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selectError) {
    throw new Error(`[self_report] user lookup failed: ${selectError.message}`);
  }
  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabaseAdmin
    .from("users")
    .insert({
      email,
      plan: "free",
      owner_token: guestToken(16),
      invite_code: guestToken(8),
      type_id: classifyType(PLACEHOLDER_SCORES),
      scores: PLACEHOLDER_SCORES,
    })
    .select("id")
    .single();
  if (createError || !created?.id) {
    throw new Error(
      `[self_report] guest user create failed: ${createError?.message ?? "no id returned"}`,
    );
  }
  return created.id as string;
}

// ---------- フルアクセス特典: 詳細レポートお届けメール ----------
// grantFullAccessByEmailOrId の後に呼ぶ (users 行が必ず存在する状態)。
// 宛先 = Stripe 確定 email (無ければ users.email)。リンク先は /me/[owner_token] と
// /report/[owner_token]/pdf。診断前ゲスト購入のプレースホルダー行には送らず、
// /api/diagnosis が本物の owner_token に更新した後で届ける。
// best-effort: 失敗しても throw しない (grant は完了済み。Webhook 200 応答を止めない)。
// 注意: Stripe が同一 event を再送した場合はメールも再送され得る (grant 系は冪等なので
// 実害は重複メール 1 通のみ。頻発するようなら payment_history 側の冪等キー参照で抑止)。
async function sendDetailedReportEmailBestEffort(
  session: Stripe.Checkout.Session,
  userId: string | null,
): Promise<void> {
  try {
    const stripeEmail =
      normalizeEmail(session.customer_details?.email) ??
      normalizeEmail(session.customer_email) ??
      normalizeEmail(session.metadata?.email);

    // owner_token の解決: user_id 優先 → email の最新行
    let row: {
      owner_token: string | null;
      display_name: string | null;
      email: string | null;
      diagnosis_completed_at: string | null;
      scores: unknown;
    } | null = null;
    if (userId) {
      const { data } = await supabaseAdmin
        .from("users")
        .select(
          "owner_token, display_name, email, diagnosis_completed_at, scores",
        )
        .eq("id", userId)
        .maybeSingle();
      row = data ?? null;
    }
    if (!row && stripeEmail) {
      const { data } = await supabaseAdmin
        .from("users")
        .select(
          "owner_token, display_name, email, diagnosis_completed_at, scores",
        )
        .eq("email", stripeEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      row = data ?? null;
    }

    const to = stripeEmail ?? normalizeEmail(row?.email);
    if (!row?.owner_token || !to) {
      console.warn("[webhook/stripe] report email skipped", {
        has_token: !!row?.owner_token,
        has_email: !!to,
      });
      return;
    }

    if (isUndiagnosedPlaceholderUser(row)) {
      console.log(
        "[webhook/stripe] detailed report email deferred until diagnosis",
        {
          session_id: session.id,
          locale: session.metadata?.locale === "ko" ? "ko" : "ja",
        },
      );
      return;
    }

    await sendDetailedReportEmail({
      to,
      ownerToken: row.owner_token,
      ownerName: row.display_name,
      locale: session.metadata?.locale === "ko" ? "ko" : "ja",
      product:
        session.metadata?.product === "self_report"
          ? "self_report"
          : session.metadata?.product === "premium_bundle"
            ? "premium_bundle"
            : "full_access",
      destinyFeaturesIncluded:
        session.metadata?.product === "premium_bundle" ||
        (session.metadata?.product !== "self_report" &&
          purchaseIncludesDestinyFeatures(
            "full_access",
            session.metadata?.destiny_access_policy,
          )),
      friendFeaturesIncluded: purchaseIncludesFriendFeatures(
        session.metadata?.product === "premium_bundle"
          ? "premium_bundle"
          : session.metadata?.product === "self_report"
            ? "self_report"
            : "full_access",
        session.metadata?.friend_access_policy,
      ),
      purchaseAmountJpy:
        session.currency === "jpy" ? session.amount_total : null,
      purchaseAmountMinor: session.amount_total,
    });
    console.log("[webhook/stripe] detailed report email sent");
  } catch (err) {
    console.error(
      "[webhook/stripe] detailed report email failed (continuing):",
      err instanceof Error ? err.message : String(err),
    );
  }
}

// 課金ファネル計測: 決済完了イベントを events に記録 (サーバ発行・session_id 無し)。
// Stripe は webhook を再送するため、stripe_session_id で冪等化 (既存があれば挿入しない)。
// 計測失敗で webhook を落とさない (grant は完了済み。エラーは握りつぶす)。
async function recordPurchaseCompletedEvent(
  session: Stripe.Checkout.Session,
  userId: string,
): Promise<void> {
  try {
    const locale = session.metadata?.locale === "ko" ? "ko" : "ja";
    const product =
      session.metadata?.product === "self_report"
        ? "self_report"
        : session.metadata?.product === "premium_bundle"
          ? "premium_bundle"
          : "full_access";
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("event_name", "purchase_completed")
      .eq("metadata->>stripe_session_id", session.id)
      .limit(1);
    // SELECT 失敗時は重複の有無が判定できない。挿入すると再送時に二重計上の恐れが
    // あるためスキップ (集計側も stripe_session_id ユニークで数えるので、稀な取りこぼしは
    // paidUsers (users.plan) 側で補足できる)。
    if (selErr) {
      console.error("[webhook] purchase_completed dedup check failed:", selErr);
      return;
    }
    if (existing && existing.length > 0) return;
    await supabaseAdmin.from("events").insert({
      event_name: "purchase_completed",
      owner_token:
        typeof session.metadata?.owner_token === "string"
          ? session.metadata.owner_token || null
          : null,
      locale,
      metadata: {
        stripe_session_id: session.id,
        user_id: userId,
        product,
        guest: session.metadata?.guest === "1",
        amount_total: session.amount_total ?? null,
        currency: session.currency ?? null,
        upgrade_from: session.metadata?.upgrade_from ?? "none",
        destiny_access_policy:
          session.metadata?.destiny_access_policy ?? "legacy_included",
        friend_access_policy:
          session.metadata?.friend_access_policy ?? "legacy_included",
        paywall_version: session.metadata?.paywall_version ?? "legacy",
        placement: session.metadata?.paywall_placement ?? "unknown",
        source: normalizePaywallSource(session.metadata?.paywall_source),
        return_to:
          product === "self_report"
            ? "me"
            : session.metadata?.return_to === "tako"
              ? "tako"
              : session.metadata?.return_to === "aisho"
                ? "aisho"
                : session.metadata?.return_to === "unmei"
                  ? "unmei"
                  : "me",
        locale,
      },
    });
  } catch (err) {
    console.error("[webhook] purchase_completed event insert failed:", err);
  }
}

// unmei 系の購入イベントも purchase_completed と同様に stripe_session_id で冪等化する。
// AI 生成タイムアウト → Stripe 再送のたびに行が増え、同一決済が最大5行入っていた
// (2026-08-08 実測)。集計はユニーク数で数えるが、期間フィルタと組み合わさると
// 再送行が「期間内の初回」に化けて決済日がズレるため、挿入自体を1回にする。
async function recordUnmeiPurchaseEventOnce(
  eventName: "unmei_purchase_complete" | "unmei_upgrade_complete",
  session: Stripe.Checkout.Session,
  userId: string | null,
): Promise<void> {
  try {
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("event_name", eventName)
      .eq("metadata->>stripe_session_id", session.id)
      .limit(1);
    // SELECT 失敗時は重複の有無が判定できないため挿入しない (recordPurchaseCompletedEvent と同方針)。
    if (selErr) {
      console.error(`[webhook] ${eventName} dedup check failed:`, selErr);
      return;
    }
    if (existing && existing.length > 0) return;
    const ownerToken =
      typeof session.metadata?.owner_token === "string" &&
      session.metadata.owner_token
        ? session.metadata.owner_token
        : null;
    await supabaseAdmin.from("events").insert({
      event_name: eventName,
      owner_token: ownerToken,
      metadata: {
        stripe_session_id: session.id,
        user_id: userId,
        owner_token: ownerToken,
        product:
          eventName === "unmei_purchase_complete" ? "unmei" : "unmei_upgrade",
        amount_total: session.amount_total ?? null,
        currency: session.currency ?? "jpy",
      },
    });
  } catch (e) {
    console.error(`[webhook] ${eventName} insert failed:`, e);
  }
}

// ---------- 支払い確定済み Checkout Session の共通処理 ----------
// checkout.session.completed (即時決済) と checkout.session.async_payment_succeeded
// (遅延決済) のどちらからも、payment_status='paid' を確認した後だけ呼ぶ。
async function handleCheckoutPaid(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = session.metadata ?? {};
  // guest 決済では user_id が空。"" は null 扱いにする。
  const userId =
    typeof metadata.user_id === "string" && metadata.user_id.length > 0
      ? metadata.user_id
      : null;

  // フルアクセス(全解放): guest 対応。user_id が無くても Stripe 確定 email で紐付ける。
  //   email backfill / プレースホルダー作成も含めて grantFullAccessByEmailOrId が担う。
  // 新商品: 運命の設計図 (unmei)
  if (metadata.product === "unmei") {
    // guest 対応で email で紐付け。unmei フラグを立て、natal_readings プレースホルダを挿入。
    await grantUnmeiByEmailOrId(session, userId);
    const linkedUserId = userId ?? (await resolveUserIdForSession(session));
    if (!linkedUserId) {
      throw new Error(`[unmei] linked user missing for ${session.id}`);
    }
    await recordUnmeiPayment(session, linkedUserId, "unmei");
    await persistPurchaseLocale(session, linkedUserId);
    await recordUnmeiPurchaseEventOnce(
      "unmei_purchase_complete",
      session,
      linkedUserId,
    );
    // AI 生成 (〜100秒超) は応答後に after() で実行する。同期 await だと maxDuration を
    // 超えて webhook 全体がタイムアウトし、Stripe が翌日まで再送し続けていた (2026-08-08)。
    // after() が失敗しても /unmei ページ側の /api/unmei/generate キックで回復できる。
    after(() =>
      triggerUnmeiGeneration(
        linkedUserId,
        session.metadata?.locale === "ko" ? "ko" : "ja",
      ),
    );
    await sendDetailedReportEmailBestEffort(session, userId);
    return;
  }

  // アップグレード (¥400): user 専用経路。userId が必須で既に full_access を持っていることを確認してから付与。
  if (metadata.product === "unmei_upgrade") {
    // 前提(user_id 有り・full_access 保有)を満たさないセッションは、Stripe が何度リトライしても
    // 解消しない「毒(poison)」。500 で無限リトライさせず 200 で受領し、Slack 通知で手動対応に回す。
    // (hasFullAccess の DB エラーは throw されて 500 → transient リトライ。これは正しい挙動として温存)
    if (!userId) {
      console.error(`[webhook/stripe] unmei_upgrade without user_id (acknowledged): ${session.id}`);
      await sendSlackAlert("⚠️ unmei_upgrade: user_id 無しで受領のみ", { session_id: session.id });
      return;
    }
    const { hasFullAccess } = await import("@/lib/entitlements");
    const ok = await hasFullAccess(userId);
    if (!ok) {
      console.error(
        `[webhook/stripe] unmei_upgrade ineligible user ${userId} (acknowledged): ${session.id}`,
      );
      await sendSlackAlert("⚠️ unmei_upgrade: 対象外ユーザーで受領のみ", {
        user_id: userId,
        session_id: session.id,
      });
      return;
    }
    await grantUnmeiToUserId(userId);
    await recordUnmeiPayment(session, userId, "unmei_upgrade");
    await persistPurchaseLocale(session, userId);
    await recordUnmeiPurchaseEventOnce("unmei_upgrade_complete", session, userId);
    // 基本購入と同じく、AI 生成は応答後に回して webhook を即 200 で返す。
    after(() =>
      triggerUnmeiGeneration(
        userId,
        session.metadata?.locale === "ko" ? "ko" : "ja",
      ),
    );
    await sendDetailedReportEmailBestEffort(session, userId);
    return;
  }

  if (metadata.product === "premium_bundle") {
    const paymentUserId = await grantFullAccessByEmailOrId(session, userId);
    await grantUnmeiByEmailOrId(session, paymentUserId);
    await recordFullAccessPayment(session, paymentUserId, "premium_bundle");
    try {
      await grantHoshiyomiCreditsToTarget({
        userId: paymentUserId,
        sourceKey: `stripe:${session.id}`,
        targetTotal: 30,
      });
    } catch (error) {
      if (!isMissingHoshiyomiStore(error)) throw error;
      console.warn("[webhook/stripe] hoshiyomi migration pending", {
        stripe_session_id: session.id,
      });
    }
    await persistPurchaseLocale(session, paymentUserId);
    await recordPurchaseCompletedEvent(session, paymentUserId);
    after(() =>
      triggerUnmeiGeneration(
        paymentUserId,
        session.metadata?.locale === "ko" ? "ko" : "ja",
      ),
    );
    await sendDetailedReportEmailBestEffort(session, paymentUserId);
    return;
  }

  if (metadata.product === "full_access") {
    const paymentUserId = await grantFullAccessByEmailOrId(session, userId);
    const includesDestinyFeatures = purchaseIncludesDestinyFeatures(
      "full_access",
      session.metadata?.destiny_access_policy,
    );
    if (includesDestinyFeatures) {
      await grantUnmeiByEmailOrId(session, paymentUserId);
    }
    await recordFullAccessPayment(session, paymentUserId);
    if (includesDestinyFeatures) {
      try {
        await grantHoshiyomiCreditsToTarget({
          userId: paymentUserId,
          sourceKey: `stripe:${session.id}`,
          targetTotal: 5,
        });
      } catch (error) {
        if (!isMissingHoshiyomiStore(error)) throw error;
        console.warn("[webhook/stripe] hoshiyomi migration pending", {
          stripe_session_id: session.id,
        });
      }
    }
    await persistPurchaseLocale(session, paymentUserId);
    await recordPurchaseCompletedEvent(session, paymentUserId);
    if (includesDestinyFeatures) {
      after(() =>
        triggerUnmeiGeneration(
          paymentUserId,
          session.metadata?.locale === "ko" ? "ko" : "ja",
        ),
      );
    }
    await sendDetailedReportEmailBestEffort(session, userId);
    return;
  }

  if (metadata.product === "self_report") {
    const paymentUserId = await resolveSelfReportUser(session, userId);
    await recordSelfReportPayment(session, paymentUserId);
    await persistPurchaseLocale(session, paymentUserId);
    await recordPurchaseCompletedEvent(session, paymentUserId);
    await sendDetailedReportEmailBestEffort(session, paymentUserId);
    return;
  }

  // ここから先 (perception_unlock 等) は従来どおり user_id 必須。
  if (!userId) {
    throw new Error(
      `session.metadata.user_id missing for session ${session.id}`,
    );
  }

  // ★ Stripe が確定した email を users.email が空なら埋める (復元用)。
  await persistLoginEmailIfEmpty(userId, session);

  // Phase 1.5-α Day 12-C2: payment_kind 分岐
  // 'perception_unlock' = 評価 1 件ごと ¥500 解除 (新フロー、本 PR で追加)
  // 'tako_unlock' = 友達診断の隠しコンテンツ解放 (¥799 / 割引 ¥300, 2026-07-21 改定)
  // それ以外 (NULL / 'integrated_trisetsu') = 既存「真のトリセツ」フロー (本 PR で変更なし)
  if (metadata.payment_kind === "perception_unlock") {
    await handlePerceptionUnlockCompleted(session, userId, metadata);
    return;
  }
  if (metadata.payment_kind === "tako_unlock") {
    await handleTakoUnlockCompleted(session, userId);
    return;
  }
}

// ---------- tako_unlock 経路 (2026-07-20) ----------
// 友達診断 (/tako) の隠しコンテンツ解放。payment_history に
// payment_kind='tako_unlock' で INSERT するだけ (権限は hasTakoAccess が
// payment_history から導出する。users.plan は変更しない)。
// Idempotency: stripe_session_id UNIQUE で二重 Webhook を吸収。
async function handleTakoUnlockCompleted(
  session: Stripe.Checkout.Session,
  userId: string,
): Promise<void> {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { error: upsertErr } = await supabaseAdmin
    .from("payment_history")
    .upsert(
      {
        user_id: userId,
        payment_kind: "tako_unlock" as const,
        stripe_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_jpy: session.amount_total ?? 799,
        currency: session.currency ?? "jpy",
        status: "completed" as const,
        paid_at: new Date().toISOString(),
        metadata: {
          payment_kind: "tako_unlock",
          discounted: session.metadata?.discounted ?? "0",
        },
      },
      { onConflict: "stripe_session_id", ignoreDuplicates: true },
    );

  if (upsertErr) {
    // 23505 = idx_payment_tako_unlock_once (同一 user の tako_unlock completed は
    // 1 行まで) 違反。2 タブ同時 Checkout 等で 2 本目の決済が完了したケースで、
    // Stripe が何度リトライしても解消しない毒イベント。500 で無限リトライさせず
    // 200 で受領し、Slack 通知で手動返金に回す (1 本目の記録と権限は有効なまま)。
    if (upsertErr.code === "23505") {
      console.error("[webhook/stripe] tako_unlock duplicate purchase (acknowledged)", {
        session_id: session.id,
        user_id: userId,
      });
      await sendSlackAlert("🚨 tako_unlock 二重課金を検知 (要・手動返金)", {
        user_id: userId,
        session_id: session.id,
        amount: session.amount_total ?? "unknown",
      });
      return;
    }
    throw new Error(
      `[tako_unlock] payment_history upsert failed: ${upsertErr.message}`,
    );
  }

  console.log("[webhook/stripe] tako_unlock completed", {
    session_id: session.id,
    user_id: userId,
    amount: session.amount_total,
  });
}

// grant unmei (運命の設計図) の付与: email または userId に紐付けて users.unmei=true + plan='full'
async function grantUnmeiByEmailOrId(
  session: Stripe.Checkout.Session,
  userId: string | null,
): Promise<void> {
  const email =
    normalizeEmail(session.customer_details?.email) ??
    normalizeEmail(session.customer_email) ??
    normalizeEmail(session.metadata?.email);
  const nowIso = new Date().toISOString();
  let linked = false;

  if (email) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ unmei: true, plan: "full" })
      .eq("email", email)
      .select("id");
    if (error) {
      throw new Error(`[unmei] email link failed: ${error.message}`);
    }
    if (data && data.length > 0) {
      linked = true;
      await supabaseAdmin.from("users").update({ unmei: true, unmei_at: nowIso }).eq("email", email).is("unmei_at", null);
    }
  }

  if (userId) {
    const { error } = await supabaseAdmin.from("users").update({ unmei: true, plan: "full" }).eq("id", userId);
    if (error) {
      throw new Error(`[unmei] id link failed: ${error.message}`);
    }
    linked = true;
    await supabaseAdmin.from("users").update({ unmei: true, unmei_at: nowIso }).eq("id", userId).is("unmei_at", null);
    // email backfill (full_access と同じ): 匿名セッション購入 (未診断チャット決済) の行に
    // Stripe 確定 email を埋め、Cookie を失ってもマジックリンクで復元できるようにする。
    if (email) {
      await supabaseAdmin.from("users").update({ email }).eq("id", userId).is("email", null);
    }
  }

  if (!linked) {
    if (!email) {
      throw new Error(`[unmei] no email and no user_id for session ${session.id}`);
    }
    const { error } = await supabaseAdmin.from("users").insert({
      email,
      unmei: true,
      plan: "full",
      unmei_at: nowIso,
      owner_token: guestToken(16),
      invite_code: guestToken(8),
      type_id: classifyType(PLACEHOLDER_SCORES),
      scores: PLACEHOLDER_SCORES,
    });
    if (error) {
      throw new Error(`[unmei] guest user create failed: ${error.message}`);
    }
  }

  // ensure natal_readings placeholder exists for the user(s) linked (upsert by user id where possible)
  try {
    // find affected user ids: prefer userId then email
    let rows: { id: string }[] = [];
    if (userId) {
      rows = [{ id: userId }];
    } else if (email) {
      const { data } = await supabaseAdmin.from("users").select("id").eq("email", email);
      rows = (data as Array<{ id: string }> | null | undefined) ?? [];
    }
    for (const r of rows) {
      await supabaseAdmin.from("natal_readings").upsert({ user_id: r.id, reading: {}, model: "pending", generated_at: new Date().toISOString() }, { onConflict: "user_id" });
    }
  } catch (e) {
    console.error("[unmei] natal_readings placeholder upsert failed:", e);
  }

  console.log("[webhook/stripe] unmei granted", { user_id: userId ?? "(guest)", email: email ?? null });
}

async function grantUnmeiToUserId(userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin.from("users").update({ unmei: true, plan: "full", unmei_at: nowIso }).eq("id", userId);
  if (error) throw new Error(`[unmei] grant to user failed: ${error.message}`);
  // ensure natal_readings placeholder
  await supabaseAdmin.from("natal_readings").upsert({ user_id: userId, reading: {}, model: "pending", generated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

// 鑑定生成トリガー (非致命)。
// entitlement 付与は既に完了しているため、生成の失敗で Webhook を 500 にしない
// (500 だと Stripe が Webhook 全体をリトライし、二重メール等の副作用が出る)。
//   - 出生データ未入力 (skipped) → 正常な待機状態。natal_readings は pending のまま。
//     ユーザーが /unmei で出生データを入力した時点で生成が走る。
//   - 生成中の例外 (error / throw) → Slack 通知のみ。/unmei 側が pending を検知して
//     再生成をトリガーし、60 秒でタイムアウト表示に切り替えるため無限ローディングにならない。
async function triggerUnmeiGeneration(
  userId: string,
  locale: "ja" | "ko" = "ja",
): Promise<void> {
  try {
    // Big Five スコア + 32タイプ称号を解決してプロンプト入力に渡す。
    const { resolveUnmeiPromptInputs } = await import("@/lib/unmei/prompt-inputs");
    const promptInputs = await resolveUnmeiPromptInputs(supabaseAdmin, userId, locale);

    const result = await runForUser(supabaseAdmin, userId, {
      ...promptInputs,
      locale,
    });
    if (result && "skipped" in result) {
      // no_birth_profile(出生データ未入力) / chart_not_ready(エフェメリス未計算)
      // いずれも正常な待機状態。natal_readings は pending のまま。
      console.log(
        `[webhook/stripe] unmei generation deferred (${result.skipped}):`,
        userId,
      );
      return;
    }
    if (result && "error" in result) {
      console.error("[webhook/stripe] unmei generation error (non-fatal):", result.error);
      await sendSlackAlert("⚠️ unmei鑑定生成に失敗 (webhook・非致命)", {
        user_id: userId,
        error: String(result.error),
      });
    }
  } catch (err) {
    console.error("[webhook/stripe] unmei generation threw (non-fatal):", err);
    await sendSlackAlert("⚠️ unmei鑑定生成が例外 (webhook・非致命)", {
      user_id: userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------- checkout.session.async_payment_failed ----------
// 遅延決済が失敗した場合は権限を付与しない。Stripe Dashboard にも記録されるが、
// 運営側で追跡できるよう session 単位でログと Slack アラートを残す。
async function handleCheckoutAsyncPaymentFailed(
  session: Stripe.Checkout.Session,
): Promise<void> {
  console.warn("[webhook/stripe] checkout.session.async_payment_failed", {
    session_id: session.id,
    payment_status: session.payment_status,
    payment_intent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
  });
  await sendSlackAlert("⚠️ Stripe checkout.session.async_payment_failed", {
    session_id: session.id,
    payment_status: session.payment_status,
    payment_intent:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? "unknown"),
  });
}

// ---------- Phase 1.5-α Day 12-C2: perception_unlock 経路 ----------
// 評価 1 件ごとに ¥500 で解除する Stripe Checkout 完了処理。
// payment_history に perception_id + payment_kind='perception_unlock' で INSERT するだけ、
// integrated_trisetsu (AI 統合トリセツ) は生成しない (別経路)。
//
// Idempotency:
//   - stripe_session_id UNIQUE で二重 Webhook を防ぐ (upsert ignoreDuplicates)
//   - perception_id 部分 UNIQUE (migration day12-c2) で同一 perception への二重 completed
//     を DB レベル防止 (アプリ層は /api/checkout/create-perception-unlock-session で
//     事前 SELECT 拒否)
async function handlePerceptionUnlockCompleted(
  session: Stripe.Checkout.Session,
  userId: string,
  metadata: Record<string, string>,
): Promise<void> {
  const perceptionId = metadata.perception_id;
  if (!perceptionId) {
    throw new Error(
      `session.metadata.perception_id missing for perception_unlock session ${session.id}`,
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const paymentRecord = {
    user_id: userId,
    perception_id: perceptionId,
    payment_kind: "perception_unlock" as const,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    amount_jpy: session.amount_total ?? 500,
    currency: session.currency ?? "jpy",
    status: "completed" as const,
    paid_at: new Date().toISOString(),
    metadata: {
      perception_id: perceptionId,
      payment_kind: "perception_unlock",
    },
  };

  const { error: upsertErr } = await supabaseAdmin
    .from("payment_history")
    .upsert(paymentRecord, {
      onConflict: "stripe_session_id",
      ignoreDuplicates: true,
    });

  if (upsertErr) {
    // 部分 UNIQUE 違反 (二重 unlock 試行) も含めて throw → Stripe にリトライさせる
    // ただし二重 unlock は アプリ層で 409 拒否済のため、ここに来るのは race のみ
    throw new Error(
      `[perception_unlock] payment_history upsert failed: ${upsertErr.message}`,
    );
  }

  console.log("[webhook/stripe] perception_unlock completed", {
    session_id: session.id,
    user_id: userId,
    perception_id: perceptionId,
  });
}

// ---------- payment_intent.payment_failed ----------
async function handlePaymentFailed(
  intent: Stripe.PaymentIntent,
): Promise<void> {
  // 決済失敗は payment_history を作らない (payment は未成立)。
  // Stripe Dashboard で Failed payments として記録される。
  // アプリ側では Slack アラートで運営者に通知し、頻発するようなら対応。
  console.warn("[webhook/stripe] payment_intent.payment_failed", {
    intent_id: intent.id,
    amount: intent.amount,
    last_payment_error: intent.last_payment_error?.message,
  });
  await sendSlackAlert("⚠️ Stripe payment_intent.payment_failed", {
    intent_id: intent.id,
    amount: intent.amount,
    error_code: intent.last_payment_error?.code,
    error_message: intent.last_payment_error?.message ?? "unknown",
  });
}

// Stripe sends charge.refunded for both full and partial refunds. Store the exact
// refunded amount so dashboard revenue is net of refunds; only a full refund moves
// the legacy status enum to "refunded".
//
// payment_kind では絞らない: tako_unlock / perception_unlock の返金も同じ
// payment_intent_id で payment_history に記録される (以前は full_access 限定で、
// それ以外の返金が 0 行更新 → throw → Stripe が最大 3 日再送し続ける毒イベントだった)。
type RefundedPaymentRow = {
  id: string;
  user_id: string;
  stripe_session_id: string;
  payment_kind: string | null;
  status: string;
};

type ActiveCoursePaymentRow = Omit<
  AccessPaymentRow,
  "metadata" | "payment_kind"
> & {
  payment_kind: AccessPaymentRow["payment_kind"] | "unmei" | "unmei_upgrade";
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  currency: string;
  metadata: {
    upgrade_from?: unknown;
    locale?: unknown;
    destiny_access_policy?: unknown;
    friend_access_policy?: unknown;
  } | null;
};

async function relatedUserIdsForRefund(
  payment: RefundedPaymentRow,
): Promise<{ email: string | null; ids: string[] }> {
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", payment.user_id)
    .maybeSingle();
  if (userError) {
    throw new Error(`[refund] user lookup failed: ${userError.message}`);
  }
  const email = normalizeEmail(user?.email);
  if (!email) return { email: null, ids: [payment.user_id] };

  const { data: related, error: relatedError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(50);
  if (relatedError) {
    throw new Error(`[refund] related user lookup failed: ${relatedError.message}`);
  }
  const ids = (related ?? []).map((row) => row.id as string);
  if (!ids.includes(payment.user_id)) ids.push(payment.user_id);
  return { email, ids };
}

async function refundInvalidDependentPurchases(
  cause: RefundedPaymentRow,
  rows: ActiveCoursePaymentRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const stripe = getStripe();
  if (!stripe) throw new Error("[refund] Stripe is not configured");

  for (const row of rows) {
    let paymentIntentId = row.stripe_payment_intent_id;
    if (!paymentIntentId) {
      const session = await stripe.checkout.sessions.retrieve(
        row.stripe_session_id,
      );
      paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
    }
    if (!paymentIntentId) {
      await sendSlackAlert("⚠️ 差額購入の連鎖返金にPaymentIntentがありません", {
        cause_payment_id: cause.id,
        dependent_payment_id: row.id,
        stripe_session_id: row.stripe_session_id,
      });
      throw new Error(
        `[refund] dependent payment intent missing: ${row.stripe_session_id}`,
      );
    }

    await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `dependent-refund:${cause.id}:${row.id}` },
    );

    if (
      row.payment_kind === "full_access" ||
      row.payment_kind === "premium_bundle"
    ) {
      try {
        await revokeHoshiyomiCredits(`stripe:${row.stripe_session_id}`);
      } catch (error) {
        if (!isMissingHoshiyomiStore(error)) throw error;
      }
    }

    await sendSlackAlert("ℹ️ 前提商品返金に伴う差額購入の自動返金", {
      cause_payment_id: cause.id,
      dependent_payment_id: row.id,
      payment_kind: row.payment_kind,
      stripe_session_id: row.stripe_session_id,
    });
  }
}

async function recomputeAccessAfterFullRefund(
  payment: RefundedPaymentRow,
): Promise<void> {
  const accessKinds = [
    "self_report",
    "full_access",
    "premium_bundle",
    "unmei",
    "unmei_upgrade",
  ];
  if (!payment.payment_kind || !accessKinds.includes(payment.payment_kind)) {
    return;
  }

  const { email, ids: relatedIds } = await relatedUserIdsForRefund(payment);

  const { data: remaining, error: remainingError } = await supabaseAdmin
    .from("payment_history")
    .select(
      "id, user_id, stripe_session_id, stripe_payment_intent_id, payment_kind, currency, metadata, paid_at",
    )
    .in("user_id", relatedIds)
    .eq("status", "completed")
    .in("payment_kind", accessKinds)
    .order("paid_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (remainingError) {
    throw new Error(`[refund] remaining entitlement check failed: ${remainingError.message}`);
  }
  const remainingRows = (remaining ?? []) as ActiveCoursePaymentRow[];
  const courseRows = remainingRows.filter(
    (
      row,
    ): row is ActiveCoursePaymentRow & {
      payment_kind: AccessPaymentRow["payment_kind"];
    } =>
      row.payment_kind === "self_report" ||
      row.payment_kind === "full_access" ||
      row.payment_kind === "premium_bundle",
  );
  const validCourseRows = validAccessPaymentRows(
    courseRows,
  ) as (ActiveCoursePaymentRow & {
    payment_kind: AccessPaymentRow["payment_kind"];
  })[];
  const validIds = new Set(validCourseRows.map((row) => row.id));
  const refundedPrerequisite =
    payment.payment_kind === "self_report"
      ? "self_report"
      : payment.payment_kind === "full_access"
        ? "full_access"
        : null;
  const invalidDependents = courseRows.filter((row) => {
    const prerequisite = row.metadata?.upgrade_from;
    return (
      refundedPrerequisite !== null &&
      !validIds.has(row.id) &&
      prerequisite === refundedPrerequisite
    );
  });
  await refundInvalidDependentPurchases(payment, invalidDependents);

  const legacyUnmeiRows = remainingRows.filter(
    (row) =>
      row.payment_kind === "unmei" || row.payment_kind === "unmei_upgrade",
  );
  const hasFull =
    legacyUnmeiRows.length > 0 ||
    validCourseRows.some(
      (row) =>
        row.payment_kind === "full_access" ||
        row.payment_kind === "premium_bundle",
    );
  const hasUnmei = legacyUnmeiRows.length > 0 || validCourseRows.some(
    (row) =>
      purchaseIncludesDestinyFeatures(
        row.payment_kind,
        row.metadata?.destiny_access_policy,
      ),
  );

  const target = supabaseAdmin.from("users").update({
    plan: hasFull ? "full" : "free",
    unmei: hasUnmei,
    ...(!hasFull ? { full_access_at: null } : {}),
    ...(!hasUnmei ? { unmei_at: null } : {}),
  });
  const { error: updateError } = email
    ? await target.eq("email", email)
    : await target.eq("id", payment.user_id);
  if (updateError) {
    throw new Error(`[refund] entitlement revocation failed: ${updateError.message}`);
  }

  console.log("[webhook/stripe] access recomputed after refund", {
    payment_id: payment.id,
    payment_kind: payment.payment_kind,
    related_users: relatedIds.length,
    has_full: hasFull,
    has_unmei: hasUnmei,
    invalid_dependents_refunded: invalidDependents.length,
  });

  // 上位商品の返金後に下位の有効な購入が残る場合、その保証回数まで復元する。
  try {
    await ensureHoshiyomiCreditsFromPurchase(payment.user_id);
  } catch (error) {
    if (!isMissingHoshiyomiStore(error)) throw error;
  }
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const fullyRefunded = charge.amount_refunded >= charge.amount;
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("payment_history")
    .update({
      amount_refunded_minor: charge.amount_refunded,
      status: fullyRefunded ? "refunded" : "completed",
      refunded_at: charge.amount_refunded > 0 ? nowIso : null,
      updated_at: nowIso,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .select("id, user_id, stripe_session_id, payment_kind, status");
  if (isCoreKpiPaymentSchemaPending(error)) {
    console.warn(
      "[webhook/stripe] core KPI refund schema pending; refund fact will require replay after migration",
      { payment_intent_id: paymentIntentId },
    );
    return;
  }
  if (error) {
    throw new Error(`[refund] refund update failed: ${error.message}`);
  }
  if (data && data.length > 0) {
    if (fullyRefunded) {
      for (const row of data as RefundedPaymentRow[]) {
        if (
          row.payment_kind === "full_access" ||
          row.payment_kind === "premium_bundle"
        ) {
          try {
            await revokeHoshiyomiCredits(`stripe:${row.stripe_session_id}`);
          } catch (error) {
            if (!isMissingHoshiyomiStore(error)) throw error;
            console.warn("[webhook/stripe] hoshiyomi migration pending on refund", {
              stripe_session_id: row.stripe_session_id,
            });
          }
        }
        await recomputeAccessAfterFullRefund(row);
      }
    }
    return;
  }

  // 0 行更新 = payment_history に行が無い。原因は 2 通りで扱いを分ける:
  //   a) checkout webhook との順序逆転 (行がこれから書かれる) → throw で Stripe に再送させる
  //   b) unmei / unmei_upgrade: 設計上 payment_history に行を書かない経路 → 再送しても
  //      永遠に解消しない毒イベント。200 で受領し Slack 通知で手動対応に回す。
  // 判別のため Checkout Session を payment_intent から引いて product を見る。
  let product: string | null = null;
  const stripe = getStripe();
  if (stripe) {
    try {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntentId,
        limit: 1,
      });
      product = sessions.data[0]?.metadata?.product ?? null;
    } catch (err) {
      console.error(
        "[webhook/stripe] refund: session lookup failed (will retry):",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  if (product === "unmei" || product === "unmei_upgrade") {
    console.warn("[webhook/stripe] refund for unrecorded product (acknowledged)", {
      payment_intent_id: paymentIntentId,
      product,
      amount_refunded: charge.amount_refunded,
    });
    await sendSlackAlert("⚠️ 返金受領: payment_history 非記録の商品 (要・手動対応)", {
      payment_intent_id: paymentIntentId,
      product,
      amount_refunded: charge.amount_refunded,
      fully_refunded: fullyRefunded ? "yes" : "no",
    });
    return;
  }

  // Webhook delivery order is not guaranteed. A retry after the checkout event
  // has been persisted is safer than silently losing the refund.
  throw new Error(
    `[refund] refund arrived before payment record: ${paymentIntentId}`,
  );
}
