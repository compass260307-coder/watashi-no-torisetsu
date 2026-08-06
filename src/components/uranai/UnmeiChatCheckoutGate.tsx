"use client";

// /unmei のチャット決済ゲート (2026-08-06)。
// 既定では LP (children) をそのまま見せ、LP の「設計図を作成する →」CTA が発火する
// CustomEvent("unmei-chat-launch") を受けたら、チャット決済を全画面オーバーレイで起動する。
// オーバーレイはヘッダー/フッター/ボトムナビ (z-40) を覆って非表示にし (z-[100])、
// 右上の × で LP に戻れる。背景スクロールはロックする。
//
// 決済完了→鑑定生成が終わると UnmeiClient が router.refresh() を呼び、サーバが鑑定本文
// (unmeiFlag=true) を返してこのゲートごと差し替わるため、オーバーレイは自然に消える。

import { useCallback, useEffect, useState } from "react";
import UnmeiClient from "@/components/uranai/UnmeiClient";

type Props = {
  purchase: {
    ownerToken: string | null;
    product: "unmei" | "unmei_upgrade";
  };
  children: React.ReactNode;
};

export default function UnmeiChatCheckoutGate({ purchase, children }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onLaunch = () => setOpen(true);
    window.addEventListener("unmei-chat-launch", onLaunch);
    return () => window.removeEventListener("unmei-chat-launch", onLaunch);
  }, []);

  // オーバーレイ表示中は背景 (LP) のスクロールを止める。
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {children}
      {open ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#F3F3FB]">
          <button
            type="button"
            onClick={close}
            aria-label="閉じる"
            className="fixed right-3 top-3 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#2E2E5C] shadow-[0_2px_8px_rgba(46,46,92,0.18)] backdrop-blur transition-colors hover:bg-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <UnmeiClient initialState="no_birth" purchase={purchase} />
        </div>
      ) : null}
    </>
  );
}
