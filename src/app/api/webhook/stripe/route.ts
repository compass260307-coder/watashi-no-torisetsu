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

  // ===== 5. AI 生成は after() で非同期実行 =====
  // Stripe Webhook は 200 を素早く返す必要があるため、AI 呼び出し (60-100 秒)
  // は after() で response 送信後に実行。Function は maxDuration まで生存。
  after(async () => {
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
