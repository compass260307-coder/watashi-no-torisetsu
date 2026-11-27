// 自己診断結果ページの末尾の出し分け（A/B。2026-11-27〜）。
//
// 背景: 末尾の課金カードは、画面に入った回数のうち押されるのが約2%（11/20〜11/27）。押した人の購入率は
//   入口の中でいちばん高い（約5%）ので、押す人を増やせるかを試す。
//
// - card（従来）: 7つの解放内容を並べた課金カード。「全ての結果をアンロック →」で宝箱の演出を開く。
// - chest（新）: 宝箱の演出の最初の場面を小窓として置く。押すと、そのまま全画面に広がって宝箱が開く。
//
// 群 = sha256(`${VERSION}:${ownerToken}`) の先頭バイトが奇数なら chest、偶数なら card。
//   本人を特定できないとき・計算できないときは card。宝箱の特典の見せ方（full-access-treasure-layout.ts）や
//   価格テストとは別の文字列で分けるので、互いに独立に半々になる。
// 対象: 日本語の自己診断結果ページで、末尾のカードが宝箱を開く条件（日本円の完全版の見積もり）を満たす人。
//   友達診断ページの末尾は対象外（従来のカードのまま）。
// 計測: 新しいイベント名は足さない。
//   - 末尾が画面に入った: paywall_viewed（placement: "inline"）の metadata.promo_chest_arm / promo_chest_test。
//   - 押した: paywall_scroll_clicked の metadata.entry（card 群は "promo_card"、chest 群は "promo_chest"）。
//     chest 群は source も "promo_chest"。card 群の source は従来どおり（直前に押した入口、無ければ paywall_direct）。
//   - 判定は、末尾を見た人を owner_token で群に分け、決済画面（checkout_session_created）と購入を入口を問わず数える。
//     宝箱の入口が他の入口の購入を食うだけかもしれないので、入口別ではなく人単位で比べる。
// やめるとき: fullAccessPromoChestArmFor が常にどちらかを返すようにする。

export const FULL_ACCESS_PROMO_CHEST_TEST_VERSION = "ja_full_access_promo_chest_v1_20261127";

export type FullAccessPromoChestArm = "card" | "chest";

export async function fullAccessPromoChestArmFor(ownerToken: string | null | undefined): Promise<FullAccessPromoChestArm> {
  if (!ownerToken) return "card";
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return "card";
    const data = new TextEncoder().encode(`${FULL_ACCESS_PROMO_CHEST_TEST_VERSION}:${ownerToken}`);
    const digest = new Uint8Array(await subtle.digest("SHA-256", data));
    return digest[0] % 2 === 1 ? "chest" : "card";
  } catch {
    return "card";
  }
}
