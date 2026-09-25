import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function read(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

const accessProducts = read("src/lib/access-products.ts");
const checkoutRoute = read(
  "src/app/api/checkout/create-full-access-session/route.ts",
);
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
  "src/components/result/SelfAccessPlanCarousel.tsx",
);
const fullAccessPromo = read(
  "src/components/result/FullAccessPromoCard.tsx",
);
const fullAccessCta = read("src/components/result/FullAccessCta.tsx");
const hoshiyomiCopy = read("src/i18n/hoshiyomi.ts");
const indonesianTermsPage = read("src/app/id/terms/page.tsx");
const emailTemplates = read("src/lib/email.ts");
const embeddedCheckout = read(
  "src/components/uranai/UnmeiEmbeddedCheckout.tsx",
);
const metaPurchase = read("src/lib/meta-purchase.ts");
const resultUpgradeChat = read(
  "src/components/result-upgrade/ResultUpgradeChat.tsx",
);

const contractChecks = [
  {
    label: "Japanese full access reference price is JPY 1,290",
    valid: accessProducts.includes(
      "export const FULL_ACCESS_LIST_PRICE_JPY = 1290;",
    ),
  },
  {
    label: "Japanese full access checkout price is JPY 499",
    valid: accessProducts.includes(
      "export const FULL_ACCESS_PRICE_JPY = 499;",
    ),
  },
  {
    label: "Japanese full access price change records its effective time",
    valid: accessProducts.includes(
      '"2026-09-21T10:02:00+09:00" as const',
    ),
  },
  {
    label: "Japanese full access measurement generation records the restored JPY 499 offer",
    valid: accessProducts.includes(
      '"legacy_card_v43_ja_full_499_restored_1290_measurement_v4" as const',
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
      checkoutRoute.includes("listAmount: FULL_ACCESS_LIST_PRICE_KRW,") &&
      checkoutRoute.includes(
        "FULL_ACCESS_LIST_PRICE_KRW - FULL_ACCESS_PRICE_KRW",
      ),
  },
  {
    label: "Stripe Checkout uses the frozen reference price",
    valid: checkoutRoute.includes("listAmount: FULL_ACCESS_LIST_PRICE_JPY,"),
  },
  {
    label: "Stripe Checkout uses the frozen JPY 499 sale price",
    valid: checkoutRoute.includes("saleAmount: FULL_ACCESS_PRICE_JPY,"),
  },
  {
    label: "Stripe Checkout derives the fixed discount from shared constants",
    valid: checkoutRoute.includes(
      "FULL_ACCESS_LIST_PRICE_JPY - FULL_ACCESS_PRICE_JPY",
    ),
  },
  {
    label: "English Stripe Checkout uses the frozen reference price",
    valid: checkoutRoute.includes(
      "listAmount: EN_FULL_ACCESS_LIST_PRICE_USD_CENTS,",
    ),
  },
  {
    label: "English Stripe Checkout derives its fixed discount from shared constants",
    valid: checkoutRoute.includes(
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
    valid: checkoutRoute.includes(
      'id: {\n    currency: "idr",',
    ),
  },
  {
    label: "Indonesian Stripe Checkout uses the frozen IDR 129,000 reference price",
    valid: checkoutRoute.includes(
      'id: {\n    currency: "idr",\n    saleAmount: ID_FULL_ACCESS_PRICE_IDR_MINOR,\n    listAmount: ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR,',
    ),
  },
  {
    label: "Indonesian Stripe Checkout derives the IDR 80,000 discount from shared constants",
    valid: checkoutRoute.includes(
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
    label: "Indonesian checkout analytics report IDR 49,000 in major units",
    valid:
      fullAccessCta.includes("ID_FULL_ACCESS_PRICE_IDR_MINOR / 100") &&
      fullAccessCta.includes('? "IDR"'),
  },
  {
    label: "Indonesian Alice FAQ renders the shared rupiah price",
    valid: hoshiyomiCopy.includes(
      "formatIdrMinor(ID_FULL_ACCESS_PRICE_IDR_MINOR)",
    ),
  },
  {
    label: "Friend paywall renders the shared price constant",
    valid: friendPaywall.includes(
      'FULL_ACCESS_PRICE_JPY.toLocaleString("ja-JP")',
    ),
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
    label: "Korean commerce disclosure lists only the shared full access price",
    valid:
      koreanCommercePage.includes("FULL_ACCESS_PRICE_KRW") &&
      !koreanCommercePage.includes("SELF_REPORT_PRICE_KRW") &&
      !koreanCommercePage.includes("PREMIUM_BUNDLE_PRICE_KRW"),
  },
  {
    label: "Korean terms list only the shared full access price",
    valid:
      koreanTermsPage.includes("FULL_ACCESS_PRICE_KRW") &&
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
    label: "Indonesian embedded Checkout does not offer JPY-only PayPay",
    valid: embeddedCheckout.includes('const supportsPayPay = locale === "ja";'),
  },
  {
    label: "Checkout API rejects PayPay outside the Japanese offer",
    valid: checkoutRoute.includes(
      'if (paypayRedirect && checkoutLocale !== "ja")',
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
      ) && checkoutRoute.includes("? RESULT_UPGRADE_PRICE_JPY"),
  },
  {
    label: "Result upgrade CTA does not duplicate the price in its label",
    valid:
      resultUpgradeChat.includes("結果をアップグレード") &&
      !resultUpgradeChat.includes("¥800で結果をアップグレード") &&
      !resultUpgradeChat.includes("¥899で結果をアップグレード"),
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
  `Commerce catalog verified (${contractChecks.length} checks): Japanese full access is JPY 499 from JPY 1,290 and the purchaser-only result upgrade is JPY 899; Korean full access is the only current Korean offer at KRW 4,900; Indonesian full access is IDR 49,000 from IDR 129,000; English full access is USD 4.99 from USD 12.90.`,
);
