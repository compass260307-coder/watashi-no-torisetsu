// PR1: entitlement 判定 (課金ロックの唯一の真実源)。
//
// ¥499 買い切りで全解放。判定は users.plan の単純フラグ ('free' | 'full')。
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
 *
 * 紐付けは email 優先: その user 行が plan='full' でなくても、同じ email を持つ別の
 * user 行に full があれば full 扱いにする (ゲスト決済・再診断で行が分かれても、email が
 * 同じなら全解放が効く)。email が無い行は自分の plan だけで判定。
 */
export async function hasFullAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("plan, email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;

  // ① その行自身が full
  if (data.plan === "full") return true;

  // ② email 優先: 同一 email の行に full があれば full 扱い
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (email) {
    const { data: fullRows } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .eq("plan", "full")
      .limit(1);
    if (fullRows && fullRows.length > 0) return true;
  }

  return false;
}


// =====================================================================
// 友達診断 (/tako) の課金解放 'tako_unlock' (2026-07-20)。
//   価格: ¥1,299 / 全解放 (¥499課金) 保有者は ¥499 OFF の ¥800。
//   権限は payment_history (payment_kind='tako_unlock', status='completed') から導出。
// =====================================================================

export const TAKO_UNLOCK_PRICE_JPY = 1299;
export const TAKO_UNLOCK_DISCOUNTED_PRICE_JPY = 800;

/** user_id 群に tako_unlock の completed 行があるか。 */
async function anyTakoUnlockPayment(userIds: string[]): Promise<boolean> {
  if (userIds.length === 0) return false;
  const { count, error } = await supabaseAdmin
    .from("payment_history")
    .select("id", { count: "exact", head: true })
    .in("user_id", userIds)
    .eq("payment_kind", "tako_unlock")
    .eq("status", "completed");
  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * 友達診断の解放を持っているか。判定は必ずこの関数を経由する。
 * hasFullAccess と同じ思想で email 紐付けも見る (ゲスト決済・再診断で行が
 * 分かれても、同じ email の行に購入があれば解放扱い)。
 */
export async function hasTakoAccess(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;

  // ① 自分の行での購入
  if (await anyTakoUnlockPayment([userId])) return true;

  // ② email 紐付け: 同一 email の別 user 行での購入
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (!email) return false;

  const { data: rows } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(20);
  const otherIds = (rows ?? [])
    .map((r) => r.id as string)
    .filter((id) => id !== userId);
  return anyTakoUnlockPayment(otherIds);
}
