"use client";

// 自己診断結果ページ (/me) を一番下まで読んだ人に、友達診断ページの友達0人のときと同じ
// 招待カード (見出し「友達から見たあなたは？」+ LINE で送る) を1回だけ開く (日本語のみ)。
// 設定と背景は lib/result-invite-card.ts。
//
// - 出すタイミング: 一番下の課金カードが画面に入ってから 8 秒後。
//   宝箱・課金カード・シェアなどのモーダルが開いている間と、タブが裏にある間は待つ。
// - 出さない相手: すでに友達診断ページを見た人 (下部ナビの未確認バッジが消えている人)、
//   このカードを一度見た人、出し分けで control の人。購入済み・友達の回答がある人は親が描画しない。
// - 計測: 中身の LockedInviteShare が、既存の tako_invite_ui_shown / friend_invite_clicked を
//   surface / source = "me_read_end" で送る (新しいイベント名は足さない)。

import { useCallback, useEffect, useState } from "react";
import { LockedInviteShare } from "@/components/result/LockedInviteShare";
import { TakoEmptyInviteHeader } from "@/components/result/TakoEmptyInviteHeader";
import {
  RESULT_INVITE_CARD_DELAY_MS,
  RESULT_INVITE_CARD_SOURCE,
  resultInviteCardArm,
  resultInviteCardShownKey,
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
  const delayMs = previewDelayMs ?? RESULT_INVITE_CARD_DELAY_MS;

  // すでに一度出した人かどうか。保存領域が使えない環境では「1人1回」を守れないので、出した扱いにする。
  const alreadyShown = useCallback((): boolean => {
    if (previewMode) return false;
    try {
      return localStorage.getItem(resultInviteCardShownKey(ownerToken)) === "1";
    } catch {
      return true;
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
      if (alreadyShown() || !notYetVisitedTako()) return;
      if (!previewMode) {
        try {
          localStorage.setItem(resultInviteCardShownKey(ownerToken), "1");
        } catch {
          /* alreadyShown() が読めているので通常は起きない */
        }
      }
      setOpen(true);
    };

    const start = async () => {
      if (alreadyShown()) return;
      if (!previewMode) {
        try {
          if ((await resultInviteCardArm(ownerToken)) !== "card") return;
        } catch {
          return; // 群を決められない環境では出さない
        }
      }
      if (cancelled) return;
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
    void start();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [alreadyShown, anchorId, delayMs, notYetVisitedTako, ownerToken, previewMode]);

  // 開いている間は背面をスクロールさせない。Esc で閉じる。
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  // 見た目は友達診断ページの招待カード (TakoFriendTabs の日本語・友達0人) と同じ。
  return (
    <div
      className="animate-modal-fade-in fixed inset-0 z-[120] flex items-center justify-center bg-[#2E2E5C]/40 px-3 py-2 backdrop-blur-[2px] md:px-6 md:py-8"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        // 開いた直後のフォーカスはダイアログ本体へ。閉じるボタンに当てると選択枠が出っぱなしになる。
        tabIndex={-1}
        autoFocus
        className="animate-bubble-pop relative max-h-[calc(100dvh-1rem)] w-full max-w-[640px] overflow-y-auto rounded-[24px] border border-[#DEDFEC] bg-white shadow-[0_24px_70px_rgba(34,34,70,0.28)] outline-none md:max-h-[calc(100dvh-4rem)] md:rounded-[28px]"
        style={{ transformOrigin: "center" }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="招待カードを閉じる"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F9] text-[#9A9AB0] outline-none transition hover:bg-[#EBEBF3] hover:text-[#2E2E5C] focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/45 md:right-4 md:top-4"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="px-5 pb-6 pt-8 md:px-8 md:pb-8 md:pt-9">
          <TakoEmptyInviteHeader titleId={TITLE_ID} demoHref={demoHref} />
          <div className="mt-5">
            <LockedInviteShare
              inviteUrl={inviteUrl}
              trackSource={previewMode ? undefined : RESULT_INVITE_CARD_SOURCE}
              ownerToken={ownerToken}
              inviteCode={inviteCode}
              compact
              deferQr
              hideQr
              locale="ja"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
