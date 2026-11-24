// 完全版 (日本語 Web) を買った直後に出す「完全版の準備画面」の設定と A/B の群分け。
//
// 背景 (2026-11-24): 購入直後はいちばん気持ちが高い。決済から戻ったところで、
//   自己診断の解析待ち画面を豪華にした準備画面を15秒見せ、そのあいだに
//   「完全版でひらいたもの → 友達診断 → 結果アップグレード (¥899)」を紹介してから
//   自己診断結果へ進める。友達診断ページへの到達と ¥899 の購入を増やすのが目的。
//
// 対象: /me/[token]?paid=1 に戻った本人のうち、Stripe で支払い済みと確かめられた
//   日本語の full_access 購入 (premium_bundle などは対象外)。
//
// A/B: 群 = sha256(`${VERSION}:${userId}`) の先頭バイトが奇数なら準備画面を出す。
//   出さない群には何も記録しないので、集計では payment_history の購入者から同じ計算で群を出す。
//   ¥699 の価格テスト (11/26 0:00 JST に自動終了) と混ざらないよう、開始はそのあとにする。
//   比べるもの: 購入後に友達診断ページ (tako_viewed) に来た率、結果アップグレードの購入率。

import "server-only";
import { createHash } from "node:crypto";

export const PURCHASE_LOADING_VERSION = "ja_purchase_loading_v1";

/** A/B の開始時刻。これより前は誰にも出さない (今までどおり)。 */
export const PURCHASE_LOADING_START_MS = Date.parse("2026-11-26T00:00:00+09:00");

export type PurchaseLoadingArm = "show" | "control";

export function purchaseLoadingArmForUser(
  userId: string,
  nowMs: number = Date.now(),
): PurchaseLoadingArm | null {
  if (nowMs < PURCHASE_LOADING_START_MS) return null;
  const digest = createHash("sha256")
    .update(`${PURCHASE_LOADING_VERSION}:${userId}`)
    .digest();
  return digest[0] % 2 === 1 ? "show" : "control";
}
