// 完全版の宝箱で、7つの特典をどう見せるか。
//
// - stack（従来）: 値札のあと、先頭の特典に残り6枚が重なり、1枚ずつ送るカードになる。
// - spill: 値札の数字が金色になって上へ移り、宝箱から7つが1つずつ飛び出して一覧に並ぶ。
//
// 2026-11-26〜11/27 に stack / spill を半々に出し分けた（A/B。ja_full_access_treasure_layout_v1_20261126、
//   群 = sha256(`${VERSION}:${ownerToken}`) の先頭バイトが奇数なら spill）。
//   決済画面まで進む率は同じ、購入は spill が多い（12件 対 22件、未決着）という途中経過で、本人の判断により
//   2026-11-27 から全員 spill にした。続きは、並び終わったあとの動きの出し分け（full-access-treasure-motion.ts）。
// 計測: 宝箱の paywall_viewed と paywall_plan_viewed（placement: "treasure"）の metadata.treasure_layout は残す
//   （全員 "spill"）。出し分けの印だった treasure_layout_test は、全員 spill にした時点から付けない。

export type FullAccessTreasureLayout = "stack" | "spill";

/** 本番で出す見せ方。stack は確認ページ（/dev/full-access-treasure-preview）で見比べるためだけに残している。 */
export const FULL_ACCESS_TREASURE_LAYOUT: FullAccessTreasureLayout = "spill";
