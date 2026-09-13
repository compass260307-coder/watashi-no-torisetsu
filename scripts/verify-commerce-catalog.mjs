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
const metaPurchase = read("src/lib/meta-purchase.ts");

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
    label: "Japanese full access paywall version is the frozen v40 offer",
    valid: accessProducts.includes(
      '"legacy_card_v40_ja_full_499_release_1290_list" as const',
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
    label: "Purchase analytics fallback identifies the JPY 499 product",
    valid: metaPurchase.includes('fallbackId: "full_access_jpy_499"'),
  },
];

const failures = contractChecks.filter(({ valid }) => !valid);

if (failures.length > 0) {
  console.error("Commerce catalog verification failed:");
  for (const { label } of failures) console.error(`- ${label}`);
  console.error(
    "The Japanese full access offer is frozen. Update the business decision and guard together only with explicit authorization.",
  );
  process.exit(1);
}

console.log(
  `Commerce catalog verified (${contractChecks.length} checks): Japanese full access is JPY 499 with a JPY 1,290 reference price.`,
);
