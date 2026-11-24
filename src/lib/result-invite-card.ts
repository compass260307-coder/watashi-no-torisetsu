// 自己診断結果ページ (/me) を一番下まで読んだ人に出す、友達診断の招待カードの設定。
// カードそのものは、友達診断ページ (/tako) の友達0人のときに開く招待カードと同じもの。
//
// 背景 (2026-11-23): 結果を一番下まで読んだのに、購入も友達診断ページへの移動もせずに
// 帰る人が多い。読み終えた直後に、友達診断ページへ行かなくても招待できるようにする。
//
// 出し分け (終了): 2026-11-23 21:48〜11-24 は半分の人にだけ出す A/B だった。
//   群 = sha256(`${VERSION}:${ownerToken}`) の先頭バイトが奇数なら出す。
//   課金カードまで読んだ人の友達診断率が 6.9% 対 4.6% (p=0.007) で、購入は両群とも同数だったため、
//   全員に出すことにした。過去の A/B を集計し直すときは上の計算で群を再現する。

export const RESULT_INVITE_CARD_VERSION = "ja_result_invite_card_v1";

/**
 * 一番下の課金カードが見えてから、招待カードを出すまでの待ち時間。
 * 2026-11-25: 8秒 → 5秒。カードが出る前に離れる人を減らすため。
 */
export const RESULT_INVITE_CARD_DELAY_MS = 5000;

/**
 * 計測の surface / source。既存イベント (tako_invite_ui_shown / friend_invite_clicked) に載せる。
 * 友達診断ページの招待カードは "tako_empty"。
 */
export const RESULT_INVITE_CARD_SOURCE = "me_read_end";

/**
 * 2回目 (あとでもう一度結果ページを開いた人に出す分) の surface / source。
 * 1回目と分けて数えられるように、別の値にする。
 */
export const RESULT_INVITE_CARD_AGAIN_SOURCE = "me_read_end_again";

/**
 * 2回目を出してよくなるまでの時間 (1回目を出してから)。
 * 2026-11-25: 1人1回 → 2回まで。友達の回答が0人のまま戻ってきた人に、もう一度だけ出す。
 * 同じ訪問の中で続けて出さないよう、1回目から30分以上あいた訪問だけを対象にする。
 */
export const RESULT_INVITE_CARD_AGAIN_AFTER_MS = 30 * 60 * 1000;

/**
 * 友達診断ページを見たあとの人に出す分の surface / source (2026-11-25)。
 * 友達診断ページで同じ招待カードを見た人が、あとで結果ページに戻ってきたときに1回だけ出す。
 * 友達診断ページを見てから RESULT_INVITE_CARD_AGAIN_AFTER_MS 以上あいた訪問だけを対象にする。
 * 回数は全体の上限 (1人2回まで) の中で数える。
 */
export const RESULT_INVITE_CARD_AFTER_TAKO_SOURCE = "me_read_end_after_tako";

const SHOWN_PREFIX = "wt_result_invite_card_shown_v1:";
const SHOWN_AT_PREFIX = "wt_result_invite_card_shown_at_v1:";
const AGAIN_PREFIX = "wt_result_invite_card_again_v1:";
const TAKO_SEEN_AT_PREFIX = "wt_result_invite_card_tako_seen_at_v1:";
const AFTER_TAKO_PREFIX = "wt_result_invite_card_after_tako_v1:";

/** 1回目を出した目印 (owner_token ごと)。 */
export function resultInviteCardShownKey(ownerToken: string): string {
  return `${SHOWN_PREFIX}${ownerToken}`;
}

/**
 * 1回目を出した時刻 (ミリ秒)。2026-11-25 より前に出した人には無い
 * (その人たちは、次に開いたときから2回目の対象にする)。
 */
export function resultInviteCardShownAtKey(ownerToken: string): string {
  return `${SHOWN_AT_PREFIX}${ownerToken}`;
}

/** 2回目を出した目印 (owner_token ごと)。3回目は出さない。 */
export function resultInviteCardAgainKey(ownerToken: string): string {
  return `${AGAIN_PREFIX}${ownerToken}`;
}

/**
 * 友達診断ページを最後に見た時刻 (ミリ秒)。友達診断ページ側 (TakoViewTracker) が残す。
 * 2026-11-25 より前に見た人には無い (その人たちは、次に結果ページを開いたときから対象にする)。
 */
export function resultInviteCardTakoSeenAtKey(ownerToken: string): string {
  return `${TAKO_SEEN_AT_PREFIX}${ownerToken}`;
}

/** 友達診断ページを見たあとの人に出した目印 (owner_token ごと)。この出し方は1回だけ。 */
export function resultInviteCardAfterTakoKey(ownerToken: string): string {
  return `${AFTER_TAKO_PREFIX}${ownerToken}`;
}
