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
      // apiVersion を省略すると、インストール済み Stripe SDK の既定バージョンを使う。
      // 互換性検証済みの別バージョンへ固定するときだけ明示する。
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

// unmei: ¥899 / ¥400 の Price ID を環境変数で受ける (2026-08-08 価格改定。
// 旧価格 ¥1,980/¥1,480 の STRIPE_PRICE_UNMEI_1980/1480 は Vercel/ライブStripeに残置)。
// Stripe ダッシュボードで Price を作成し、それぞれを以下の環境変数に登録する。
// - STRIPE_PRICE_UNMEI_899
// - STRIPE_PRICE_UNMEI_400
// セール価格 ¥299 の STRIPE_PRICE_UNMEI_299 も Vercel/ライブStripeに作成済み
// (2026-07-28 に一時利用)。再セール時は両分岐をこれに向け、saleJpy と表示も揃える。
export function getUnmeiPriceId(product: "unmei" | "unmei_upgrade"): string | null {
  if (product === "unmei") {
    return process.env.STRIPE_PRICE_UNMEI_899 ?? null;
  }
  return process.env.STRIPE_PRICE_UNMEI_400 ?? null;
}
