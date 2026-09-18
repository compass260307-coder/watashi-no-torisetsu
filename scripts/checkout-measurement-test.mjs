import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createCheckoutAttemptId,
  normalizeCheckoutAttemptId,
} from "../src/lib/checkout-measurement.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(`${root}/${path}`, "utf8");

const attemptId = createCheckoutAttemptId();
assert.equal(normalizeCheckoutAttemptId(attemptId), attemptId);
assert.equal(normalizeCheckoutAttemptId("not-an-attempt"), null);

const cta = source("src/components/result/FullAccessCta.tsx");
assert.match(cta, /checkout_attempt_id: checkoutAttemptId/g);

const checkout = source(
  "src/app/api/checkout/create-full-access-session/route.ts",
);
const requestedAt = checkout.indexOf('event_name: "checkout_requested"');
const stripeCreatedAt = checkout.indexOf("stripe.checkout.sessions.create");
assert.ok(requestedAt > 0 && requestedAt < stripeCreatedAt);
assert.match(checkout, /checkout_cancel_signature/);
assert.match(checkout, /checkout_attempt_id: checkoutAttemptId/g);
assert.match(checkout, /idempotencyKey: `full-access:\$\{checkoutAttemptId\}`/);

const cancellation = source("src/app/api/checkout/cancelled/route.ts");
assert.match(cancellation, /verifyCheckoutCancellation/);
assert.match(cancellation, /event_name: "checkout_cancelled"/);

const webhook = source("src/app/api/webhook/stripe/route.ts");
assert.match(webhook, /session\.metadata\?\.checkout_attempt_id/);

const metrics = source("src/app/api/metrics/route.ts");
assert.doesNotMatch(metrics, /paywallFunnel\[[0-9]+\]/);
for (const field of [
  "checkoutRequests",
  "checkoutUsers",
  "anonymousCheckouts",
  "checkoutCancelled",
]) {
  assert.match(metrics, new RegExp(`coursePaywall\\.${field}`));
}

console.log("Checkout measurement regression checks passed.");
