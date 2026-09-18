export const CHECKOUT_ATTEMPT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeCheckoutAttemptId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return CHECKOUT_ATTEMPT_ID_PATTERN.test(normalized) ? normalized : null;
}

/** 1回の購入CTA操作を、ブラウザ→Checkout→Webhookまで結ぶID。 */
export function createCheckoutAttemptId(): string {
  return crypto.randomUUID();
}
