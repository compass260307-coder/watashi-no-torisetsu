// 買い切りアクセス商品の共有定義。
// クライアント表示・Checkout・計測で同じ商品キーと価格を使う。

export const ACCESS_PRODUCTS = [
  "self_report",
  "full_access",
  "premium_bundle",
] as const;

// 日本版・韓国版は、自己・友達・相性・運命の設計図・Alice 30回答・タロットを
// 含む完全版の単一オファー。旧商品の定義は過去購入の権利互換用に維持する。
// 商品構成テストの識別子。過去バージョンは履歴の解釈と権利互換用に残すが、
// 新規Checkoutは現行バージョン以外を受理しない。
// カード表示 → CTA → Stripe → 決済完了まで同じ値を引き継ぎ、
// 以前の価格テストと混ぜずに効果を測る。
export const THREE_COURSE_PAYWALL_VERSION =
  "legacy_card_v42_ja_full_599_release_1290_measurement_v3" as const;
export const EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION_V1 =
  "en_single_full_access_v1_jpy_499" as const;
export const EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION_V2 =
  "en_single_full_access_v2_usd_499" as const;
export const EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION =
  "en_single_full_access_v3_usd_499_release_1290_list" as const;
export const ID_SINGLE_FULL_ACCESS_PAYWALL_VERSION =
  "id_single_full_access_v1_idr_49000_release_129000_list" as const;
export const KO_SINGLE_FULL_ACCESS_PAYWALL_VERSION =
  "ko_single_full_access_v1_krw_4900_release_12900_list" as const;
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
  "legacy_card_v31_full_499_aisho_destiny_alice30_tarot_student_299",
  "legacy_card_v32_full_899_aisho_destiny_alice30_tarot_student_299",
  "legacy_card_v33_full_899_aisho_destiny_alice30_tarot_student_499",
  "legacy_card_v34_full_899_student_499_aisho_included",
  "legacy_card_v35_ja_full_499_single",
  "legacy_card_v36_ja_full_899_single_no_discount",
  "legacy_card_v37_ja_full_499_single_no_discount",
  "legacy_card_v38_ja_full_699_single_no_discount",
  "legacy_card_v39_ja_full_699_release_1290_list",
  "legacy_card_v40_ja_full_499_single_no_discount",
  "legacy_card_v40_ja_full_499_release_1290_list",
  THREE_COURSE_PAYWALL_VERSION,
  EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION_V1,
  EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION_V2,
  EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION,
  ID_SINGLE_FULL_ACCESS_PAYWALL_VERSION,
  KO_SINGLE_FULL_ACCESS_PAYWALL_VERSION,
] as const;
export const MULTI_COURSE_PAYWALL_PRODUCT = "multi_course" as const;
export const SINGLE_ALL_ACCESS_PAYWALL_PRODUCT =
  "single_all_access" as const;

// 日本版でCheckoutを作成できる商品。新規販売は full_access のみ。
// premium_bundle は旧購入からのアップグレード互換用に残す。
export const CURRENT_JA_ACCESS_PRODUCTS = [
  "full_access",
  "premium_bundle",
] as const satisfies readonly AccessProduct[];

// 韓国版で新しいCheckoutを作成できる商品。2026-09-19以降は完全版のみ。
// self_report / premium_bundle は過去購入の権利復元・返金・監査用に残す。
export const CURRENT_KO_ACCESS_PRODUCTS = [
  "full_access",
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

// 2026-09-07〜09-14 の Webhook は Checkout の tarot_access_policy を
// payment_history.metadata へ転記できていなかった。該当期間に販売した完全版だけを
// 明示的に列挙し、既存購入者の権利をコード反映だけで復元する。
// 旧販売世代を広く解放しないよう、正規表現やバージョン番号の範囲判定は使わない。
const FULL_ACCESS_TAROT_RECOVERY_PAYWALL_VERSIONS = new Set<string>([
  "legacy_card_v30_full_499_destiny_alice30_tarot_student_299",
  "legacy_card_v31_full_499_aisho_destiny_alice30_tarot_student_299",
  "legacy_card_v32_full_899_aisho_destiny_alice30_tarot_student_299",
  "legacy_card_v33_full_899_aisho_destiny_alice30_tarot_student_499",
  "legacy_card_v34_full_899_student_499_aisho_included",
  "legacy_card_v35_ja_full_499_single",
  "legacy_card_v36_ja_full_899_single_no_discount",
  "legacy_card_v37_ja_full_499_single_no_discount",
  "legacy_card_v38_ja_full_699_single_no_discount",
  "legacy_card_v39_ja_full_699_release_1290_list",
  "legacy_card_v40_ja_full_499_single_no_discount",
  THREE_COURSE_PAYWALL_VERSION,
  EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION_V1,
  EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION_V2,
  EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION,
  ID_SINGLE_FULL_ACCESS_PAYWALL_VERSION,
  KO_SINGLE_FULL_ACCESS_PAYWALL_VERSION,
]);

// 友達機能を含まない旧 self_report 世代の印。
// 販売当時の日韓学生プランは友達機能を含む。値が無い旧購入は購入時の権利を維持する。
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

// 2026-09-10: 日本語版の学生向けプランにも相性診断を追加。
// 旧学生プランや韓国語版の販売条件と区別し、購入時の権利を維持する。
export const AISHO_ACCESS_POLICY_LITE_INCLUDED =
  "lite_included_v3" as const;

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
  paywallVersion?: unknown,
): boolean {
  if (product === "premium_bundle") return true;
  if (product !== "full_access") return false;
  if (policy === TAROT_ACCESS_POLICY_FULL_INCLUDED) return true;
  // 明示的な非対象ポリシーは販売世代より優先する。復元するのは、Webhook の
  // 転記漏れで policy 自体が存在しない既知の完全版購入だけ。
  if (policy !== undefined && policy !== null) return false;
  return (
    typeof paywallVersion === "string" &&
    FULL_ACCESS_TAROT_RECOVERY_PAYWALL_VERSIONS.has(paywallVersion)
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
  if (
    product === "self_report" &&
    policy === AISHO_ACCESS_POLICY_LITE_INCLUDED
  ) {
    return true;
  }
  return policy !== AISHO_ACCESS_POLICY_PREMIUM_ONLY;
}

// 日本版の現行価格。新規販売は相性診断も含む完全版 ¥599 のみ。
// self_report と全部入りは過去購入・アップグレード互換用に価格定義を維持する。
export const SELF_REPORT_LIST_PRICE_JPY = 499;
export const SELF_REPORT_PRICE_JPY = 499;
// 2026-09-20 21:12 JSTから、完全版は通常価格 ¥1,290 から
// 「リリース記念」¥691引きを表示し、実際の請求額を ¥599 とする。
export const FULL_ACCESS_PRICE_EFFECTIVE_AT =
  "2026-09-20T21:12:00+09:00" as const;
export const FULL_ACCESS_LIST_PRICE_JPY = 1290;
export const FULL_ACCESS_PRICE_JPY = 599;
export const PREMIUM_BUNDLE_LIST_PRICE_JPY = 1980;
export const PREMIUM_BUNDLE_PRICE_JPY = 1299;
// 旧完全版からのアップグレード価格。新規完全版の価格テストとは独立させる。
export const PREMIUM_BUNDLE_FULL_UPGRADE_PRICE_JPY = 800;
// 2026-09-21に明示承認された、診断結果購入者向けの結果アップグレード。
// 他のpremium_bundle互換導線と混ぜず、paywall_sourceが専用導線のときだけ使う。
export const RESULT_UPGRADE_PRICE_JPY = 899;
export const RESULT_UPGRADE_OFFER_VERSION =
  "result_upgrade_v1_jpy_899" as const;

// 韓国版の新規販売は完全版のみ。旧 self_report / premium_bundle の価格は、
// 過去購入者の差額・返金・監査互換のために保持する。KRW は Stripe 上も
// zero-decimal currency なので、ここではウォンの整数をそのまま保持する。
export const SELF_REPORT_LIST_PRICE_KRW = 4900;
export const SELF_REPORT_PRICE_KRW = 1900;
export const FULL_ACCESS_LIST_PRICE_KRW = 12900;
export const FULL_ACCESS_PRICE_KRW = 4900;
export const PREMIUM_BUNDLE_LIST_PRICE_KRW = 19800;
// 韓国版プレミアムの現行価格。旧価格は ₩12,900。
export const PREMIUM_BUNDLE_PRICE_KRW = 8900;
// 英語版は完全版のみを、通常価格 $12.90 から Release offer $7.91引き、
// 米国向け $4.99 で販売する。
// 学生向け・プレミアムは英語版では提供せず、Checkout API 側でも拒否する。
// Stripe の USD 金額は最小通貨単位（cent）で保持する。
export const EN_FULL_ACCESS_LIST_PRICE_USD_CENTS = 1290;
export const EN_FULL_ACCESS_PRICE_USD_CENTS = 499;
// インドネシア版は通常価格 Rp129.000 から Rp80.000引き、Rp49.000で販売する。
// StripeではIDRが2桁小数通貨として扱われるため、最小単位（1/100ルピア）で保持する。
export const ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR = 12_900_000;
export const ID_FULL_ACCESS_PRICE_IDR_MINOR = 4_900_000;
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
 * 日本版のサーバ確定価格。新規販売は完全版のみ。
 * self_report / premium_bundle は過去購入との互換用に計算を維持する。
 * クライアント表示にも使うが、Stripeへ渡す金額は必ずCheckout側で再計算する。
 */
export function accessProductPriceJpy(
  product: AccessProduct,
  entitlements: AccessEntitlements,
): number {
  if (product === "self_report") return SELF_REPORT_PRICE_JPY;
  if (product === "full_access") {
    // 廃止した self_report からの新規差額販売は行わない。完全版は常に現行価格。
    return FULL_ACCESS_PRICE_JPY;
  }
  if (entitlements.full) {
    return PREMIUM_BUNDLE_FULL_UPGRADE_PRICE_JPY;
  }
  if (entitlements.selfReport) {
    return PREMIUM_BUNDLE_PRICE_JPY - SELF_REPORT_PRICE_JPY;
  }
  return PREMIUM_BUNDLE_PRICE_JPY;
}

/** 韓国版のサーバ確定価格。旧購入から完全版への移行時だけ購入済み額を差し引く。 */
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
  locale: "ja" | "ko" | "en" | "id",
  product: AccessProduct,
  entitlements: AccessEntitlements,
): number {
  if (locale === "en") return EN_FULL_ACCESS_PRICE_USD_CENTS;
  if (locale === "id") return ID_FULL_ACCESS_PRICE_IDR_MINOR;
  return locale === "ko"
    ? accessProductPriceKrw(product, entitlements)
    : accessProductPriceJpy(product, entitlements);
}

export function formatIdrMinor(amountMinor: number): string {
  return `Rp${(amountMinor / 100).toLocaleString("id-ID")}`;
}

export function accessPaywallVersionForLocale(
  locale: "ja" | "ko" | "en" | "id",
): ThreeCoursePaywallVersion {
  if (locale === "en") return EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION;
  if (locale === "id") return ID_SINGLE_FULL_ACCESS_PAYWALL_VERSION;
  if (locale === "ko") return KO_SINGLE_FULL_ACCESS_PAYWALL_VERSION;
  return THREE_COURSE_PAYWALL_VERSION;
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

export function isCurrentKoreanAccessProduct(
  value: AccessProduct,
): value is (typeof CURRENT_KO_ACCESS_PRODUCTS)[number] {
  return (CURRENT_KO_ACCESS_PRODUCTS as readonly AccessProduct[]).includes(
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
