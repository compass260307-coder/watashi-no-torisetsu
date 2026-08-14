import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getStripe } from "@/lib/stripe-server";
import {
  isCheckoutSessionId,
  isMetaPurchaseProduct,
  type MetaPurchaseProduct,
} from "@/lib/meta-purchase";

export { isCheckoutSessionId };

export type VerifiedPaidCheckoutSession = Readonly<{
  id: string;
  userId: string | null;
  amountTotal: number | null;
  currency: string | null;
  locale: "ja" | "ko";
  guest: boolean;
  product: MetaPurchaseProduct;
}>;

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
// 取得し直す。買い切り (self_report / full_access / premium_bundle /
// unmei / unmei_upgrade) の支払いが
// 完了した Session だけを返す。
export async function verifyPaidMetaPurchaseCheckoutSession(
  value: unknown,
): Promise<VerifiedPaidCheckoutSession | null> {
  if (!isCheckoutSessionId(value)) return null;

  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(value);
    const product = session.metadata?.product;
    if (
      session.status !== "complete" ||
      session.payment_status !== "paid" ||
      session.mode !== "payment" ||
      !isMetaPurchaseProduct(product)
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
      guest: session.metadata?.guest === "1",
      product,
    };
  } catch {
    // 無効・失効済み・別環境の Session ID は購入完了として扱わない。
    return null;
  }
}

// 既存呼び出し元 (purchase-complete / /me / /tako) 用: full_access のみ通す。
export async function verifyPaidFullAccessCheckoutSession(
  value: unknown,
): Promise<VerifiedPaidCheckoutSession | null> {
  const session = await verifyPaidMetaPurchaseCheckoutSession(value);
  return session?.product === "full_access" ? session : null;
}

// 自己診断結果ページ・ゲスト購入完了用。3コースはいずれも
// 自己診断/PDFを解放するため受け入れる。
export async function verifyPaidSelfAccessCheckoutSession(
  value: unknown,
): Promise<VerifiedPaidCheckoutSession | null> {
  const session = await verifyPaidMetaPurchaseCheckoutSession(value);
  return session?.product === "self_report" ||
    session?.product === "full_access" ||
    session?.product === "premium_bundle"
    ? session
    : null;
}
