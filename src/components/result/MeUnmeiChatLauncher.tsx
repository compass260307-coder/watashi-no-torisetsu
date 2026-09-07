"use client";

// /me の「運命の設計図」カードから、Alice のチャット (出生情報の補足質問 →
// チャット内決済 → 設計図生成) を /me 上のフルスクリーンオーバーレイで立ち上げる。
// フロー本体は /unmei のチャット決済 (UnmeiClient purchase モード) をそのまま使い、
// 生成完了時だけ /unmei の鑑定ページへ遷移する (onReady)。

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import type { ResultLocale } from "@/i18n/result";
import { ME_UNMEI_CHAT_INTRO_JA } from "@/i18n/unmei";
import { track } from "@/lib/track";

const LAUNCHER_COPY = {
  ja: { close: "チャットを閉じる" },
  ko: { close: "채팅 닫기" },
} as const;

export function MeUnmeiChatLauncher({
  ownerToken,
  locale = "ja",
  product = locale === "ja" ? "full_access" : "premium_bundle",
  previewMode = false,
  source = "unmei_promo_card",
  className,
  style,
  children,
}: {
  ownerToken: string | null;
  locale?: ResultLocale;
  product?: "full_access" | "premium_bundle";
  /** ?previewType プレビューでは保存・計測・決済を実行しない。 */
  previewMode?: boolean;
  /** purchase_cta_clicked の設置場所識別子 (カード / 本文末尾CTA を分けて測る)。 */
  source?: string;
  className?: string;
  style?: CSSProperties;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const copy = LAUNCHER_COPY[locale];

  // チャット起動中は背面 (/me 本文) のスクロールを止める + Esc で閉じる。
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleOpen = () => {
    if (!previewMode) {
      track("purchase_cta_clicked", {
        ownerToken,
        metadata: {
          page: "me",
          product,
          locale,
          ui: "chat_launch",
          source,
        },
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={className}
        style={style}
      >
        {children}
      </button>
      {open
        ? // カード自体は DeepDiveSections 等の stacking context 内にあり、その場に fixed を
          // 置くと /me の stickyヘッダー (z-50) やボトムナビに負ける。body 直下へポータルで
          // 出し、PaywallModal (z-[100]) より上の z-[110] で全面を覆う。
          // 見た目は PaywallOverlay と同じモーダル形式 (暗背景 + 中央カード + 角の✕)。
          // 背景クリックでは閉じない (チャット進行・決済中の誤タップで消さないため)。
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={copy.close}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-[#2E2E5C]/55 px-3 py-5 backdrop-blur-sm md:py-8"
            >
              <div className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-3xl md:max-h-[calc(100dvh-4rem)]">
                {/* チャット窓の紺ヘッダー右端に重ねる✕ (PaywallModal の作法) */}
                <button
                  type="button"
                  aria-label={copy.close}
                  onClick={() => setOpen(false)}
                  className="absolute right-6 top-7 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 md:right-10 md:top-10"
                >
                  <span aria-hidden="true" className="text-[16px] leading-none">
                    ✕
                  </span>
                </button>
                <UnmeiClient
                  initialState="no_birth"
                  purchase={{ ownerToken, product }}
                  locale={locale}
                  previewMode={previewMode}
                  intro={locale === "ja" ? ME_UNMEI_CHAT_INTRO_JA : undefined}
                  hideHeaderStars
                  onReady={() =>
                    router.push(locale === "ko" ? "/ko/unmei" : "/unmei")
                  }
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
