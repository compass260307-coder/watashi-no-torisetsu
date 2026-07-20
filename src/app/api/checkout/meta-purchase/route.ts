import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { checkOrigin } from "@/lib/origin-check";
import {
  isCheckoutSessionId,
  verifyPaidFullAccessCheckoutSession,
  verifyMetaPurchaseClaimToken,
} from "@/lib/paid-checkout-session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function claimId(checkoutSessionId: string): string {
  const hex = createHash("sha256")
    .update(`meta_purchase\0${checkoutSessionId}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function valueInMajorUnit(amount: number | null, currency: string | null) {
  if (amount === null) return undefined;
  // 現行フルアクセスは JPY / KRW。どちらも Stripe ではゼロ小数通貨。
  return currency === "jpy" || currency === "krw" ? amount : amount / 100;
}

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
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
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }
  if (
    !verifyMetaPurchaseClaimToken(
      checkoutSessionId,
      parsed.value.claim_token,
    )
  ) {
    return NextResponse.json({ error: "Invalid claim token" }, { status: 403 });
  }

  const limit = await consumeRateLimit(request, {
    scope: "meta-purchase-claim",
    identifier: checkoutSessionId,
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

  const session = await verifyPaidFullAccessCheckoutSession(checkoutSessionId);
  if (!session) {
    return NextResponse.json({ error: "Payment is not confirmed" }, { status: 400 });
  }

  // events.id の主キーを Checkout Session から決定的に作る。
  // 複数タブ・端末・Function が同時にクレームしても、1件だけが成功する。
  const { error } = await supabaseAdmin.from("events").insert({
    id: claimId(session.id),
    event_name: "meta_purchase_claimed",
    locale: session.locale,
    metadata: {
      stripe_session_id: session.id,
      amount_total: session.amountTotal,
      currency: session.currency,
      locale: session.locale,
    },
  });

  if (error?.code === "23505") {
    return NextResponse.json({ shouldPush: false });
  }
  if (error) {
    console.error("[meta-purchase] claim insert failed:", error.message);
    return NextResponse.json({ error: "Unable to claim event" }, { status: 503 });
  }

  return NextResponse.json({
    shouldPush: true,
    checkoutSessionId: session.id,
    value: valueInMajorUnit(session.amountTotal, session.currency),
    currency: session.currency?.toUpperCase() ?? undefined,
  });
}
