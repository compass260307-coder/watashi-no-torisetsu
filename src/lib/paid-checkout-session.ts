import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getStripe } from "@/lib/stripe-server";

const CHECKOUT_SESSION_ID_RE = /^cs_(?:test|live)_[A-Za-z0-9]+$/;

export type VerifiedPaidCheckoutSession = Readonly<{
  id: string;
  userId: string | null;
  amountTotal: number | null;
  currency: string | null;
  locale: "ja" | "ko";
}>;

export function isCheckoutSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 255 &&
    CHECKOUT_SESSION_ID_RE.test(value)
  );
}

function claimSecret(): string | null {
  return (
    process.env.RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.STRIPE_SECRET_KEY ??
    null
  );
}

export function createMetaPurchaseClaimToken(checkoutSessionId: string): string {
  const secret = claimSecret();
  if (!secret) throw new Error("Meta purchase claim secret is not configured");
  return createHmac("sha256", secret)
    .update(`meta_purchase_claim\0${checkoutSessionId}`)
    .digest("hex");
}

export function verifyMetaPurchaseClaimToken(
  checkoutSessionId: string,
  value: unknown,
): boolean {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    return false;
  }
  const secret = claimSecret();
  if (!secret) return false;

  const expected = createHmac("sha256", secret)
    .update(`meta_purchase_claim\0${checkoutSessionId}`)
    .digest();
  const provided = Buffer.from(value, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// Checkout Session ID をクライアントから信用せず、Stripe の秘密鍵で
// 取得し直す。買い切りフルアクセスの支払いが完了した Session だけを返す。
export async function verifyPaidFullAccessCheckoutSession(
  value: unknown,
): Promise<VerifiedPaidCheckoutSession | null> {
  if (!isCheckoutSessionId(value)) return null;

  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(value);
    if (
      session.status !== "complete" ||
      session.payment_status !== "paid" ||
      session.mode !== "payment" ||
      session.metadata?.product !== "full_access"
    ) {
      return null;
    }

    const metadataUserId = session.metadata?.user_id?.trim();
    return {
      id: session.id,
      userId: metadataUserId || session.client_reference_id || null,
      amountTotal: session.amount_total,
      currency: session.currency,
      locale: session.metadata?.locale === "ko" ? "ko" : "ja",
    };
  } catch {
    // 無効・失効済み・別環境の Session ID は購入完了として扱わない。
    return null;
  }
}
