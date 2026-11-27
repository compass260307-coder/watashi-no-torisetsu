// 完全版の宝箱で、7つの特典が並び終わったあとの動きの出し分け（A/B。2026-11-27〜）。
//
// 背景: 特典の見せ方は全員 spill（宝箱から7つが飛び出して一覧に並ぶ）にした（full-access-treasure-layout.ts）。
//   2026-11-27 12:09 に足した「並び終わったあとの動き」（PR #472）が購入に効くかを、動きだけの違いで確かめる。
//
// - on: 並び終わりに購入ボタンが一度光り、そのあとカードが1→7の順に光ってボタンに光の筋が走る・
//       カードが浮く・値段のまわりで星がまたたく（PR #472 の状態）。
// - off: 7つが並んだら、そのまま止まる（PR #472 より前の spill）。
//   並ぶまでの演出（宝箱を開ける→クーポン→値下げ→7つが飛び出す）は、どちらも同じ。
//
// 群 = sha256(`${VERSION}:${ownerToken}`) の先頭バイトが奇数なら on、偶数なら off。
//   本人を特定できないとき・計算できないときは on。前の stack / spill の出し分けや、ページ末尾の宝箱の小窓
//   （full-access-promo-chest-test.ts）とは別の文字列で分けるので、互いに独立に半々になる。
// 計測: 新しいイベント名は足さない。宝箱の paywall_viewed と paywall_plan_viewed（placement: "treasure"）の
//   metadata に treasure_motion / treasure_motion_test を付ける。決済・購入は owner_token で群を再現して数える。
//   「動きを減らす」設定の端末と、受け取り済みで値札から始まる人は、on でも一部の動きが出ない（群の記録は on のまま）。
// やめるとき: fullAccessTreasureMotionFor が常にどちらかを返すようにする。

export const FULL_ACCESS_TREASURE_MOTION_TEST_VERSION = "ja_full_access_treasure_motion_v1_20261127";

export type FullAccessTreasureMotion = "on" | "off";

export async function fullAccessTreasureMotionFor(ownerToken: string | null | undefined): Promise<FullAccessTreasureMotion> {
  if (!ownerToken) return "on";
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return "on";
    const data = new TextEncoder().encode(`${FULL_ACCESS_TREASURE_MOTION_TEST_VERSION}:${ownerToken}`);
    const digest = new Uint8Array(await subtle.digest("SHA-256", data));
    return digest[0] % 2 === 1 ? "on" : "off";
  } catch {
    return "on";
  }
}
