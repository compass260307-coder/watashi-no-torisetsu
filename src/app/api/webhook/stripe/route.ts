// プレミアム化 v2 Week 2 T2-7: Stripe Webhook ハンドラ
//
// POST /api/webhook/stripe
//   - Stripe からの Webhook を受信、署名検証して event 別に処理
//   - 認可: Stripe 署名 (STRIPE_WEBHOOK_SECRET) のみ。LIFF id_token は不要
//   - 対応 event:
//       checkout.session.completed   メイン: payment_history + integrated_trisetsu INSERT + AI 生成キック
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

import { NextRequest, NextResponse, after } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe-server";
import {
  buildSourceSummary,
  runAIGenerationAndUpdate,
} from "@/lib/integrated-trisetsu-generator";
import { sendSlackAlert } from "@/lib/slack-alert";
import { sendPaymentReceivedMessage } from "@/lib/line-notify";

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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
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

// ---------- PR1: フルアクセス(全解放) 完了 ----------
// plan='full' に更新 (冪等: 同一 webhook が複数回届いても結果同じ)。
// full_access_at は初回のみ (WHERE full_access_at IS NULL で再送上書きを防止)。
// email backfill は handleCheckoutCompleted 冒頭の persistLoginEmailIfEmpty で共通処理済み。
async function handleFullAccessCompleted(userId: string): Promise<void> {
  const nowIso = new Date().toISOString();

  const { error: planErr } = await supabaseAdmin
    .from("users")
    .update({ plan: "full" })
    .eq("id", userId);
  if (planErr) {
    // throw → Stripe がリトライ。plan 更新は冪等なので安全。
    throw new Error(`[full_access] plan update failed: ${planErr.message}`);
  }

  const { error: atErr } = await supabaseAdmin
    .from("users")
    .update({ full_access_at: nowIso })
    .eq("id", userId)
    .is("full_access_at", null);
  if (atErr) {
    // 致命ではない (購入日時は分析用)。plan='full' は確定済みなので続行。
    console.warn("[full_access] full_access_at update warning:", atErr.message);
  }

  console.log("[webhook/stripe] full_access completed", { user_id: userId });
}

// ---------- checkout.session.completed ----------
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = session.metadata ?? {};
  const userId = metadata.user_id;
  const lineUserId = metadata.line_user_id ?? null;
  if (!userId) {
    throw new Error(
      `session.metadata.user_id missing for session ${session.id}`,
    );
  }

  // ★ 全課金経路共通: Stripe が確定した email を users.email が空なら埋める (復元用)。
  //   payment_kind 分岐の手前に置くことで perception_unlock / integrated_trisetsu
  //   の両経路 + 将来経路を 1 箇所でカバーする。詳細は persistLoginEmailIfEmpty 参照。
  await persistLoginEmailIfEmpty(userId, session);

  // PR1: ¥299 買い切り「フルアクセス(全解放)」。metadata.product='full_access' で分岐。
  //   plan='full' に更新 (冪等: 何度届いても結果同じ)。full_access_at は初回のみ。
  //   email backfill は上の persistLoginEmailIfEmpty で共通処理済み。
  if (metadata.product === "full_access") {
    await handleFullAccessCompleted(userId);
    return;
  }

  // Phase 1.5-α Day 12-C2: payment_kind 分岐
  // 'perception_unlock' = 評価 1 件ごと ¥500 解除 (新フロー、本 PR で追加)
  // それ以外 (NULL / 'integrated_trisetsu') = 既存「真のトリセツ」フロー (本 PR で変更なし)
  if (metadata.payment_kind === "perception_unlock") {
    await handlePerceptionUnlockCompleted(session, userId, metadata);
    return;
  }

  const includeSelf = metadata.include_self === "true";
  let perceptionIds: string[] = [];
  try {
    if (metadata.perception_ids) {
      const parsed = JSON.parse(metadata.perception_ids);
      if (Array.isArray(parsed)) {
        perceptionIds = parsed.filter(
          (v): v is string => typeof v === "string",
        );
      }
    }
  } catch {
    perceptionIds = [];
  }

  // ===== 1. payment_history upsert (Idempotency 第 1 層) =====
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  const paymentRecord = {
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    amount_jpy: session.amount_total ?? 500,
    currency: session.currency ?? "jpy",
    status: "completed" as const,
    paid_at: new Date().toISOString(),
    metadata: {
      include_self: includeSelf,
      perception_ids: perceptionIds,
    },
  };

  const { data: insertedPayments, error: upsertErr } = await supabaseAdmin
    .from("payment_history")
    .upsert(paymentRecord, {
      onConflict: "stripe_session_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (upsertErr) {
    throw new Error(`payment_history upsert failed: ${upsertErr.message}`);
  }

  let paymentId: string;
  if (insertedPayments && insertedPayments.length > 0) {
    paymentId = insertedPayments[0].id as string;
  } else {
    // 既存 (二重 webhook) → 既存行を fetch
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("payment_history")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    if (existingErr || !existing) {
      throw new Error(
        `payment_history upsert returned no row and SELECT found none for ${session.id}`,
      );
    }
    paymentId = existing.id as string;
  }

  // ===== 2. integrated_trisetsu 存在チェック (Idempotency 第 2 層) =====
  const { data: existingTrisetsu } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select("id, status")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existingTrisetsu) {
    // 既に作成済み (二重 webhook の 2 回目) → 何もしない
    // failed の場合も MVP では手動対応とする
    return;
  }

  // ===== 3. source_summary 構築 (Webhook 内で同期、< 1 秒) =====
  const sourceSummary = await buildSourceSummary(
    userId,
    includeSelf,
    perceptionIds,
  );

  // ===== 4. integrated_trisetsu INSERT (status='pending') =====
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("integrated_trisetsu")
    .insert({
      user_id: userId,
      line_user_id: lineUserId,
      payment_id: paymentId,
      status: "pending",
      include_self: includeSelf,
      perception_ids: perceptionIds,
      source_summary: sourceSummary,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    // UNIQUE 競合 (= 同時 webhook が先に挿入) → 既存を採用、再生成しない
    if (insErr?.code === "23505") {
      return;
    }
    throw new Error(
      `integrated_trisetsu INSERT failed: ${insErr?.message ?? "no row"}`,
    );
  }
  const integratedId = inserted.id as string;

  // ===== 5. LINE 決済受領通知 + AI 生成 (両方 after() で response 送信後に実行) =====
  // Stripe Webhook は 200 を素早く返す必要があるため、LINE push と AI 呼び出し
  // (60-100 秒) は after() で response 送信後に実行。
  after(async () => {
    // a. 決済受領通知 (LINE 連携済のユーザーのみ)
    if (lineUserId) {
      try {
        await sendPaymentReceivedMessage({
          lineUserId,
          sessionId: session.id,
          ownerUserId: userId,
        });
      } catch (err) {
        console.error(
          `[webhook/stripe] payment_received notification failed for ${integratedId}:`,
          err,
        );
      }
    }
    // b. AI 生成キック (completed / failed の LINE 通知は generator 内で発火)
    try {
      await runAIGenerationAndUpdate(integratedId);
    } catch (err) {
      // 内部で sendSlackAlert + UPDATE failed まで処理済だが、防御的に catch
      console.error(
        `[webhook/stripe] after() AI generation crashed for ${integratedId}:`,
        err,
      );
    }
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
