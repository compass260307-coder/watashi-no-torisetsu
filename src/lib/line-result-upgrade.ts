import "server-only";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";
import { LINE_RESULT_UPGRADE_COOKIE, signLineResultUpgradeIdentity, verifyLineResultUpgradeIdentity } from "@/lib/line-result-upgrade-token";

export function buildLineResultUpgradeUrl(lineUserId: string, userId: string, issuedAt?: number): string {
  const token = signLineResultUpgradeIdentity(lineUserId, userId, issuedAt);
  return `${resolveSiteUrl()}/api/line/result-upgrade/enter?token=${encodeURIComponent(token)}`;
}

export function buildLineResultUpgradeCheckoutUrl(lineUserId: string, userId: string): string {
  const url = new URL(buildLineResultUpgradeUrl(lineUserId, userId));
  url.searchParams.set("checkout", "1");
  return url.toString();
}

export async function resolveLineResultUpgradeIdentity(token: string) {
  const identity = verifyLineResultUpgradeIdentity(token);
  if (!identity) return null;
  const { data: account, error } = await supabaseAdmin.from("line_accounts")
    .select("user_id").eq("line_user_id", identity.lineUserId).maybeSingle();
  if (error || account?.user_id !== identity.userId) return null;
  const { data: user, error: userError } = await supabaseAdmin.from("users")
    .select("id, owner_token, email").eq("id", identity.userId).maybeSingle();
  if (userError || !user?.owner_token) return null;
  return { ...(user as { id: string; owner_token: string; email: string | null }), lineUserId: identity.lineUserId };
}

/** This session is restricted to the Japanese LINE upgrade; the Web login is never changed. */
export async function getLineResultUpgradeSession() {
  const token = (await cookies()).get(LINE_RESULT_UPGRADE_COOKIE)?.value;
  return token ? resolveLineResultUpgradeIdentity(token) : null;
}

export async function getResultUpgradeSession(request: Request) {
  return new URL(request.url).searchParams.get("channel") === "line"
    ? getLineResultUpgradeSession()
    : getSession(request as never);
}
