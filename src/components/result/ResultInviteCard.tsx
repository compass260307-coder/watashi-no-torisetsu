"use client";

// 自己診断結果ページ (/me) を一番下まで読んだ人に、友達診断ページの友達0人のときと同じ
// 招待カード (見出し「友達から見たあなたは？」+ LINE で送る) を開く (日本語のみ・1人2回まで)。
// 設定と背景は lib/result-invite-card.ts。
//
// - 出すタイミング: 一番下の課金カードが画面に入ってから 5 秒後 (2026-11-25 に 8 秒から短縮)。
//   宝箱・課金カード・シェアなどのモーダルが開いている間と、タブが裏にある間は待つ。
// - 2回目 (2026-11-25): 1回目を出してから30分以上あとに、もう一度結果ページを開いて
//   一番下まで来た人に、同じ条件でもう一度だけ出す。3回目は出さない。
// - 友達診断ページを見たあとの人 (2026-11-25): 以前は出さなかった。友達診断ページを見てから
//   30分以上あとに結果ページを開いて一番下まで来た人に、1回だけ出す (全体の2回までの中で数える)。
//   友達診断ページを見たかどうかは、下部ナビの未確認バッジが消えているかで見分ける。
// - 出さない相手: このカードを2回見た人。購入済み・友達の回答がある人は親が描画しない。
//   (11/23〜11/24 は半分の人にだけ出す A/B だった。友達診断率が上がったので全員に出す)
// - 計測: 中身 (InviteCardDialog の LockedInviteShare) が、既存の tako_invite_ui_shown / friend_invite_clicked を
//   surface / source = "me_read_end" (2回目は "me_read_end_again"、友達診断ページを見たあとの
//   人に出した分は "me_read_end_after_tako") で送る (新しいイベント名は足さない)。

import { useCallback, useEffect, useState } from "react";
import { InviteCardDialog } from "@/components/result/InviteCardDialog";
import {
  RESULT_INVITE_CARD_AFTER_TAKO_SOURCE,
  RESULT_INVITE_CARD_AGAIN_AFTER_MS,
  RESULT_INVITE_CARD_AGAIN_SOURCE,
  RESULT_INVITE_CARD_DELAY_MS,
  RESULT_INVITE_CARD_SOURCE,
  resultInviteCardAfterTakoKey,
  resultInviteCardAgainKey,
  resultInviteCardShownAtKey,
  resultInviteCardShownKey,
  resultInviteCardTakoSeenAtKey,
} from "@/lib/result-invite-card";
import { TAKO_ATTENTION_PENDING_KEY } from "@/lib/tako-attention";

// モーダル (宝箱・課金カード・シェア) が開いている間は出さない。
const OPEN_DIALOG_SELECTOR = '[role="dialog"], [aria-modal="true"]';
const RETRY_MS = 1000;
// 待ち続ける上限。モーダルを開いたまま・タブを裏にしたままの人を、いつまでも追いかけない。
const MAX_WAIT_MS = 3 * 60 * 1000;
const TITLE_ID = "result-invite-card-title";

interface ResultInviteCardProps {
  ownerToken: string;
  inviteCode: string;
  /** 友達診断への招待 URL (絶対 URL, /friend/[inviteCode])。 */
  inviteUrl: string;
  /** 「結果の見本を見る」の行き先 (友達診断ページの見本)。 */
  demoHref?: string;
  /** 一番下の課金カードの id。 */
  anchorId?: string;
  /** ローカル確認用: 出し分け・既読・バッジの条件を無視して出す。計測もしない。 */
  previewMode?: boolean;
  /** ローカル確認用: 待ち時間の上書き (ミリ秒)。 */
  previewDelayMs?: number;
}

export function ResultInviteCard({
  ownerToken,
  inviteCode,
  inviteUrl,
  demoHref,
  anchorId = "fullaccess-promo",
  previewMode = false,
  previewDelayMs,
}: ResultInviteCardProps) {
  const [open, setOpen] = useState(false);
  // いま開いているカードの計測名 (何回目か・友達診断ページを見たあとか、で分ける)。
  const [source, setSource] = useState<string>(RESULT_INVITE_CARD_SOURCE);
  const delayMs = previewDelayMs ?? RESULT_INVITE_CARD_DELAY_MS;

  // 次に出すなら何回目か。もう出さない人は null。
  // 保存領域が使えない環境では回数を守れないので、出さない。
  const nextRound = useCallback((): 1 | 2 | null => {
    if (previewMode) return 1;
    try {
      if (localStorage.getItem(resultInviteCardShownKey(ownerToken)) !== "1") return 1;
      if (localStorage.getItem(resultInviteCardAgainKey(ownerToken)) === "1") return null;
      // 1回目の時刻が無いのは、時刻を残す前 (2026-11-25 より前) に出した人。もう十分あいている。
      const shownAt = Number(localStorage.getItem(resultInviteCardShownAtKey(ownerToken)));
      if (shownAt > 0 && Date.now() - shownAt < RESULT_INVITE_CARD_AGAIN_AFTER_MS) return null;
      return 2;
    } catch {
      return null;
    }
  }, [ownerToken, previewMode]);

  // まだ友達診断ページを見ていない人かどうか (下部ナビの未確認バッジが残っている)。
  // バッジは結果ページを開いたときに別の部品 (TakoAttentionOnResult) が付けるので、
  // 開いた直後ではなく、出す直前に確かめる。
  const notYetVisitedTako = useCallback((): boolean => {
    if (previewMode) return true;
    try {
      return localStorage.getItem(TAKO_ATTENTION_PENDING_KEY) === ownerToken;
    } catch {
      return false;
    }
  }, [ownerToken, previewMode]);

  // 友達診断ページを見たあとの人に、いま出してよいか。この出し方は1回だけで、
  // 友達診断ページを見てから間があいた訪問に限る (見た直後に同じカードを続けて出さない)。
  const canShowAfterTako = useCallback((): boolean => {
    try {
      if (localStorage.getItem(resultInviteCardAfterTakoKey(ownerToken)) === "1") return false;
      // 時刻が無いのは、時刻を残す前 (2026-11-25 より前) に友達診断ページを見た人。もう十分あいている。
      const seenAt = Number(localStorage.getItem(resultInviteCardTakoSeenAtKey(ownerToken)));
      return !(seenAt > 0 && Date.now() - seenAt < RESULT_INVITE_CARD_AGAIN_AFTER_MS);
    } catch {
      return false;
    }
  }, [ownerToken]);

  useEffect(() => {
    const target = document.getElementById(anchorId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    let cancelled = false;
    let timer: number | undefined;
    let observer: IntersectionObserver | undefined;
    let waitedMs = 0;

    const show = () => {
      if (cancelled) return;
      const busy =
        document.visibilityState !== "visible" ||
        document.querySelector(OPEN_DIALOG_SELECTOR) !== null;
      if (busy) {
        waitedMs += RETRY_MS;
        if (waitedMs > MAX_WAIT_MS) return;
        timer = window.setTimeout(show, RETRY_MS);
        return;
      }
      // 待っている間に別タブで出した・友達診断ページを見た、の場合は出さない。
      const next = nextRound();
      if (next === null) return;
      const afterTako = !notYetVisitedTako();
      if (afterTako && !canShowAfterTako()) return;
      if (!previewMode) {
        try {
          if (next === 1) {
            localStorage.setItem(resultInviteCardShownKey(ownerToken), "1");
            localStorage.setItem(resultInviteCardShownAtKey(ownerToken), String(Date.now()));
          } else {
            localStorage.setItem(resultInviteCardAgainKey(ownerToken), "1");
          }
          if (afterTako) {
            localStorage.setItem(resultInviteCardAfterTakoKey(ownerToken), "1");
          }
        } catch {
          /* nextRound() が読めているので通常は起きない */
        }
      }
      setSource(
        afterTako
          ? RESULT_INVITE_CARD_AFTER_TAKO_SOURCE
          : next === 2
            ? RESULT_INVITE_CARD_AGAIN_SOURCE
            : RESULT_INVITE_CARD_SOURCE,
      );
      setOpen(true);
    };

    const start = () => {
      if (nextRound() === null) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          timer = window.setTimeout(show, delayMs);
        },
        // 課金カードの表示計測 (paywall_viewed) と同じ基準で「見えた」とする。
        { threshold: 0.2 },
      );
      observer.observe(target);
    };
    start();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [anchorId, canShowAfterTako, delayMs, nextRound, notYetVisitedTako, ownerToken, previewMode]);

  const close = useCallback(() => setOpen(false), []);

  if (!open) return null;

  // 見た目は友達診断ページの招待カード (TakoFriendTabs の日本語・友達0人) と同じ。
  return (
    <InviteCardDialog
      titleId={TITLE_ID}
      onClose={close}
      inviteUrl={inviteUrl}
      trackSource={previewMode ? undefined : source}
      ownerToken={ownerToken}
      inviteCode={inviteCode}
      demoHref={demoHref}
    />
  );
}
