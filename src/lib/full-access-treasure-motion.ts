// 完全版の宝箱で、7つの特典が並び終わったあとの動き。
//
// - off: 7つが並んだら、そのまま止まる（PR #472 より前の spill）。
// - on: 並び終わりに購入ボタンが一度光り、そのあとカードが1→7の順に光ってボタンに光の筋が走る・
//       カードが浮く・値段のまわりで星がまたたく（PR #472 の状態）。
//   並ぶまでの演出（宝箱を開ける→クーポン→値下げ→7つが飛び出す）は、どちらも同じ。
//
// 2026-11-27〜11/28 に on / off を半々に出し分けた（A/B。ja_full_access_treasure_motion_v1_20261127、
//   群 = sha256(`${VERSION}:${ownerToken}`) の先頭バイトが奇数なら on）。
//   購入ボタン・購入のどちらにも差が出なかったため、本人の判断により 2026-11-28 から全員 off にした。
//   過去の出し分けを集計し直すときは、上の計算で群を再現する。
// 計測: 宝箱の paywall_viewed と paywall_plan_viewed（placement: "treasure"）の metadata.treasure_motion は残す
//   （全員 "off"）。出し分けの印だった treasure_motion_test は、全員 off にした時点から付けない。

export type FullAccessTreasureMotion = "on" | "off";

/** 本番で出す動き。on は確認ページ（/dev/full-access-treasure-preview）で見比べるためだけに残している。 */
export const FULL_ACCESS_TREASURE_MOTION: FullAccessTreasureMotion = "off";
