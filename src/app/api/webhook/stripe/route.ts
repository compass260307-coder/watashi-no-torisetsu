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
//   - 自動返金は実装しない (MVP)、失敗時は Slack アラート + 手動対応

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe-server";
import { sendSlackAlert } from "@/lib/slack-alert";
import { sendDetailedReportEmail } from "@/lib/email";
import { classifyType } from "@/lib/diagnosis";
import { normalizePaywallSource } from "@/lib/paywall-source";

// ゲスト決済で診断前ユーザーを作るときの中立プレースホルダー (診断で本物に UPDATE される)。
// users は type_id/scores が NOT NULL のため空では INSERT できない。
const NEUTRAL_SCORES = { O: 5, C: 5, E: 5, A: 5, N: 5 };
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
            console.log("[webhook/stripe] checkout awaiting payment", {
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
): Promise<void> {
  const email =
    normalizeEmail(session.customer_details?.email) ??
    normalizeEmail(session.customer_email) ??
    normalizeEmail(session.metadata?.email);
  const nowIso = new Date().toISOString();
  let linked = false;

  // ① email 優先: 同 email の全 users を full に
  if (email) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ plan: "full" })
      .eq("email", email)
      .select("id");
    if (error) {
      throw new Error(`[full_access] email link failed: ${error.message}`);
    }
    if (data && data.length > 0) {
      linked = true;
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
    const { error } = await supabaseAdmin.from("users").insert({
      email,
      plan: "full",
      full_access_at: nowIso,
      owner_token: guestToken(16),
      invite_code: guestToken(8),
      type_id: classifyType(NEUTRAL_SCORES),
      scores: NEUTRAL_SCORES,
    });
    if (error) {
      throw new Error(`[full_access] guest user create failed: ${error.message}`);
    }
  }

  console.log("[webhook/stripe] full_access granted", {
    user_id: userId ?? "(guest)",
    email: email ? "set" : "none",
    linked,
  });
}

// ---------- フルアクセス特典: 詳細レポートお届けメール ----------
// grantFullAccessByEmailOrId の後に呼ぶ (users 行が必ず存在する状態)。
// 宛先 = Stripe 確定 email (無ければ users.email)。リンク先は /me/[owner_token] と
// /report/[owner_token]/pdf。閲覧・生成時点の診断結果を使うため、ゲスト決済
// (診断前) でも診断完了後に同じリンクから本人向けの内容を利用できる。
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
    } | null = null;
    if (userId) {
      const { data } = await supabaseAdmin
        .from("users")
        .select("owner_token, display_name, email")
        .eq("id", userId)
        .maybeSingle();
      row = data ?? null;
    }
    if (!row && stripeEmail) {
      const { data } = await supabaseAdmin
        .from("users")
        .select("owner_token, display_name, email")
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

    await sendDetailedReportEmail({
      to,
      ownerToken: row.owner_token,
      ownerName: row.display_name,
      locale: session.metadata?.locale === "ko" ? "ko" : "ja",
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
): Promise<void> {
  try {
    const locale = session.metadata?.locale === "ko" ? "ko" : "ja";
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
      locale,
      metadata: {
        stripe_session_id: session.id,
        product: "full_access",
        guest: session.metadata?.guest === "1",
        amount_total: session.amount_total ?? null,
        source: normalizePaywallSource(session.metadata?.paywall_source),
        locale,
      },
    });
  } catch (err) {
    console.error("[webhook] purchase_completed event insert failed:", err);
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
  if (metadata.product === "full_access") {
    await grantFullAccessByEmailOrId(session, userId);
    await recordPurchaseCompletedEvent(session);
    await sendDetailedReportEmailBestEffort(session, userId);
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
  // それ以外 (NULL / 'integrated_trisetsu') = 既存「真のトリセツ」フロー (本 PR で変更なし)
  if (metadata.payment_kind === "perception_unlock") {
    await handlePerceptionUnlockCompleted(session, userId, metadata);
    return;
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
