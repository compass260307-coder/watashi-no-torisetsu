// 友達診断 (/tako) の隠しコンテンツ解放 (tako_unlock) の Stripe Checkout Session 作成。
//
// POST /api/checkout/create-tako-unlock-session
//   - 認可: body.ownerToken (秘密の capability URL のトークン) で本人を解決
//     (create-full-access-session と同方式。/tako の閲覧と同じ capability)。
//   - 価格はサーバ側で決定 (クライアントから金額は一切受け取らない):
//       通常 ¥799 / 全解放 (plan='full') 保有者は ¥499 OFF の ¥300。
//     固定 Price ID ではなく inline price_data を使う (割引分岐があるため)。
//   - 戻り値: { sessionId, url }
//
// 二重課金防止:
//   1. アプリ層: hasTakoAccess 済みなら 409
//   2. DB 層: payment_history.stripe_session_id UNIQUE (Webhook 側 upsert ignoreDuplicates)

import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { checkOrigin } from "@/lib/origin-check";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe-server";
import {
  hasFullAccess,
  hasTakoAccess,
  TAKO_UNLOCK_DISCOUNTED_PRICE_JPY,
  TAKO_UNLOCK_PRICE_JPY,
} from "@/lib/entitlements";
import { resolveSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = resolveSiteUrl();

// owner_token の書式 (nanoid/base64url 系の不透明トークン)。
function isSafeOpaqueToken(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
}

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }

  // ===== body parse =====
  const parsedBody = await readJsonObject(request, 2 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;
  const ownerToken = isSafeOpaqueToken(body.ownerToken)
    ? body.ownerToken
    : null;
  if (!ownerToken) {
    return NextResponse.json(
      { error: "ownerToken required" },
      { status: 400 },
    );
  }

  const checkoutLimit = await consumeRateLimit(request, {
    scope: "tako-checkout-token",
    identifier: ownerToken,
    limit: 10,
    windowSeconds: 600,
  });
  if (!checkoutLimit.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts" },
      {
        status: 429,
        headers: {
          "Retry-After": String(checkoutLimit.retryAfterSeconds ?? 60),
        },
      },
    );
  }

  // ===== 本人解決 (owner_token capability) =====
  const { data: user, error: uErr } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .eq("owner_token", ownerToken)
    .maybeSingle();
  if (uErr) {
    console.error("[checkout/create-tako-unlock-session] user lookup:", uErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const userId = user.id as string;

  // ===== 二重課金防止 (アプリ層) =====
  if (await hasTakoAccess(userId)) {
    return NextResponse.json(
      { error: "Already unlocked", code: "already_unlocked" },
      { status: 409 },
    );
  }

  // ===== 価格決定 (サーバ側のみ)。全解放オーナーは ¥499 OFF =====
  const discounted = await hasFullAccess(userId);
  const amount = discounted
    ? TAKO_UNLOCK_DISCOUNTED_PRICE_JPY
    : TAKO_UNLOCK_PRICE_JPY;

  const customerEmail =
    typeof user.email === "string" && user.email.includes("@")
      ? user.email
      : null;

  // ===== Stripe Session 作成 =====
  const takoUrl = `${BASE_URL}/tako/${encodeURIComponent(ownerToken)}`;
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: amount,
            product_data: {
              // 表記は ¥499 (性格レポート完全版) の Checkout に揃える:
              // 統一商品名 + 内容列挙の説明 + フェルトマスコットの商品画像。
              // 割引はセッションの金額 (¥300) 側で表現し、商品名は変えない。
              name: "ワタシのトリセツ 友達診断完全版",
              description:
                "友達から見た隠れモテポイント、モテるためのヒント、関係を深めるコツ、関係を壊すワナまで、友達ごとにぜんぶ解放。これから答えてくれる友達のぶんも読める。買い切り・追加課金なし。",
              images: [`${BASE_URL}/mascot/friend-hero.png`],
            },
          },
        },
      ],
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      metadata: {
        user_id: userId,
        payment_kind: "tako_unlock",
        discounted: discounted ? "1" : "0",
      },
      success_url: `${takoUrl}?checkout=success`,
      cancel_url: `${takoUrl}?checkout=cancel`,
    });
  } catch (err) {
    console.error(
      "[checkout/create-tako-unlock-session] stripe create failed:",
      err,
    );
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    sessionId: stripeSession.id,
    url: stripeSession.url,
  });
}
