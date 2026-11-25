import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function read(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

// Documentation is excluded from Vercel uploads; CI still validates its offer row.
const commerceCatalog = existsSync(path.join(repositoryRoot, "docs/COMMERCE_CATALOG.md"))
  ? read("docs/COMMERCE_CATALOG.md")
  : null;
const catalogIncludes = (value) => commerceCatalog === null || commerceCatalog.includes(value);
const devResultUpgradeCheckout = read("src/app/api/dev/result-upgrade-checkout/route.ts");
const accessProducts = read("src/lib/access-products.ts");
const checkoutRoute = read(
  "src/app/api/checkout/create-full-access-session/route.ts",
);
const regionalPricing = read("src/lib/full-access-pricing.ts");
const friendPaywall = read(
  "src/components/result/FriendIndividualPaywall.tsx",
);
const commercePage = read("src/app/legal/commerce/page.tsx");
const indonesianCommercePage = read(
  "src/app/id/legal/commerce/page.tsx",
);
const koreanCommercePage = read("src/app/ko/legal/commerce/page.tsx");
const koreanTermsPage = read("src/app/ko/terms/page.tsx");
const indonesianPlans = read(
  "src/i18n/ui/messages/id.ts",
);
const fullAccessPromo = read(
  "src/i18n/ui/messages/id.ts",
);
const hoshiyomiCopy = read("src/i18n/hoshiyomi.ts");
const indonesianTermsPage = read("src/app/id/terms/page.tsx");
const emailTemplates = read("src/lib/email.ts");
const embeddedCheckout = read(
  "src/components/uranai/UnmeiEmbeddedCheckout.tsx",
);
const metaPurchase = read("src/lib/meta-purchase.ts");
const resultUpgradeCopy = read("src/i18n/result-upgrade.ts");
const resultUpgradeChat = read(
  "src/components/result-upgrade/ResultUpgradeChat.tsx",
);

const contractChecks = [
  { label: "Web and LINE result upgrades are JPY 1398 minus a JPY 499 coupon, billing JPY 899",
    valid: accessProducts.includes("export const LINE_RESULT_UPGRADE_LIST_PRICE_JPY = 1398;") &&
      accessProducts.includes("export const LINE_RESULT_UPGRADE_COUPON_JPY = 499;") &&
      checkoutRoute.includes("if (japaneseUpgradeCheckout && lineUpgradeCouponId)") &&
      checkoutRoute.includes("unit_amount: LINE_RESULT_UPGRADE_LIST_PRICE_JPY") &&
      catalogIncludes("`ja_line_result_upgrade_v2_1398_coupon499_20261021`") },
  { label: "Japanese Web upgrades require owner login and saved answers; LINE identity and JPY 899 preserved",
    valid: checkoutRoute.includes('const lineUpgradeCheckout = japaneseUpgradeCheckout && body.sales_channel === "line"') &&
      checkoutRoute.includes("if (isResultUpgradeCheckout) {") &&
      checkoutRoute.includes("session.id !== userId") &&
      checkoutRoute.includes("!normalizeResultUpgradeAnswers(upgrade?.answers)") &&
      accessProducts.includes("export const RESULT_UPGRADE_PRICE_JPY = 899;") &&
      checkoutRoute.includes('body.sales_channel === "line" ? await getLineResultUpgradeSession() : null') &&
      checkoutRoute.includes('if (lineUpgradeCheckout && (!lineBuyer || body.paywall_source !== "result_upgrade_after_answers"))') &&
      checkoutRoute.includes('lineUpgradeCheckout ? "/line/result-upgrade?paid=1') &&
      catalogIncludes("`ja_line_result_upgrade_v1_20261021`") },
  { label: "Korean purchaser-only upgrade freezes KRW 8,900 and its offer version",
    valid: accessProducts.includes("export const KO_RESULT_UPGRADE_PRICE_KRW = 8_900;") && accessProducts.includes('"result_upgrade_v1_krw_8900" as const') && (commerceCatalog === null || commerceCatalog.includes("| 購入者限定 | `premium_bundle` | 결과 업그레이드 | ₩8,900 |")) },
  { label: "Korean result upgrade requires saved answers and owner login",
    valid: checkoutRoute.includes('upgrade?.locale !== checkoutLocale || !normalizeResultUpgradeAnswers(upgrade?.answers)') && checkoutRoute.includes("session.id !== userId") && checkoutRoute.includes('!(product === "premium_bundle" && body.paywall_source === "result_upgrade_after_answers")') },
  {
    label: "Japanese full access reference price is JPY 1,299",
    valid: accessProducts.includes(
      "export const FULL_ACCESS_LIST_PRICE_JPY = 1299;",
    ),
  },
  {
    label: "Japanese full access checkout price is JPY 499",
    valid: accessProducts.includes(
      "export const FULL_ACCESS_PRICE_JPY = 499;",
    ),
  },
  {
    label: "Japanese full access price test (2026-11-22) bills JPY 699 from JPY 1,499 with the same JPY 800 coupon",
    valid:
      accessProducts.includes('"ja_full_access_price_test_699_v1_20261122" as const') &&
      accessProducts.includes("export const FULL_ACCESS_TEST_LIST_PRICE_JPY = 1499;") &&
      accessProducts.includes("export const FULL_ACCESS_TEST_PRICE_JPY = 699;") &&
      regionalPricing.includes("saleAmount: FULL_ACCESS_TEST_PRICE_JPY,") &&
      regionalPricing.includes("listAmount: FULL_ACCESS_TEST_LIST_PRICE_JPY,") &&
      catalogIncludes("`ja_full_access_price_test_699_v1_20261122`"),
  },
  {
    label: "Japanese full access price test shares one assignment between the quote and Checkout, and can be switched off",
    valid:
      read("src/lib/full-access-checkout-server.ts").includes('process.env.FULL_ACCESS_PRICE_TEST !== "off" && Date.now() < PRICE_TEST_END_MS') &&
      accessProducts.includes('export const FULL_ACCESS_PRICE_TEST_END_AT =\n  "2026-11-26T00:00:00+09:00" as const;') &&
      catalogIncludes("2026-11-26 0:00 JST") &&
      read("src/app/api/checkout/full-access-price/route.ts").includes("resolveJaFullAccessPriceAssignmentForRequest(request, ownerToken)") &&
      checkoutRoute.includes("resolveJaFullAccessPriceAssignment(buyer)") &&
      checkoutRoute.includes('"ja_full_access_checkout_plain_699_v2_20261124"') &&
      catalogIncludes("`ja_full_access_checkout_plain_699_v2_20261124`") &&
      commercePage.includes("FULL_ACCESS_TEST_PRICE_JPY.toLocaleString"),
  },
  {
    label: "Japanese full access bills JPY 699 for everyone after the price test ends (2026-11-25 decision), and can be put back to JPY 499",
    valid:
      read("src/lib/full-access-checkout-server.ts").includes('const STANDARD_699: JaFullAccessPriceAssignment = { arm: "test", enrolled: false };') &&
      read("src/lib/full-access-checkout-server.ts").includes('Date.now() >= PRICE_TEST_END_MS && process.env.FULL_ACCESS_JA_PRICE !== "499" ? STANDARD_699 : NOT_ENROLLED') &&
      catalogIncludes("#### 2026-11-25 日本語版完全版を全員 ¥699 にする") &&
      catalogIncludes("`FULL_ACCESS_JA_PRICE=499`"),
  },
  {
    label: "Japanese full access price test (2026-11-26) bills JPY 899 from JPY 1,699 with the same JPY 800 coupon for three days, and can be switched off",
    valid:
      accessProducts.includes('"ja_full_access_price_test_899_v1_20261126" as const') &&
      accessProducts.includes('export const FULL_ACCESS_PRICE_TEST_899_START_AT =\n  "2026-11-26T12:00:00+09:00" as const;') &&
      accessProducts.includes('export const FULL_ACCESS_PRICE_TEST_899_END_AT =\n  "2026-11-29T12:00:00+09:00" as const;') &&
      accessProducts.includes("export const FULL_ACCESS_TEST_899_LIST_PRICE_JPY = 1699;") &&
      accessProducts.includes("export const FULL_ACCESS_TEST_899_PRICE_JPY = 899;") &&
      regionalPricing.includes("saleAmount: FULL_ACCESS_TEST_899_PRICE_JPY,") &&
      regionalPricing.includes("listAmount: FULL_ACCESS_TEST_899_LIST_PRICE_JPY,") &&
      read("src/lib/full-access-checkout-server.ts").includes('process.env.FULL_ACCESS_PRICE_TEST_899 !== "off" && process.env.FULL_ACCESS_JA_PRICE !== "499" &&') &&
      read("src/lib/full-access-checkout-server.ts").includes("now >= PRICE_TEST_899_START_MS && now < PRICE_TEST_899_END_MS") &&
      checkoutRoute.includes('"ja_full_access_checkout_plain_899_v1_20261126"') &&
      checkoutRoute.includes("price_test_version: jaPriceAssignment.test.version, price_test_arm: jaPriceAssignment.test.arm") &&
      catalogIncludes("`ja_full_access_price_test_899_v1_20261126`") &&
      catalogIncludes("`ja_full_access_checkout_plain_899_v1_20261126`") &&
      catalogIncludes("2026-11-29 12:00 JST") &&
      catalogIncludes("`FULL_ACCESS_PRICE_TEST_899=off`") &&
      commercePage.includes("FULL_ACCESS_TEST_899_PRICE_JPY.toLocaleString"),
  },
  {
    label: "Japanese full access price change records its effective time",
    valid: accessProducts.includes(
      '"2026-09-21T10:02:00+09:00" as const',
    ),
  },
  {
    label: "Japanese full access measurement generation records the JPY 800 treasure coupon from JPY 1,299",
    valid: accessProducts.includes(
      '"legacy_card_v44_ja_full_499_treasure_coupon800_1299_list" as const',
    ),
  },
  {
    label: "English full access reference price is USD 12.90",
    valid: accessProducts.includes(
      "export const EN_FULL_ACCESS_LIST_PRICE_USD_CENTS = 1290;",
    ),
  },
  {
    label: "English full access checkout price is USD 4.99",
    valid: accessProducts.includes(
      "export const EN_FULL_ACCESS_PRICE_USD_CENTS = 499;",
    ),
  },
  {
    label: "English full access paywall version records the reference price",
    valid: accessProducts.includes(
      '"en_single_full_access_v3_usd_499_release_1290_list" as const',
    ),
  },
  {
    label: "Korean full access checkout price is KRW 4,900",
    valid: accessProducts.includes(
      "export const FULL_ACCESS_PRICE_KRW = 4900;",
    ),
  },
  {
    label: "Korean single-offer paywall version records the frozen offer",
    valid: accessProducts.includes(
      '"ko_single_full_access_v3_krw_4900_release_card_12900_list" as const',
    ),
  },
  {
    label: "Korean current checkout allowlist contains only full access",
    valid: accessProducts.includes(
      'export const CURRENT_KO_ACCESS_PRODUCTS = [\n  "full_access",\n] as const',
    ),
  },
  {
    label: "Checkout API rejects discontinued Korean products",
    valid: checkoutRoute.includes(
      'checkoutLocale === "ko" && !isCurrentKoreanAccessProduct(product)',
    ),
  },
  {
    label: "Korean Stripe Checkout derives pricing from shared constants",
    valid:
      regionalPricing.includes("listAmount: FULL_ACCESS_LIST_PRICE_KRW,") &&
      regionalPricing.includes(
        "FULL_ACCESS_LIST_PRICE_KRW - FULL_ACCESS_PRICE_KRW",
      ),
  },
  {
    label: "Stripe Checkout uses the frozen reference price",
    valid: regionalPricing.includes("listAmount: FULL_ACCESS_LIST_PRICE_JPY,"),
  },
  {
    label: "Stripe Checkout uses the frozen JPY 499 sale price",
    valid: regionalPricing.includes("saleAmount: FULL_ACCESS_PRICE_JPY,"),
  },
  {
    label: "Japanese full access Stripe Checkout shows JPY 499 directly without a coupon",
    valid:
      checkoutRoute.includes(
        'isStandardJapaneseCoursePurchase && product === "full_access";',
      ) &&
      checkoutRoute.includes("!usesPlainJapaneseFullAccessCheckout &&") &&
      checkoutRoute.includes(
        '"ja_full_access_checkout_plain_499_v2_20261124"',
      ) &&
      catalogIncludes("`ja_full_access_checkout_plain_499_v2_20261124`"),
  },
  {
    label: "English Stripe Checkout uses the frozen reference price",
    valid: regionalPricing.includes(
      "listAmount: EN_FULL_ACCESS_LIST_PRICE_USD_CENTS,",
    ),
  },
  {
    label: "English Stripe Checkout derives its fixed discount from shared constants",
    valid: regionalPricing.includes(
      "EN_FULL_ACCESS_LIST_PRICE_USD_CENTS - EN_FULL_ACCESS_PRICE_USD_CENTS",
    ),
  },
  {
    label: "Indonesian full access reference price is IDR 129,000",
    valid: accessProducts.includes(
      "export const ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR = 12_900_000;",
    ),
  },
  {
    label: "Indonesian full access checkout price is IDR 49,000",
    valid: accessProducts.includes(
      "export const ID_FULL_ACCESS_PRICE_IDR_MINOR = 4_900_000;",
    ),
  },
  {
    label: "Indonesian full access paywall version records the IDR offer",
    valid: accessProducts.includes(
      '"id_single_full_access_v1_idr_49000_release_129000_list" as const',
    ),
  },
  {
    label: "Indonesian Stripe Checkout uses IDR",
    valid: regionalPricing.includes(
      'id: {\n    currency: "idr",',
    ),
  },
  {
    label: "Indonesian Stripe Checkout uses the frozen IDR 129,000 reference price",
    valid: regionalPricing.includes(
      'id: {\n    currency: "idr",\n    saleAmount: ID_FULL_ACCESS_PRICE_IDR_MINOR,\n    listAmount: ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR,',
    ),
  },
  {
    label: "Indonesian Stripe Checkout derives the IDR 80,000 discount from shared constants",
    valid: regionalPricing.includes(
      "ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR - ID_FULL_ACCESS_PRICE_IDR_MINOR",
    ),
  },
  {
    label: "Indonesian public offer uses the shared IDR price constants",
    valid:
      indonesianPlans.includes("basePrice: ID_FULL_ACCESS_PRICE_IDR_MINOR,") &&
      indonesianPlans.includes("listPrice: ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR,"),
  },
  {
    label: "Indonesian promo card formats the reference and sale prices as rupiah",
    valid:
      fullAccessPromo.includes(
        "formatIdrMinor(ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR)",
      ) &&
      fullAccessPromo.includes(
        "formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR)",
      ),
  },
  {
    // Meta計測の撤去でクライアント側のvalue換算は消えたため、サーバ応答の
    // amount (checkout API) が IDR を major unit へ換算することを検証する。
    label: "Indonesian checkout analytics report IDR 49,000 in major units",
    valid:
      checkoutRoute.includes('checkoutPricing.currency === "idr"') &&
      checkoutRoute.includes("chargedAmount / 100"),
  },
  {
    label: "Indonesian Alice FAQ points to regional purchase pricing",
    valid: hoshiyomiCopy.includes(
      "Harga regional ditampilkan di layar pembelian",
    ),
  },
  {
    label: "Friend paywall displays the same quote it passes to Checkout",
    valid: friendPaywall.includes("formatFullAccessAmount(quote.market, quote.amountMinor)") &&
      friendPaywall.includes("priceState={priceState}"),
  },
  {
    label: "Commerce disclosure renders the shared price constant",
    valid: commercePage.includes("FULL_ACCESS_PRICE_JPY.toLocaleString"),
  },
  {
    label: "Indonesian commerce disclosure renders the shared IDR price constant",
    valid: indonesianCommercePage.includes(
      "formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR)",
    ),
  },
  {
    label: "Indonesian terms render the shared IDR price constant",
    valid: indonesianTermsPage.includes(
      "formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR)",
    ),
  },
  {
    label: "Korean commerce disclosure lists full access and the purchaser-only upgrade",
    valid:
      koreanCommercePage.includes("FULL_ACCESS_PRICE_KRW") &&
      koreanCommercePage.includes("KO_RESULT_UPGRADE_PRICE_KRW") &&
      !koreanCommercePage.includes("SELF_REPORT_PRICE_KRW") &&
      !koreanCommercePage.includes("PREMIUM_BUNDLE_PRICE_KRW"),
  },
  {
    label: "Korean terms list full access and the purchaser-only upgrade",
    valid:
      koreanTermsPage.includes("FULL_ACCESS_PRICE_KRW") &&
      koreanTermsPage.includes("KO_RESULT_UPGRADE_PRICE_KRW") &&
      !koreanTermsPage.includes("SELF_REPORT_PRICE_KRW") &&
      !koreanTermsPage.includes("PREMIUM_BUNDLE_PRICE_KRW"),
  },
  {
    label: "Indonesian purchase email renders IDR from Stripe minor units",
    valid:
      emailTemplates.includes("formatIdrMinor(price)") &&
      emailTemplates.includes("ID_FULL_ACCESS_PRICE_IDR_MINOR"),
  },
  {
    label: "Embedded Checkout offers PayPay only for the JPY market",
    valid: embeddedCheckout.includes('const supportsPayPay = needsQuote ? quote?.market === "ja" : locale === "ja";'),
  },
  {
    label: "Checkout API rejects PayPay outside the Japanese offer",
    valid: checkoutRoute.includes(
      'if (paypayRedirect && priceMarket !== "ja")',
    ),
  },
  {
    label: "Indonesian checkout metadata keeps the IDR minor amount explicit",
    valid: checkoutRoute.includes("course_price_idr_minor:"),
  },
  {
    label: "Purchase analytics fallback identifies the restored JPY 499 product",
    valid: metaPurchase.includes(
      'fallbackId: "full_access_jpy_499_restored_v43"',
    ),
  },
  {
    label: "Japanese result upgrade checkout price is JPY 899",
    valid: accessProducts.includes(
      "export const RESULT_UPGRADE_PRICE_JPY = 899;",
    ),
  },
  {
    label: "Result upgrade has a dedicated measurement version",
    valid: accessProducts.includes(
      '"result_upgrade_v1_jpy_899" as const',
    ),
  },
  {
    label: "Checkout API applies the dedicated result upgrade price",
    valid:
      checkoutRoute.includes(
        'paywallSource === "result_upgrade_after_answers"',
      ) &&
      /const resultUpgradePrice = checkoutLocale === "ko"\s*\? KO_RESULT_UPGRADE_PRICE_KRW\s*: RESULT_UPGRADE_PRICE_JPY/.test(checkoutRoute) &&
      /const effectivePrice = regionalQuote\?\.amountMinor \?\? \(isResultUpgradeCheckout\s*\? resultUpgradePrice/.test(checkoutRoute),
  },
  {
    label: "Result upgrade CTA does not duplicate the price in its label",
    valid:
      resultUpgradeCopy.includes('"cta": "結果をアップグレード"') && resultUpgradeChat.includes("{copy.cta}") &&
      !resultUpgradeChat.includes("¥800で結果をアップグレード") &&
      !resultUpgradeChat.includes("¥899で結果をアップグレード"),
  },
  {
    label: "Development result upgrade checkout uses the shared JPY 899 price",
    valid:
      devResultUpgradeCheckout.includes('from "@/lib/access-products"') &&
      devResultUpgradeCheckout.includes("unit_amount: LINE_RESULT_UPGRADE_LIST_PRICE_JPY") &&
      devResultUpgradeCheckout.includes("if (!couponId) return NextResponse.json") &&
      devResultUpgradeCheckout.includes("amount_off: LINE_RESULT_UPGRADE_COUPON_JPY") &&
      devResultUpgradeCheckout.includes('startsWith("sk_test_")'),
  },
  {
    label: "Commerce catalog records the JPY 899 result upgrade",
    valid:
      catalogIncludes("| 購入者限定 | `premium_bundle` | 結果アップグレード | ¥899 |") &&
      catalogIncludes("`result_upgrade_v1_jpy_899`"),
  },
];

const failures = contractChecks.filter(({ valid }) => !valid);

if (failures.length > 0) {
  console.error("Commerce catalog verification failed:");
  for (const { label } of failures) console.error(`- ${label}`);
  console.error(
    "The Japanese and English full access offers are frozen. Update the business decision and guard together only with explicit authorization.",
  );
  process.exit(1);
}

console.log(
  `Commerce catalog verified (${contractChecks.length} checks): Japanese full access is JPY 499 from JPY 1,299 and the purchaser-only result upgrade is JPY 899; Korean full access is KRW 4,900 and the purchaser-only result upgrade is KRW 8,900; Indonesian full access is IDR 49,000 from IDR 129,000; English full access is USD 4.99 from USD 12.90.`,
);
