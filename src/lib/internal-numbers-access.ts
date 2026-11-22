import "server-only";

import type { SessionUser } from "./session";
import { supabaseAdmin } from "./supabase-server";

/**
 * 社内向け数値画面を開いてよいログインか。
 *
 * 確認済みのログインメールが internal_dashboard_viewers にある人だけ通す。
 * 許可リストは DB に置き、URL やコードには鍵を持たせない。表が無い・読めない
 * ときは「許可しない」に倒す。
 */
export async function isInternalDashboardViewer(
  user: SessionUser | null,
): Promise<boolean> {
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email || !user.email_verified_at) return false;

  const { data, error } = await supabaseAdmin
    .from("internal_dashboard_viewers")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("[internal-numbers] viewer lookup failed", {
      code: error.code,
      message: error.message,
    });
    return false;
  }
  return Boolean(data);
}
