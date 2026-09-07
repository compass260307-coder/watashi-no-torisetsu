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
  "three_course_v10_full_hoshiyomi" as const;
export const THREE_COURSE_PAYWALL_VERSIONS = [
  "three_course_v1",
  "three_course_v2_no_images",
  "three_course_v3_price_badge",
  "three_course_v4_jpy_499_799_1290",
  "three_course_v5_jpy_199_499_899",
  "three_course_v6_unmei_chat_credits",
  "three_course_v7_self_friend_access",
  "three_course_v8_premium_destiny_only",
  "three_course_v9_self_report_only",
  THREE_COURSE_PAYWALL_VERSION,
] as const;
export const MULTI_COURSE_PAYWALL_PRODUCT = "multi_course" as const;

// この値が付いた購入以降、「運命の設計図」は premium_bundle だけに含める。
// 値が無い旧 full_access は購入時の権利を維持する。
// (占い師チャットは 2026-08-16 に全世代の完全版へ遡及付与したため、
//  ポリシー印に関係なく purchaseIncludesHoshiyomiChat で判定する。)
export const DESTINY_ACCESS_POLICY_PREMIUM_ONLY =
  "premium_only_v1" as const;

// 2026-08-16: ¥499 完全版に AI占い師チャットを追加した世代の印。
// 設計図の扱いは v1 と同じ (プレミアム限定)。どの商品内容で売れたかの監査用。
export const DESTINY_ACCESS_POLICY_PREMIUM_ONLY_HOSHIYOMI_FULL =
  "premium_only_v2_hoshiyomi_full" as const;

// AI占い師チャットの付与回数 (累計保証値)。webhook・復元・表示コピーで共有する。
export const HOSHIYOMI_CHAT_CREDITS_FULL_ACCESS = 5;
export const HOSHIYOMI_CHAT_CREDITS_PREMIUM_BUNDLE = 30;
export const HOSHIYOMI_CHAT_POLICY_FULL_ALL_INCLUDED =
  "full_all_included_v2" as const;

// タロットは、この販売世代の完全版とプレミアムにだけ含める。
// 古い完全版を商品定義の変更だけで遡及解放しないため、明示的な印を使う。
export const TAROT_ACCESS_POLICY_FULL_INCLUDED = "full_included_v1" as const;

// この値が付いた購入以降、2人目以降の友達診断と友達診断PDFは
// full_access 以上だけに含める。値が無い旧 self_report は購入時の権利を維持する。
export const FRIEND_ACCESS_POLICY_FULL_ONLY = "full_only_v1" as const;

export type PaywallPlacement = "inline" | "modal";

export type AccessProduct = (typeof ACCESS_PRODUCTS)[number];
export type ThreeCoursePaywallVersion =
  (typeof THREE_COURSE_PAYWALL_VERSIONS)[number];

export function purchaseIncludesDestinyFeatures(
  product: AccessProduct,
  policy: unknown,
): boolean {
  if (product === "premium_bundle") return true;
  if (product !== "full_access") return false;
  // マーカー無しの旧完全版だけが設計図つき。v1 / v2 はプレミアム限定。
  return (
    policy !== DESTINY_ACCESS_POLICY_PREMIUM_ONLY &&
    policy !== DESTINY_ACCESS_POLICY_PREMIUM_ONLY_HOSHIYOMI_FULL
  );
}

/**
 * AI占い師チャットが購入に含まれるか。設計図 (destiny) とは独立に判定する。
 *
 * 完全版はポリシー印を問わず全世代チャット対象 (5回)。v8〜v9 期の完全版は
 * 印上チャット対象外だったが、/hoshiyomi の FAQ が「完全版=5回」と案内済み
 * だったため、過去購入分にも遡及して含める (2026-08-16)。
 * policy 引数は将来また世代分けが必要になったときのために受け取っておく。
 */
export function purchaseIncludesHoshiyomiChat(
  product: AccessProduct,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _policy: unknown,
): boolean {
  return product === "premium_bundle" || product === "full_access";
}

/** 購入世代ごとに保証するAliceの累計回答数。 */
export function hoshiyomiChatCreditTarget(
  product: AccessProduct,
  policy: unknown,
): number {
  if (product === "premium_bundle") {
    return HOSHIYOMI_CHAT_CREDITS_PREMIUM_BUNDLE;
  }
  if (product !== "full_access") return 0;
  return policy === HOSHIYOMI_CHAT_POLICY_FULL_ALL_INCLUDED
    ? HOSHIYOMI_CHAT_CREDITS_PREMIUM_BUNDLE
    : HOSHIYOMI_CHAT_CREDITS_FULL_ACCESS;
}

export function purchaseIncludesTarotFeatures(
  product: AccessProduct,
  policy: unknown,
): boolean {
  if (product === "premium_bundle") return true;
  return (
    product === "full_access" &&
    policy === TAROT_ACCESS_POLICY_FULL_INCLUDED
  );
}

export function purchaseIncludesFriendFeatures(
  product: AccessProduct,
  policy: unknown,
): boolean {
  if (product === "full_access" || product === "premium_bundle") return true;
  return product === "self_report" && policy !== FRIEND_ACCESS_POLICY_FULL_ONLY;
}

// 高いコースほど割引率が高くなるよう、日本版の通常価格を
// ¥299 / ¥899 / ¥1,980（33% / 44% / 55%OFF）に揃える。
export const SELF_REPORT_LIST_PRICE_JPY = 299;
export const SELF_REPORT_PRICE_JPY = 199;
export const FULL_ACCESS_LIST_PRICE_JPY = 899;
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
// 日本版 ¥899 と実質同水準に揃える (下位2コースと同じ「JPY×10」の桁パターン。
// 55%OFF 表示も日本版と一致する)。旧価格は ₩12,900。
export const PREMIUM_BUNDLE_PRICE_KRW = 8900;
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
