// 買い切りアクセス商品の共有定義。
// クライアント表示・Checkout・計測で同じ商品キーと価格を使う。

export const ACCESS_PRODUCTS = [
  "self_report",
  "full_access",
  "premium_bundle",
] as const;

// 2026-08-12 に日本版を ¥199 / ¥499 / ¥899 へロールバック。
// 3コース価格テストの識別子。旧価格のクライアントも引き続き
// Checkout で受け付けられるよう、過去バージョンは許可リストに残す。
// カード表示 → CTA → Stripe → 決済完了まで同じ値を引き継ぎ、
// 以前の価格テストと混ぜずに効果を測る。
export const THREE_COURSE_PAYWALL_VERSION =
  "three_course_v7_self_friend_access" as const;
export const THREE_COURSE_PAYWALL_VERSIONS = [
  "three_course_v1",
  "three_course_v2_no_images",
  "three_course_v3_price_badge",
  "three_course_v4_jpy_499_799_1290",
  "three_course_v5_jpy_199_499_899",
  "three_course_v6_unmei_chat_credits",
  THREE_COURSE_PAYWALL_VERSION,
] as const;
export const MULTI_COURSE_PAYWALL_PRODUCT = "multi_course" as const;

export type PaywallPlacement = "inline" | "modal";

export type AccessProduct = (typeof ACCESS_PRODUCTS)[number];
export type ThreeCoursePaywallVersion =
  (typeof THREE_COURSE_PAYWALL_VERSIONS)[number];

export const SELF_REPORT_LIST_PRICE_JPY = 799;
export const SELF_REPORT_PRICE_JPY = 199;
export const FULL_ACCESS_LIST_PRICE_JPY = 1290;
export const FULL_ACCESS_PRICE_JPY = 499;
export const PREMIUM_BUNDLE_LIST_PRICE_JPY = 1980;
export const PREMIUM_BUNDLE_PRICE_JPY = 899;

// 韓国版も日本版と同じ3段階の解放範囲を持つ。KRW は Stripe 上も
// zero-decimal currency なので、ここではウォンの整数をそのまま保持する。
export const SELF_REPORT_LIST_PRICE_KRW = 4900;
export const SELF_REPORT_PRICE_KRW = 1900;
export const FULL_ACCESS_LIST_PRICE_KRW = 12900;
export const FULL_ACCESS_PRICE_KRW = 4900;
export const PREMIUM_BUNDLE_LIST_PRICE_KRW = 19800;
export const PREMIUM_BUNDLE_PRICE_KRW = 12900;
export const SELF_REPORT_DISCOUNT_PERCENT = Math.round(
  (1 - SELF_REPORT_PRICE_JPY / SELF_REPORT_LIST_PRICE_JPY) * 100,
);
export const FULL_ACCESS_DISCOUNT_PERCENT = Math.round(
  (1 - FULL_ACCESS_PRICE_JPY / FULL_ACCESS_LIST_PRICE_JPY) * 100,
);
export const PREMIUM_BUNDLE_DISCOUNT_PERCENT = Math.round(
  (1 - PREMIUM_BUNDLE_PRICE_JPY / PREMIUM_BUNDLE_LIST_PRICE_JPY) * 100,
);
export const SELF_REPORT_DISCOUNT_PERCENT_KRW = Math.round(
  (1 - SELF_REPORT_PRICE_KRW / SELF_REPORT_LIST_PRICE_KRW) * 100,
);
export const FULL_ACCESS_DISCOUNT_PERCENT_KRW = Math.round(
  (1 - FULL_ACCESS_PRICE_KRW / FULL_ACCESS_LIST_PRICE_KRW) * 100,
);
export const PREMIUM_BUNDLE_DISCOUNT_PERCENT_KRW = Math.round(
  (1 - PREMIUM_BUNDLE_PRICE_KRW / PREMIUM_BUNDLE_LIST_PRICE_KRW) * 100,
);
export const SELF_REPORT_UNLOCK_LABEL = `¥${SELF_REPORT_PRICE_JPY}で完全解放`;

export type AccessEntitlements = Readonly<{
  selfReport: boolean;
  full: boolean;
  premiumBundle: boolean;
}>;

export const EMPTY_ACCESS_ENTITLEMENTS: AccessEntitlements = {
  selfReport: false,
  full: false,
  premiumBundle: false,
};

/**
 * 日本版3コースのサーバ確定価格。
 * クライアント表示にも使うが、Stripeへ渡す金額は必ずCheckout側で再計算する。
 */
export function accessProductPriceJpy(
  product: AccessProduct,
  entitlements: AccessEntitlements,
): number {
  if (product === "self_report") return SELF_REPORT_PRICE_JPY;
  if (product === "full_access") {
    return entitlements.selfReport
      ? FULL_ACCESS_PRICE_JPY - SELF_REPORT_PRICE_JPY
      : FULL_ACCESS_PRICE_JPY;
  }
  if (entitlements.full) {
    return PREMIUM_BUNDLE_PRICE_JPY - FULL_ACCESS_PRICE_JPY;
  }
  if (entitlements.selfReport) {
    return PREMIUM_BUNDLE_PRICE_JPY - SELF_REPORT_PRICE_JPY;
  }
  return PREMIUM_BUNDLE_PRICE_JPY;
}

/** 韓国版3コースのサーバ確定価格。購入済みコース分は差し引く。 */
export function accessProductPriceKrw(
  product: AccessProduct,
  entitlements: AccessEntitlements,
): number {
  if (product === "self_report") return SELF_REPORT_PRICE_KRW;
  if (product === "full_access") {
    return entitlements.selfReport
      ? FULL_ACCESS_PRICE_KRW - SELF_REPORT_PRICE_KRW
      : FULL_ACCESS_PRICE_KRW;
  }
  if (entitlements.full) {
    return PREMIUM_BUNDLE_PRICE_KRW - FULL_ACCESS_PRICE_KRW;
  }
  if (entitlements.selfReport) {
    return PREMIUM_BUNDLE_PRICE_KRW - SELF_REPORT_PRICE_KRW;
  }
  return PREMIUM_BUNDLE_PRICE_KRW;
}

export function accessProductPrice(
  locale: "ja" | "ko",
  product: AccessProduct,
  entitlements: AccessEntitlements,
): number {
  return locale === "ko"
    ? accessProductPriceKrw(product, entitlements)
    : accessProductPriceJpy(product, entitlements);
}

export function isAccessProduct(value: unknown): value is AccessProduct {
  return (
    typeof value === "string" &&
    (ACCESS_PRODUCTS as readonly string[]).includes(value)
  );
}

export function isThreeCoursePaywallVersion(
  value: unknown,
): value is ThreeCoursePaywallVersion {
  return (
    typeof value === "string" &&
    (THREE_COURSE_PAYWALL_VERSIONS as readonly string[]).includes(value)
  );
}
