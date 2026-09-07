import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { metaPurchaseContent } from "@/lib/meta-purchase";
import { checkOrigin } from "@/lib/origin-check";
import {
  isCheckoutSessionId,
  verifyPaidMetaPurchaseCheckoutSession,
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

function tiktokBrowserClaimId(checkoutSessionId: string): string {
  const hex = createHash("sha256")
    .update(`tiktok_browser_purchase\0${checkoutSessionId}`)
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
  const action = parsed.value.action ?? "prepare";
  if (action !== "prepare" && action !== "ack") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const limit = await consumeRateLimit(request, {
    scope: `meta-purchase-${action}`,
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

  const session = await verifyPaidMetaPurchaseCheckoutSession(checkoutSessionId);
  if (!session) {
    return NextResponse.json({ error: "Payment is not confirmed" }, { status: 400 });
  }

  if (action === "ack") {
    // dataLayer.push 後だけ記録する。events.id は Session から決定的に作るため、
    // 複数タブのackや再送は同じ1行へ収束する。
    const { error } = await supabaseAdmin.from("events").insert({
      id: claimId(session.id),
      event_name: "meta_purchase_claimed",
      locale: session.locale,
      metadata: {
        stripe_session_id: session.id,
        amount_total: session.amountTotal,
        currency: session.currency,
        locale: session.locale,
        product: session.product,
        delivery: "browser_data_layer_pushed",
      },
    });
    if (error && error.code !== "23505") {
      console.error("[meta-purchase] acknowledgement insert failed:", error.message);
      return NextResponse.json(
        { error: "Unable to acknowledge event" },
        { status: 503 },
      );
    }
    if (parsed.value.tiktok_pushed === true) {
      const { error: tiktokError } = await supabaseAdmin.from("events").insert({
        id: tiktokBrowserClaimId(session.id),
        event_name: "browser_tiktok_purchase_pushed",
        locale: session.locale,
        metadata: {
          stripe_session_id: session.id,
          amount_total: session.amountTotal,
          currency: session.currency,
          locale: session.locale,
          product: session.product,
          delivery: "browser_tiktok_pixel_pushed",
        },
      });
      if (tiktokError && tiktokError.code !== "23505") {
        console.error(
          "[meta-purchase] TikTok acknowledgement insert failed:",
          tiktokError.message,
        );
        return NextResponse.json(
          { error: "Unable to acknowledge TikTok event" },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({ acknowledged: true });
  }

  // prepare はDBに送信済みを書かない。ブラウザが閉じても、次回訪問で再試行できる。
  const content = metaPurchaseContent(
    session.product,
    session.locale,
    session.amountTotal,
    session.currency,
  );
  return NextResponse.json({
    checkoutSessionId: session.id,
    value: valueInMajorUnit(session.amountTotal, session.currency),
    currency: session.currency?.toUpperCase() ?? undefined,
    contentIds: content.contentIds,
    contentName: content.contentName,
  });
}
