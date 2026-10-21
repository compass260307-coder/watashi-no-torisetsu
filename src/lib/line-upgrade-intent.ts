import { createHmac, timingSafeEqual } from "node:crypto";
import { hashLineLinkCode } from "@/lib/line";

function signature(payload: string): string {
  const secret = process.env.ALICE_TRANSFER_CODE_SECRET ?? process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("LINE upgrade intent signing is not configured");
  return createHmac("sha256", secret).update(`line-upgrade-intent\0${payload}`).digest("hex");
}

/** Bind the requested conversation to the issued linking code; a URL flag alone never starts it. */
export function signLineUpgradeIntent(code: string): string {
  const payload = Buffer.from(JSON.stringify({ codeHash: hashLineLinkCode(code), expiresAt: Date.now() + 10 * 60_000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyLineUpgradeIntent(code: string, token: unknown): boolean {
  if (typeof token !== "string" || token.length > 2048) return false;
  const [payload, provided, extra] = token.split(".");
  if (!payload || !provided || extra !== undefined || !/^[a-f0-9]{64}$/.test(provided)) return false;
  if (!timingSafeEqual(Buffer.from(signature(payload), "hex"), Buffer.from(provided, "hex"))) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return value.codeHash === hashLineLinkCode(code) && typeof value.expiresAt === "number" &&
      value.expiresAt > Date.now() && value.expiresAt <= Date.now() + 10 * 60_000;
  } catch { return false; }
}
