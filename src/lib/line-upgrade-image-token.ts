import { createHmac, timingSafeEqual } from "node:crypto";

const TTL = 24 * 60 * 60_000;
type ImageIdentity = { userId: string; lineUserId: string; generatedAt: string; expiresAt: number };
function signature(payload: string) {
  const secret = process.env.ALICE_TRANSFER_CODE_SECRET ?? process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("LINE upgrade image signing unavailable");
  return createHmac("sha256", secret).update(`line-upgrade-image\0${payload}`).digest("hex");
}
export function signLineUpgradeImage(input: Omit<ImageIdentity, "expiresAt">, issuedAt: number): string {
  const payload = Buffer.from(JSON.stringify({ ...input, expiresAt: issuedAt + TTL })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function verifyLineUpgradeImage(token: string): ImageIdentity | null {
  if (!token || token.length > 2048) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined || !/^[a-f0-9]{64}$/.test(sig)) return null;
  if (!timingSafeEqual(Buffer.from(sig,"hex"),Buffer.from(signature(payload),"hex"))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload,"base64url").toString()) as ImageIdentity;
    if (typeof value.userId !== "string" || !value.userId || typeof value.lineUserId !== "string" || !value.lineUserId ||
      typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt)) ||
      typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() || value.expiresAt > Date.now()+TTL) return null;
    return value;
  } catch { return null; }
}
