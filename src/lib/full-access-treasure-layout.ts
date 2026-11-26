// 完全版の宝箱で、7つの特典をどう見せるかの出し分け（A/B。2026-11-26〜）。
//
// 背景: 値段が出たあとの画面を閉じる人の半分以上が6秒以内に閉じていて、1枚ずつ送るカードでは
//   7つの特典のうち先頭の1つしか見られていない。7つを一度に見せる見せ方を試す。
//
// - stack（従来）: 値札のあと、先頭の特典に残り6枚が重なり、1枚ずつ送るカードになる。
// - spill（新）: 値札の数字が金色になって上へ移り、宝箱から7つが1つずつ飛び出して一覧に並ぶ。
//
// 群 = sha256(`${VERSION}:${ownerToken}`) の先頭バイトが奇数なら spill、偶数なら stack。
//   本人を特定できないとき・計算できないときは stack。
// 計測: 新しいイベント名は足さない。宝箱の paywall_viewed と paywall_plan_viewed（placement: "treasure"）の
//   metadata に treasure_layout / treasure_layout_test を付ける。決済・購入は owner_token で群を再現して数える。
// やめるとき: fullAccessTreasureLayoutFor が常にどちらかを返すようにする。

export const FULL_ACCESS_TREASURE_LAYOUT_TEST_VERSION = "ja_full_access_treasure_layout_v1_20261126";

export type FullAccessTreasureLayout = "stack" | "spill";

export async function fullAccessTreasureLayoutFor(ownerToken: string | null | undefined): Promise<FullAccessTreasureLayout> {
  if (!ownerToken) return "stack";
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return "stack";
    const data = new TextEncoder().encode(`${FULL_ACCESS_TREASURE_LAYOUT_TEST_VERSION}:${ownerToken}`);
    const digest = new Uint8Array(await subtle.digest("SHA-256", data));
    return digest[0] % 2 === 1 ? "spill" : "stack";
  } catch {
    return "stack";
  }
}
