import { createHmac, randomBytes, randomInt } from "node:crypto";

export const LOGIN_CODE_SECONDS = 600;
export const LOGIN_RESEND_SECONDS = 60;
export function newLoginCode() {
  return { challenge: randomBytes(32).toString("base64url"), code: randomInt(0, 1000000).toString().padStart(6, "0") };
}
export function normalizeLoginEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function validLoginCodeInput(challenge: unknown, code: unknown): boolean {
  return typeof challenge === "string" && /^[A-Za-z0-9_-]{43}$/.test(challenge)
    && typeof code === "string" && /^\d{6}$/.test(code);
}
// A server-keyed digest makes the existing token column usable without storing
// the six-digit code or adding a schema. A DB leak cannot brute-force the code.
export function loginCodeToken(email: string, challenge: string, code: string, secret: string) {
  if (!secret) throw new Error("Login-code secret missing");
  return "otp_" + createHmac("sha256", secret).update(JSON.stringify([email, challenge, code])).digest("hex");
}
