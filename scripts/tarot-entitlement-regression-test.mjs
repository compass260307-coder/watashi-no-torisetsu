import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION,
  TAROT_ACCESS_POLICY_FULL_INCLUDED,
  TAROT_ACCESS_POLICY_FULL_ONLY,
  THREE_COURSE_PAYWALL_VERSION,
  purchaseIncludesTarotFeatures,
} from "../src/lib/access-products.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

assert.equal(
  purchaseIncludesTarotFeatures(
    "full_access",
    TAROT_ACCESS_POLICY_FULL_INCLUDED,
  ),
  true,
  "explicitly included full_access must unlock tarot",
);
assert.equal(
  purchaseIncludesTarotFeatures(
    "full_access",
    TAROT_ACCESS_POLICY_FULL_ONLY,
    THREE_COURSE_PAYWALL_VERSION,
  ),
  false,
  "an explicit exclusion must override recovery metadata",
);
assert.equal(
  purchaseIncludesTarotFeatures(
    "full_access",
    undefined,
    "legacy_card_v29_full_499_student_299_friend_no_discount_copy",
  ),
  false,
  "pre-tarot full_access purchases must remain locked",
);
for (const paywallVersion of [
  "legacy_card_v30_full_499_destiny_alice30_tarot_student_299",
  THREE_COURSE_PAYWALL_VERSION,
  EN_SINGLE_FULL_ACCESS_PAYWALL_VERSION,
]) {
  assert.equal(
    purchaseIncludesTarotFeatures("full_access", undefined, paywallVersion),
    true,
    `missing webhook metadata must recover tarot for ${paywallVersion}`,
  );
}
assert.equal(
  purchaseIncludesTarotFeatures("premium_bundle", undefined),
  true,
  "premium_bundle must continue to unlock tarot",
);
assert.equal(
  purchaseIncludesTarotFeatures(
    "self_report",
    TAROT_ACCESS_POLICY_FULL_INCLUDED,
  ),
  false,
  "self_report must never unlock tarot",
);

const webhook = source("src/app/api/webhook/stripe/route.ts");
const paymentRecorder = webhook.slice(
  webhook.indexOf("async function recordFullAccessPayment"),
  webhook.indexOf("async function recordSelfReportPayment"),
);
assert.match(
  paymentRecorder,
  /tarot_access_policy:\s*\n\s*session\.metadata\?\.tarot_access_policy \?\? "legacy_not_included"/,
  "full-access payment recorder must persist tarot_access_policy",
);

const watcher = source("src/components/result/PaidUnlockWatcher.tsx");
assert.match(
  watcher,
  /returnTo === "tarot"\s*\n\s*\? data\.tarot/,
  "paid watcher must wait for tarot entitlement, not generic full access",
);

for (const page of ["src/app/tarot/page.tsx", "src/app/ko/tarot/page.tsx"]) {
  const pageSource = source(page);
  assert.match(pageSource, /query\.paid === "1"/);
  assert.match(pageSource, /<PaidUnlockWatcher/);
}

console.log("Tarot entitlement regression checks passed.");
