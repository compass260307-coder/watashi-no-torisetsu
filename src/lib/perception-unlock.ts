// Phase 1.5-α Day 12-C2: perception 単位のロック解除状態判定
//
// 設計原則 (Day 12-C2 論点 3):
//   - payment_history を「真実」とし、friend_perceptions に派生フラグを持たせない
//   - refund 時の同期コストを排除し、課金状態の管理を一元化する
//
// 判定条件:
//   payment_history に
//     perception_id = ? AND status = 'completed' AND payment_kind = 'perception_unlock'
//   の行が 1 件以上あれば unlocked。
//
// 失敗時の挙動: 例外を投げず false を返す (安全側: ロック維持)。

import { supabaseAdmin } from "./supabase-server";

export async function isPerceptionUnlocked(
  perceptionId: string,
): Promise<boolean> {
  if (!perceptionId) return false;

  const { count, error } = await supabaseAdmin
    .from("payment_history")
    .select("id", { count: "exact", head: true })
    .eq("perception_id", perceptionId)
    .eq("status", "completed")
    .eq("payment_kind", "perception_unlock");

  if (error) {
    console.error(
      "[perception-unlock] isPerceptionUnlocked DB error:",
      error.message,
    );
    return false;
  }

  return (count ?? 0) > 0;
}
