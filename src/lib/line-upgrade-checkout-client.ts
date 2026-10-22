import { accessPaywallVersionForLocale } from "@/lib/access-products";
import { createCheckoutAttemptId } from "@/lib/checkout-measurement";

export type LineUpgradeCheckoutResult =
  | { kind: "checkout"; url: string; amount: number; currency: string }
  | { kind: "paid" }
  | { kind: "reauthenticate" }
  | { kind: "answers_required" };

/** Reuse the existing authenticated POST; opening a signed entry URL never creates a payment. */
export async function createLineUpgradeCheckout(): Promise<LineUpgradeCheckoutResult> {
  const response = await fetch("/api/checkout/create-full-access-session", {
    method: "POST", headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      locale: "ja", product: "premium_bundle", sales_channel: "line",
      paywall_source: "result_upgrade_after_answers", return_to: "me",
      paywall_version: accessPaywallVersionForLocale("ja"),
      checkout_attempt_id: createCheckoutAttemptId(),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 409 && data.code === "already_premium_bundle") return { kind: "paid" };
  if (response.status === 409 && data.code === "result_upgrade_answers_required") return { kind: "answers_required" };
  if (response.status === 401 || response.status === 403) return { kind: "reauthenticate" };
  if (!response.ok || typeof data.url !== "string" || !data.url.startsWith("https://checkout.stripe.com/") ||
      typeof data.amount !== "number" || !Number.isFinite(data.amount) || data.currency !== "JPY") {
    throw new Error("LINE upgrade checkout unavailable");
  }
  return { kind: "checkout", url: data.url, amount: data.amount, currency: data.currency };
}
