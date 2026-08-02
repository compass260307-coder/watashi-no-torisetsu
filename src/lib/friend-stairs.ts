// 友達診断のしきい値の唯一の真実源。
//
// 2026-07-18 変更: 友達診断は「1人 × 30問」で完結するモデルへ。
// /tako 側は友達1人の回答で結果表示の土台が完成する。
// 旧: 1人=予兆 / 3人=第二部 / 5人=完成 の階段モデル (FriendStairs UI は廃止)。
//
// 2026-08-01 変更: 自己診断ページ (/me) の完全解放は課金のみ。
// 友達回答が届いても /me のロック本文・課金カードは未解放のまま残す。
//
// 人数しきい値をコードに散らさない。判定は必ずここを経由する。

export const STAIR_TEASE = 1; // 旧・予兆カード用の互換値。
export const STAIR_PART_TWO = 1; // 旧・友達人数ゲート用の互換値。/me 解放には使わない。
export const STAIR_COMPLETE = 1; // /tako 側の結果表示の土台が完成する人数。

/**
 * 第二部 (見られ方の予測＋深掘りキャリア/成長/相性) が開いているか。
 * 課金 (¥499=full) のみ。純関数 (DB を引かない)。
 * hasFullAccess (entitlements.ts) の結果と friend_perceptions 件数を渡す。
 */
export function hasPartTwoAccess(
  paid: boolean,
  _friendCount: number,
): boolean {
  return paid;
}
