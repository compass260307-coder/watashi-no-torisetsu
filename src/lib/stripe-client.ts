// クライアント側 Stripe.js のローダー (Embedded Checkout 用・2026-08-06)。
// /unmei のチャット内決済でのみ使う。publishable key が未設定なら null を返し、
// 呼び出し側は従来のリダイレクト型 Checkout にフォールバックできる (安全側)。

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripeClient(): Promise<Stripe | null> | null {
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!pk) return null;
  if (!stripePromise) stripePromise = loadStripe(pk);
  return stripePromise;
}
