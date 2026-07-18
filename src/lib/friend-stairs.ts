// 友達診断のしきい値の唯一の真実源。
//
// 2026-07-18 変更: 友達診断は「1人 × 30問」で完結するモデルへ。
// 友達1人の回答で第二部 (予測＋深掘り) も第三部 (/tako) もすべて解放される。
// 旧: 1人=予兆 / 3人=第二部 / 5人=完成 の階段モデル (FriendStairs UI は廃止)。
//
// 人数しきい値をコードに散らさない。判定は必ずここを経由する。

export const STAIR_TEASE = 1; // (旧・予兆カード。現在は PART_TWO と同値)
export const STAIR_PART_TWO = 1; // 第二部 (予測＋深掘り) 解放
export const STAIR_COMPLETE = 1; // 第三部 (/tako) 完成

/**
 * 第二部 (見られ方の予測＋深掘りキャリア/成長/相性) が開いているか。
 * 課金 (¥499=full) または友達1人以上。純関数 (DB を引かない)。
 * hasFullAccess (entitlements.ts) の結果と friend_perceptions 件数を渡す。
 */
export function hasPartTwoAccess(
  paid: boolean,
  friendCount: number,
): boolean {
  return paid || friendCount >= STAIR_PART_TWO;
}
