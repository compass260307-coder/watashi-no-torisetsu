import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { verifyCheckoutCancellation } from "@/lib/checkout-cancel-signature";
import { normalizeCheckoutAttemptId } from "@/lib/checkout-measurement";
import { checkOrigin } from "@/lib/origin-check";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }
  const rateLimit = await consumeRateLimit(request, {
    scope: "checkout-cancelled-ip",
    limit: 30,
    windowSeconds: 600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const parsed = await readJsonObject(request, 2 * 1024);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.value;
  const attemptId = normalizeCheckoutAttemptId(body.checkout_attempt_id);
  if (
    !attemptId ||
    !verifyCheckoutCancellation(attemptId, body.checkout_cancel_signature)
  ) {
    return NextResponse.json({ error: "Invalid cancellation" }, { status: 400 });
  }
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("event_name", "checkout_cancelled")
    .eq("metadata->>checkout_attempt_id", attemptId)
    .limit(1);
  if (selectError) {
    console.error("[checkout/cancelled] dedup check failed", selectError.message);
    return NextResponse.json({ error: "Unable to record cancellation" }, { status: 503 });
  }
  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { data: requested, error: requestedError } = await supabaseAdmin
    .from("events")
    .select("owner_token, locale, metadata")
    .eq("event_name", "checkout_requested")
    .eq("metadata->>checkout_attempt_id", attemptId)
    .limit(1)
    .maybeSingle();
  if (requestedError || !requested) {
    console.error(
      "[checkout/cancelled] matching request not found",
      requestedError?.message ?? attemptId,
    );
    return NextResponse.json(
      { error: "Checkout request not found" },
      { status: 404 },
    );
  }

  const { error } = await supabaseAdmin.from("events").insert({
    event_name: "checkout_cancelled",
    owner_token: requested.owner_token,
    locale: requested.locale,
    metadata: {
      ...(requested.metadata ?? {}),
      checkout_attempt_id: attemptId,
    },
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[checkout/cancelled] insert failed", error.message);
    return NextResponse.json({ error: "Unable to record cancellation" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
