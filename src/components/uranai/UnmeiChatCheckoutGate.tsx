"use client";

// /unmei のチャット決済ゲート (2026-08-06)。
// 既定では LP (children) を見せ、LP の「設計図を作成する →」CTA が発火する
// CustomEvent("unmei-chat-launch") を受けたら、LP の上へチャット決済をモーダル表示する。
// 自己診断結果ページの課金カードと同じく、元ページを残したまま背景タップ・×・Escで
// 閉じられる。ポータルで body 直下へ出し、親要素の transform / overflow の影響を避ける。
//
// 購入CTAからStripe-hosted Checkoutへ遷移し、完了後は /unmei?checkout=success の
// チャット形式生成待ちへ戻る。

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import UnmeiClient from "@/components/uranai/UnmeiClient";

type Props = {
  purchase: {
    ownerToken: string | null;
    product: "premium_bundle";
  };
  children: React.ReactNode;
};

export default function UnmeiChatCheckoutGate({ purchase, children }: Props) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onLaunch = () => {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setOpen(true);
    };
    window.addEventListener("unmei-chat-launch", onLaunch);
    return () => window.removeEventListener("unmei-chat-launch", onLaunch);
  }, []);

  // モーダル表示中だけ背面スクロールを止め、閉じたら起動元CTAへフォーカスを戻す。
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [close, open]);

  return (
    <>
      {/* LP はマウントしたまま背面に残す (計測二重発火・スクロール喪失を避ける)。 */}
      <div>{children}</div>

      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="unmei-chat-dialog-title"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2E2E5C]/55 px-3 py-4 backdrop-blur-sm md:py-8"
              onClick={close}
            >
              <div
                className="relative max-h-[calc(100dvh-2rem)] w-full max-w-[1080px] overflow-y-auto overscroll-contain rounded-2xl bg-transparent shadow-[0_24px_80px_rgba(24,24,58,0.35)] md:max-h-[calc(100dvh-4rem)] [&>main]:max-w-none [&>main]:p-0"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 id="unmei-chat-dialog-title" className="sr-only">
                  運命の設計図を作成する
                </h2>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label="閉じる"
                  className="absolute right-2.5 top-2.5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#2E2E5C] shadow-[0_4px_16px_rgba(46,46,92,0.24)] transition hover:scale-105 active:scale-95 md:right-4 md:top-4"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
                <UnmeiClient initialState="no_birth" purchase={purchase} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
