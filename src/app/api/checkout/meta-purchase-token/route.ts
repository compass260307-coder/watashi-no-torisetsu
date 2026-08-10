// 静的ページの決済着地用に Meta Purchase の claim token を発行する。
//
// POST /api/checkout/meta-purchase-token
//   - body: { checkout_session_id }
//   - 支払い済みの買い切り Session なら { claimToken, product } を返す。
//
// 用途: /aisho (完全静的ページ) の決済着地 (?paid=1&session_id=)。
//   サーバレンダリングされる着地 (/me・/tako・/unmei・/purchase-complete) は
//   createMetaPurchaseClaimToken をページ側で直接呼ぶため、この API を使わない。
//   トークン自体は購入を確定しない (実際のクレームは /api/checkout/meta-purchase
//   側の DB 一意制約が正)。Stripe への問い合わせ増幅を防ぐため IP でレート制限する。

import { NextResponse } from "next/server";

import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { checkOrigin } from "@/lib/origin-check";
import {
  isCheckoutSessionId,
  createMetaPurchaseClaimToken,
  verifyPaidMetaPurchaseCheckoutSession,
} from "@/lib/paid-checkout-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const limit = await consumeRateLimit(request, {
    scope: "meta-purchase-token",
    limit: 10,
    windowSeconds: 600,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const parsed = await readJsonObject(request, 1024);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }

  const checkoutSessionId = parsed.value.checkout_session_id;
  if (!isCheckoutSessionId(checkoutSessionId)) {
    return NextResponse.json(
      { error: "Invalid checkout session" },
      { status: 400 },
    );
  }

  const session = await verifyPaidMetaPurchaseCheckoutSession(checkoutSessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Payment is not confirmed" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    checkoutSessionId: session.id,
    product: session.product,
    claimToken: createMetaPurchaseClaimToken(session.id),
  });
}
