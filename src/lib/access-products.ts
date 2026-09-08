// 買い切りアクセス商品の共有定義。
// クライアント表示・Checkout・計測で同じ商品キーと価格を使う。

export const ACCESS_PRODUCTS = [
  "self_report",
  "full_access",
  "premium_bundle",
] as const;

// 2026-08-31 に日本版・韓国版を旧カードデザインの2オファーへ変更。
// 主商品は「完全版 ¥499（自己・友達・相性・運命の設計図・Alice 30回答・タロット）」、
// 学生向けは「¥299（自己診断・友達診断）」として販売する。
// 商品構成テストの識別子。過去バージョンは履歴の解釈と権利互換用に残すが、
// 新規Checkoutは現行バージョン以外を受理しない。
// カード表示 → CTA → Stripe → 決済完了まで同じ値を引き継ぎ、
// 以前の価格テストと混ぜずに効果を測る。
export const THREE_COURSE_PAYWALL_VERSION =
  "legacy_card_v31_full_499_aisho_destiny_alice30_tarot_student_299" as const;
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
  "three_course_v10_full_hoshiyomi",
  "three_course_v11_full_1290",
  "three_course_v12_full_1299",
  "three_course_v13_student_lite_499",
  "three_course_v14_full_899",
  "three_course_v15_student_lite_299",
  "two_course_v16_full_destiny_899",
  "two_course_v17_full_destiny_499_release",
  "three_course_v18_jpy_499_899_1299_release",
  "three_course_v19_jpy_199_499_899_release",
  "three_course_v20_aisho_premium_only",
  "three_course_v21_jpy_299_499_899_aisho_premium_only",
  "three_course_v23_jpy_499_899_1290_light_ebook_full_aisho",
  "three_course_v24_jpy_499_899_1290_light_ebook_tako_pdf_full_aisho",
  "three_course_v25_jpy_499_899_1290_premium_summary",
  "three_course_v26_jpy_199_499_899_alice_premium",
  "single_all_v27_jpy_899_student_299",
  "legacy_card_v28_full_899_student_299_friend",
  "legacy_card_v29_full_499_student_299_friend_no_discount_copy",
  "legacy_card_v30_full_499_destiny_alice30_tarot_student_299",
  THREE_COURSE_PAYWALL_VERSION,
] as const;
export const MULTI_COURSE_PAYWALL_PRODUCT = "multi_course" as const;
export const SINGLE_ALL_ACCESS_PAYWALL_PRODUCT =
  "single_all_access" as const;

// 日本版でCheckoutを作成できる商品。メイン課金カードでは full_access と
// self_report を販売する。premium_bundle は旧購入からのアップグレード互換用に残す。
export const CURRENT_JA_ACCESS_PRODUCTS = [
  "full_access",
  "self_report",
  "premium_bundle",
] as const satisfies readonly AccessProduct[];

// 「運命の設計図は premium_bundle だけ」という販売世代の監査印。
// 現行の松竹梅カードでも完全版とプレミアムの権利差を記録するために使う。
// (占い師チャットは 2026-08-16 に全世代の完全版へ遡及付与したため、
//  ポリシー印に関係なく purchaseIncludesHoshiyomiChat で判定する。)
export const DESTINY_ACCESS_POLICY_PREMIUM_ONLY =
  "premium_only_v1" as const;

// 2026-08-16: 完全版に AI占い師チャットを追加した世代の印。
// 設計図の扱いは v1 と同じ (プレミアム限定)。どの商品内容で売れたかの監査用。
export const DESTINY_ACCESS_POLICY_PREMIUM_ONLY_HOSHIYOMI_FULL =
  "premium_only_v2_hoshiyomi_full" as const;

// 2026-08-23の2コース期に、完全版へ運命の設計図を統合した販売世代の印。
// 現行カードへ切り替えた後も、既存購入の権利を維持するため残す。
export const DESTINY_ACCESS_POLICY_FULL_INCLUDED =
  "full_included_v3" as const;

// 2026-08-29販売世代の日本版完全版は、Aliceの価値を体験できる1回答だけを付与した。
// 旧完全版の5回を含め、各購入世代の回数は購入時の権利として維持する。
export const HOSHIYOMI_CHAT_POLICY_PREMIUM_ONLY_FULL_TRIAL =
  "premium_only_full_trial_v1" as const;
// 2026-08-31: 現行の日本版完全版にAliceの最大30回答枠を統合。
export const HOSHIYOMI_CHAT_POLICY_FULL_ALL_INCLUDED =
  "full_all_included_v2" as const;
export const HOSHIYOMI_CHAT_CREDITS_FULL_TRIAL = 1;
// AI占い師チャットの付与回数 (累計保証値)。webhook・復元・表示コピーで共有する。
export const HOSHIYOMI_CHAT_CREDITS_FULL_ACCESS = 5;
export const HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS = 30;
export const HOSHIYOMI_CHAT_CREDITS_PREMIUM_BUNDLE =
  HOSHIYOMI_CHAT_CREDITS_CURRENT_FULL_ACCESS;

// タロットは現行の日本版完全版と premium_bundle に含める。
// 学生向けと旧販売世代を誤って解放しないよう、購入時metadataへ明示する。
export const TAROT_ACCESS_POLICY_FULL_ONLY = "full_only_v1" as const;
export const TAROT_ACCESS_POLICY_FULL_INCLUDED = "full_included_v1" as const;

// 友達機能を含まない旧 self_report 世代の印。
// 現行の日韓学生プランは友達機能を含む。値が無い旧購入は購入時の権利を維持する。
export const FRIEND_ACCESS_POLICY_FULL_ONLY = "full_only_v1" as const;

// 2026-08-21: 日本版の学生向けライトには、Alice以外の完全版機能を含める。
// 旧購入の無印を後方互換として扱うロジックとは分け、販売時の商品内容を明示する。
export const FRIEND_ACCESS_POLICY_LITE_INCLUDED =
  "lite_included_v1" as const;

// 2026-08-26: 新規販売の相性診断は premium_bundle 限定。
// マーカー無しの旧購入は、購入時に案内していた相性診断の権利を維持する。
export const AISHO_ACCESS_POLICY_PREMIUM_ONLY =
  "premium_only_v1" as const;

// 2026-08-28: 新規販売の日本版完全版に相性診断を含める。
// 旧 premium_only_v1 の購入行は購入時の権利を維持する。
export const AISHO_ACCESS_POLICY_FULL_INCLUDED =
  "full_included_v2" as const;

export type PaywallPlacement = "inline" | "modal";

export type AccessProduct = (typeof ACCESS_PRODUCTS)[number];
export type ThreeCoursePaywallVersion =
  (typeof THREE_COURSE_PAYWALL_VERSIONS)[number];

export function purchaseIncludesDestinyFeatures(
  product: AccessProduct,
  policy: unknown,
  // 呼び出し側の後方互換のため受け取る。新規権利は policy だけで判定する。
  _locale?: unknown,
): boolean {
  void _locale;
  if (product === "premium_bundle") return true;
  if (product !== "full_access") return false;
  // 2コース期に「設計図込み」で販売した完全版は、購入時の権利を維持する。
  if (policy === DESTINY_ACCESS_POLICY_FULL_INCLUDED) {
    return true;
  }
  // マーカー無しの旧完全版は購入時の権利を維持する。
  return (
    policy !== DESTINY_ACCESS_POLICY_PREMIUM_ONLY &&
    policy !== DESTINY_ACCESS_POLICY_PREMIUM_ONLY_HOSHIYOMI_FULL
  );
}

/**
 * AI占い師チャットが購入に含まれるか。設計図 (destiny) とは独立に判定する。
 *
 * 旧完全版は購入時の5回、2026-08-29販売世代は1回答を維持する。
 * 現行の日本版完全版と premium_bundle は30回。世代差はpolicyで判定する。
 */
export function purchaseIncludesHoshiyomiChat(
  product: AccessProduct,
  policy: unknown,
): boolean {
  return hoshiyomiChatCreditTarget(product, policy) > 0;
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
  if (policy === HOSHIYOMI_CHAT_POLICY_PREMIUM_ONLY_FULL_TRIAL) {
    return HOSHIYOMI_CHAT_CREDITS_FULL_TRIAL;
  }
  if (policy === HOSHIYOMI_CHAT_POLICY_FULL_ALL_INCLUDED) {
    return HOSHIYOMI_CHAT_CREDITS_PREMIUM_BUNDLE;
  }
  return HOSHIYOMI_CHAT_CREDITS_FULL_ACCESS;
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

export function purchaseIncludesAishoFeatures(
  product: AccessProduct,
  policy: unknown,
): boolean {
  if (product === "premium_bundle") return true;
  return policy !== AISHO_ACCESS_POLICY_PREMIUM_ONLY;
}

// 日本版の現行価格。主商品は相性診断も含む完全版 ¥499、
// 学生向けは自己診断＋友達診断 ¥299。
// 全部入りは旧購入からのアップグレード互換用に価格定義を維持する。
export const SELF_REPORT_LIST_PRICE_JPY = 499;
export const SELF_REPORT_PRICE_JPY = 299;
export const FULL_ACCESS_LIST_PRICE_JPY = 1299;
export const FULL_ACCESS_PRICE_JPY = 499;
export const PREMIUM_BUNDLE_LIST_PRICE_JPY = 1980;
export const PREMIUM_BUNDLE_PRICE_JPY = 1299;
// 完全版からプレミアムへの差額。既存購入からのアップグレードにも使う。
export const PREMIUM_BUNDLE_FULL_UPGRADE_PRICE_JPY =
  PREMIUM_BUNDLE_PRICE_JPY - FULL_ACCESS_PRICE_JPY;

// 韓国版の公開オファーは日本版と同じ「完全版＋学生向け」。KRW は Stripe 上も
// zero-decimal currency なので、ここではウォンの整数をそのまま保持する。
export const SELF_REPORT_LIST_PRICE_KRW = 4900;
export const SELF_REPORT_PRICE_KRW = 1900;
export const FULL_ACCESS_LIST_PRICE_KRW = 12900;
export const FULL_ACCESS_PRICE_KRW = 4900;
export const PREMIUM_BUNDLE_LIST_PRICE_KRW = 19800;
// 韓国版プレミアムの現行価格。旧価格は ₩12,900。
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
export const SELF_REPORT_UNLOCK_LABEL = "学生向けプランで開放";

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
 * 日本版のサーバ確定価格。メイン課金カードは学生向け / 完全版の2商品。
 * premium_bundle は相性・運命など専用面の上位商品として差額計算を維持する。
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
    return PREMIUM_BUNDLE_FULL_UPGRADE_PRICE_JPY;
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

export function isCurrentJapaneseAccessProduct(
  value: AccessProduct,
): value is (typeof CURRENT_JA_ACCESS_PRODUCTS)[number] {
  return (CURRENT_JA_ACCESS_PRODUCTS as readonly AccessProduct[]).includes(
    value,
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
