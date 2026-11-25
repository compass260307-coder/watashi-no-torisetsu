"use client";

// 友達診断の招待カードを、画面中央のダイアログとして開く (日本語)。
// 見た目は友達診断ページの招待カード (TakoFriendTabs の日本語・友達0人) と同じ。
// 自己診断結果ページ (ResultInviteCard) と、友達診断の見本ページ (TakoDemoInvite) で使う。
// 出すタイミングは呼び出し側が決める。このコンポーネントは描画されている間ずっと開いている。

import { useEffect } from "react";
import { LockedInviteShare } from "@/components/result/LockedInviteShare";
import { TakoEmptyInviteHeader } from "@/components/result/TakoEmptyInviteHeader";

interface InviteCardDialogProps {
  /** 見出しの id (ダイアログの aria-labelledby)。同じページに複数置くときは分ける。 */
  titleId: string;
  onClose: () => void;
  /** 友達診断への招待 URL (絶対 URL, /friend/[inviteCode])。 */
  inviteUrl: string;
  /** 計測の surface / source。省略時は計測しない。 */
  trackSource?: string;
  ownerToken?: string;
  inviteCode?: string;
  /** 「結果の見本を見る」の行き先。省略時はリンクを出さない。 */
  demoHref?: string;
}

export function InviteCardDialog({
  titleId,
  onClose,
  inviteUrl,
  trackSource,
  ownerToken,
  inviteCode,
  demoHref,
}: InviteCardDialogProps) {
  // 開いている間は背面をスクロールさせない。Esc で閉じる。
  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="animate-modal-fade-in fixed inset-0 z-[120] flex items-center justify-center bg-[#2E2E5C]/40 px-3 py-2 backdrop-blur-[2px] md:px-6 md:py-8"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // 開いた直後のフォーカスはダイアログ本体へ。閉じるボタンに当てると選択枠が出っぱなしになる。
        tabIndex={-1}
        autoFocus
        className="animate-bubble-pop relative max-h-[calc(100dvh-1rem)] w-full max-w-[640px] overflow-y-auto rounded-[24px] border border-[#DEDFEC] bg-white shadow-[0_24px_70px_rgba(34,34,70,0.28)] outline-none md:max-h-[calc(100dvh-4rem)] md:rounded-[28px]"
        style={{ transformOrigin: "center" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="招待カードを閉じる"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F9] text-[#9A9AB0] outline-none transition hover:bg-[#EBEBF3] hover:text-[#2E2E5C] focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/45 md:right-4 md:top-4"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="px-5 pb-6 pt-8 md:px-8 md:pb-8 md:pt-9">
          <TakoEmptyInviteHeader titleId={titleId} demoHref={demoHref} />
          <div className="mt-5">
            <LockedInviteShare
              inviteUrl={inviteUrl}
              trackSource={trackSource}
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
