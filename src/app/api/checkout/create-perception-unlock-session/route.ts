// Phase 1.5-α Day 12-C2: perception 1 件ごとに ¥500 で解除する Stripe Checkout Session 作成
//
// POST /api/checkout/create-perception-unlock-session
//   - 認可: Cookie wn_session 必須 (Owner 確認: target_user_id == session.user.id)
//   - body: { perceptionId: string }
//   - 戻り値: { sessionId, url }
//
// 既存 /api/checkout/create-session (真のトリセツ 1 回 ¥500、複数 perception 同時購入) とは
// 別エンドポイント。同じ Price ID (¥500) を再利用するが、metadata.payment_kind で
// Webhook 側が分岐する。
//
// 二重課金防止 (論点 4):
//   1. アプリ層: 既に completed が存在する perception を 409 で拒否 (Stripe への無駄遷移防止)
//   2. DB 層: payment_history (perception_id) WHERE status='completed' 部分 UNIQUE で根本防止
//   両者は独立、片方が抜けてもデータは保護される。
//
// 触らない: 既存 /api/checkout/create-session、Webhook の integrated_trisetsu 経路。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { getStripe, getPremiumPriceId } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  // ===== Stripe 環境変数チェック =====
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }
  const priceId = getPremiumPriceId();
  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID not configured" },
      { status: 500 },
    );
  }

  // ===== 認可 =====
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.id;

  // ===== body parse =====
  let body: { perceptionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const perceptionId =
    typeof body.perceptionId === "string" ? body.perceptionId : null;
  if (!perceptionId) {
    return NextResponse.json(
      { error: "perceptionId required (string)" },
      { status: 400 },
    );
  }

  // ===== perception 検証 (Owner = target_user_id 一致) =====
  const { data: perception, error: pErr } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id, target_user_id")
    .eq("id", perceptionId)
    .maybeSingle();
  if (pErr) {
    console.error(
      "[checkout/create-perception-unlock-session] perception lookup error:",
      pErr,
    );
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!perception) {
    return NextResponse.json(
      { error: "Perception not found" },
      { status: 404 },
    );
  }
  if (perception.target_user_id !== userId) {
    // 他人の perception を解除しようとした (権限なし)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ===== 二重課金防止 (アプリ層、論点 4 第 1 段) =====
  const { count: existingCount, error: existingErr } = await supabaseAdmin
    .from("payment_history")
    .select("id", { count: "exact", head: true })
    .eq("perception_id", perceptionId)
    .eq("status", "completed")
    .eq("payment_kind", "perception_unlock");
  if (existingErr) {
    console.error(
      "[checkout/create-perception-unlock-session] existing check error:",
      existingErr,
    );
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if ((existingCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Already unlocked", code: "already_unlocked" },
      { status: 409 },
    );
  }

  // ===== email 解決 (customer_email、決済通知用) =====
  // 認可済 session に email があれば優先、なければ users から取得
  let customerEmail = session.email ?? null;
  if (!customerEmail) {
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    customerEmail = (userRow?.email as string | null) ?? null;
  }

  // ===== Stripe Session 作成 =====
  // metadata.payment_kind = 'perception_unlock' で Webhook 側が分岐する。
  // success_url / cancel_url は同じ /evaluate/result/{perceptionId} に戻す
  // (cancel 時は何も状態変更されず、success 時は Webhook 完了後にロック解除済表示)。
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      metadata: {
        user_id: userId,
        perception_id: perceptionId,
        payment_kind: "perception_unlock",
        email: customerEmail ?? "",
      },
      // Day 12 hotfix: 決済直後は解除済みの結果ページに直接着地させる
      // (旧: /checkout/success は統合トリセツ専用で perception_id を無視し、
      //  解除済みページに戻れず magic-link ログインへ流れていた)。
      // ?checkout=success で戻り、Webhook 反映前なら結果ページ側が「解除確認中」を表示。
      success_url: `${BASE_URL}/evaluate/result/${encodeURIComponent(perceptionId)}?checkout=success`,
      cancel_url: `${BASE_URL}/evaluate/result/${encodeURIComponent(perceptionId)}`,
      locale: "ja",
    });
  } catch (err) {
    console.error(
      "[checkout/create-perception-unlock-session] Stripe error:",
      err,
    );
    return NextResponse.json(
      {
        error: "Stripe session 作成に失敗しました",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    sessionId: stripeSession.id,
    url: stripeSession.url,
  });
}
