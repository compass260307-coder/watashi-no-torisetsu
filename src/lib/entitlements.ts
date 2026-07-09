// PR1: entitlement 判定 (課金ロックの唯一の真実源)。
//
// ¥299 買い切りで全解放。判定は users.plan の単純フラグ ('free' | 'full')。
// 課金判定は各所で .eq('plan','full') とベタ書きせず、必ず hasFullAccess() に集約する
// (ロジックが1箇所なら抜け道点検も1箇所で済む)。PR2 のサーバゲートはこの関数を通す。

import { supabaseAdmin } from "./supabase-server";

export type Plan = "free" | "full";

/** DB からプランを引く。取得失敗時は安全側 (free) に倒す。 */
export async function getPlan(userId: string): Promise<Plan> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return "free";
  return data.plan === "full" ? "full" : "free";
}

/**
 * 全解放を持っているか。課金ロックの判定は必ずこの関数を経由する。
 * userId が無い (未ログイン) なら false。
 */
export async function hasFullAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  return (await getPlan(userId)) === "full";
}
