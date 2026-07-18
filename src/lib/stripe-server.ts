// Stripe SDK サーバサイドクライアント (lazy init)
//
// STRIPE_SECRET_KEY が未設定の環境 (Vercel build cold start や開発初期) でも
// モジュール評価でクラッシュしないよう lazy 初期化。
// 各 API ルートで getStripe() を呼んで null check してから使う。

import Stripe from "stripe";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not configured");
    this.name = "StripeNotConfiguredError";
  }
}

let cachedStripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cachedStripe) {
    cachedStripe = new Stripe(key, {
      // apiVersion を省略すると Stripe アカウントのダッシュボード設定値を使用。
      // 個別ピン留めしたい場合はここで指定する。
      typescript: true,
    });
  }
  return cachedStripe;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) throw new StripeNotConfiguredError();
  return stripe;
}

// 統合トリセツ 1 回分の Price ID。テスト用と本番用は env で切替。
export function getPremiumPriceId(): string | null {
  return process.env.STRIPE_PRICE_ID ?? null;
}

// フルアクセス (買い切り) のロケール別 Price ID。
// 日本版 ¥499 は STRIPE_PRICE_FULL_ACCESS、韓国版 ₩4,900 は
// STRIPE_PRICE_FULL_ACCESS_KRW に分離し、通貨の取り違えを防ぐ。
export function getFullAccessPriceId(locale: "ja" | "ko" = "ja"): string | null {
  return locale === "ko"
    ? process.env.STRIPE_PRICE_FULL_ACCESS_KRW ?? null
    : process.env.STRIPE_PRICE_FULL_ACCESS ?? null;
}
