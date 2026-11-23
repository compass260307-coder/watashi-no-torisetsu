// 自己診断結果ページ (/me) を一番下まで読んだ人に出す、友達診断の招待カードの設定。
// カードそのものは、友達診断ページ (/tako) の友達0人のときに開く招待カードと同じもの。
//
// 背景 (2026-11-23): 結果を一番下まで読んだのに、購入も友達診断ページへの移動もせずに
// 帰る人が多い。読み終えた直後に、友達診断ページへ行かなくても招待できるようにする。
//
// 出し分け: 効果と購入への影響を比べるため、半分の人にだけ出す。
//   群 = sha256(`${VERSION}:${ownerToken}`) の先頭バイトが奇数なら "card"、偶数なら "control"。
//   集計側でも同じ計算で群を再現できる (control の人には何も記録されないため)。

export const RESULT_INVITE_CARD_VERSION = "ja_result_invite_card_v1";

/** 一番下の課金カードが見えてから、招待カードを出すまでの待ち時間。 */
export const RESULT_INVITE_CARD_DELAY_MS = 8000;

/**
 * 計測の surface / source。既存イベント (tako_invite_ui_shown / friend_invite_clicked) に載せる。
 * 友達診断ページの招待カードは "tako_empty"。
 */
export const RESULT_INVITE_CARD_SOURCE = "me_read_end";

export type ResultInviteCardArm = "card" | "control";

const SHOWN_PREFIX = "wt_result_invite_card_shown_v1:";

/** 1人1回だけ出すための目印 (owner_token ごと)。 */
export function resultInviteCardShownKey(ownerToken: string): string {
  return `${SHOWN_PREFIX}${ownerToken}`;
}

export async function resultInviteCardArm(
  ownerToken: string,
): Promise<ResultInviteCardArm> {
  const data = new TextEncoder().encode(
    `${RESULT_INVITE_CARD_VERSION}:${ownerToken}`,
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(digest)[0] % 2 === 1 ? "card" : "control";
}
