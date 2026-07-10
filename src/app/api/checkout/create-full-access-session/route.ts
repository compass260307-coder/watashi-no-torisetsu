// PR1: ¥299 買い切り「フルアクセス(全解放)」の Stripe Checkout Session 作成。
//
// POST /api/checkout/create-full-access-session
//   - 認可: Cookie wn_session 必須 (getSession)
//   - 二重課金防止: 既に plan='full' なら 409 already_full (先日の race 対策と同じ思想)
//   - 完了は webhook (checkout.session.completed / metadata.product='full_access') 側で
//     plan='full' に更新。ここでは Checkout URL を返すだけ。
//   - 戻り値: { url }
//
// 既存の create-session / create-perception-unlock-session とは別エンドポイント。
// Price は STRIPE_PRICE_FULL_ACCESS (¥299/one-time)。金額はサーバ側の Price 固定で、
// クライアントからは金額・数量・price を一切受け取らない (改ざん不可)。

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";
import { getStripe, getFullAccessPriceId } from "@/lib/stripe-server";
import { checkOrigin } from "@/lib/origin-check";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  // ===== Stripe 環境 =====
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }
  const priceId = getFullAccessPriceId();
  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_FULL_ACCESS not configured" },
      { status: 500 },
    );
  }

  // ===== 認可 =====
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.id;

  // ===== 二重課金防止 =====
  if (await hasFullAccess(userId)) {
    return NextResponse.json(
      { error: "already_full", code: "already_full" },
      { status: 409 },
    );
  }

  // 購入後の着地は自分のトリセツ (/me/[owner_token])。owner_token が無ければトップ。
  const ownerToken = (session.owner_token ?? "").trim();
  const successUrl = ownerToken
    ? `${BASE_URL}/me/${ownerToken}?paid=1`
    : `${BASE_URL}/?paid=1`;
  const cancelUrl = ownerToken ? `${BASE_URL}/me/${ownerToken}` : `${BASE_URL}/`;

  const customerEmail =
    typeof session.email === "string" && session.email.includes("@")
      ? session.email
      : undefined;

  // ===== Stripe Session 作成 =====
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.create({
      mode: "payment", // 買い切り (subscription ではない)
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      // 既存 webhook は metadata.user_id を読む。product='full_access' で分岐する。
      metadata: {
        user_id: userId,
        product: "full_access",
        email: customerEmail ?? "",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "ja",
    });
  } catch (err) {
    console.error("[checkout/create-full-access-session] Stripe error:", err);
    return NextResponse.json(
      {
        error: "Stripe session 作成に失敗しました",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: stripeSession.url });
}
