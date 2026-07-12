// 三層×二ページモデル (2026-07-12 確定) の「階段」しきい値の唯一の真実源。
//
// ルール (3行):
//   1. 自己分析 (第一部) は無料
//   2. 「どう見られてるか」の予測と深掘り (第二部) は、友達3人 or ¥299
//   3. 本物の見られ方 (第三部 /tako) は友達5人で完成。金では買えない
//
// 道中の報酬 (階段):
//   友達1人 = 予兆 (動物メタファーの小出し)
//   友達3人 = 第二部が開く (¥299 でスキップ可能なのはここまで)
//   友達5人 = 第三部 (/tako) が完成
//
// 人数しきい値をコードに散らさない。判定は必ずここを経由する
// (旧 REPORT_FRIEND_THRESHOLD / JOB_FRIEND_THRESHOLD とは役割が別。
//  /tako 側の 3→5 切替は別フェーズで REPORT_FRIEND_THRESHOLD をこちらへ寄せる)。

export const STAIR_TEASE = 1; // 予兆カード
export const STAIR_PART_TWO = 3; // 第二部 (予測＋深掘り) 解放
export const STAIR_COMPLETE = 5; // 第三部 (/tako) 完成

/**
 * 第二部 (見られ方の予測＋深掘りキャリア/成長/相性) が開いているか。
 * 課金 (¥299=full) または友達3人以上。純関数 (DB を引かない)。
 * hasFullAccess (entitlements.ts) の結果と friend_perceptions 件数を渡す。
 */
export function hasPartTwoAccess(
  paid: boolean,
  friendCount: number,
): boolean {
  return paid || friendCount >= STAIR_PART_TWO;
}
