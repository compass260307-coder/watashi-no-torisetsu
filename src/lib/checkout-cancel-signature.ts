import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

function cancellationSecret(): string | null {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  return secret || null;
}

export function signCheckoutCancellation(attemptId: string): string | null {
  const secret = cancellationSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(attemptId).digest("hex");
}

export function verifyCheckoutCancellation(
  attemptId: string,
  signature: unknown,
): boolean {
  const expected = signCheckoutCancellation(attemptId);
  if (
    !expected ||
    typeof signature !== "string" ||
    !/^[0-9a-f]{64}$/i.test(signature)
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
}
