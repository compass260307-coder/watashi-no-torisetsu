"use client";

// 友達診断の結果ページで、上部バー (MeStickyHeader) のボタンから、タブ列の「＋招待」と同じ
// 招待カード (TakoFriendTabs) を開くためのつなぎ。
//
// 2026-11-25: 上部バーは以前、別の招待モーダル (「友達に診断してもらおう」・丸いSNSアイコン +
// 招待リンク + QRコード) を開いていた。使わないことにしたので、同じページの招待カードを開く。

import { createContext } from "react";

/**
 * 上部バーが「招待カードを開いて」と頼むイベント (cancelable)。
 * 招待カードを持つ TakoFriendTabs が preventDefault() して開く。
 * 受け手がいないページでは、送り手 (MeStickyHeader) が従来のモーダルを開く。
 */
export const TAKO_INVITE_CARD_OPEN_EVENT = "torisetsu:open-tako-invite-card";

/** 招待カードの計測名の上書き。上部バーから開いた分を、これまでと同じ名前で数え続けるため。 */
export interface InviteTrackOverride {
  /** friend_invite_clicked の metadata.source。 */
  source: string;
  /** tako_invite_ui_shown の metadata.surface。 */
  surface: string;
}

/** 上部バーから開いた招待カード: 以前のモーダルと同じ名前 (source / surface) で数える。 */
export const STICKY_BAR_INVITE_TRACK: InviteTrackOverride = {
  source: "tako_sticky_bar",
  surface: "sticky_modal",
};

/** LockedInviteShare が読む。null のときは、呼び出し側が渡した trackSource のまま。 */
export const InviteTrackOverrideContext = createContext<InviteTrackOverride | null>(null);
