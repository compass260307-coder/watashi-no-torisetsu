import { createHmac, timingSafeEqual } from "node:crypto";

export const LINE_RESULT_UPGRADE_COOKIE = "wn_line_result_upgrade";
export const LINE_RESULT_UPGRADE_TTL_SECONDS = 60 * 60 * 24;

type Identity = { lineUserId: string; userId: string; expiresAt: number };

function secret(): string {
  const value = process.env.ALICE_TRANSFER_CODE_SECRET ?? process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("LINE result upgrade signing is not configured");
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(`line-result-upgrade\0${payload}`).digest("hex");
}

/** A separate purpose and a fixed account prevent Plus tokens and relinks from granting access. */
export function signLineResultUpgradeIdentity(lineUserId: string, userId: string, issuedAt = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ lineUserId, userId, expiresAt: issuedAt + LINE_RESULT_UPGRADE_TTL_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyLineResultUpgradeIdentity(token: string): Identity | null {
  if (!token || token.length > 2048) return null;
  const [payload, provided, extra] = token.split(".");
  if (!payload || !provided || extra !== undefined || !/^[a-f0-9]{64}$/.test(provided)) return null;
  const expected = Buffer.from(signature(payload), "hex");
  if (!timingSafeEqual(expected, Buffer.from(provided, "hex"))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as Partial<Identity>;
    if (typeof value.lineUserId !== "string" || !value.lineUserId || typeof value.userId !== "string" || !value.userId ||
        typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() ||
        value.expiresAt > Date.now() + LINE_RESULT_UPGRADE_TTL_SECONDS * 1000) return null;
    return value as Identity;
  } catch { return null; }
}
