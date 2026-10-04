"use client";

// /me の「運命の設計図」カードから、Alice のチャット (出生情報の補足質問 →
// チャット内決済 → 設計図生成) を /me 上のフルスクリーンオーバーレイで立ち上げる。
// フロー本体は /unmei のチャット決済 (UnmeiClient purchase モード) をそのまま使い、
// 生成完了時だけ /unmei の鑑定ページへ遷移する (onReady)。

import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AppResultLocale } from "@/i18n/result";
import { track } from "@/lib/track";

// Keep the purchase dialog eager. Only this optional, post-purchase chat and
// its birth/checkout dependencies are downloaded when the chat is opened.
const MeUnmeiChat = lazy(() =>
  import("./MeUnmeiChat").then((module) => ({ default: module.MeUnmeiChat })),
);

const CHAT_FEEDBACK = {
  ja: { loading: "Aliceを呼んでいます…", failed: "チャットを読み込めませんでした。", reload: "ページを再読み込み" },
  en: { loading: "Loading Alice…", failed: "The chat could not be loaded.", reload: "Reload this page" },
  ko: { loading: "Alice를 부르고 있어요…", failed: "채팅을 불러오지 못했어요.", reload: "페이지 새로고침" },
  id: { loading: "Memuat Alice…", failed: "Chat tidak dapat dimuat.", reload: "Muat ulang halaman" },
  th: { loading: "กำลังเรียก Alice…", failed: "ไม่สามารถโหลดแชตได้", reload: "โหลดหน้านี้ใหม่" },
} as const;

function ChatLoading({ locale }: { locale: AppResultLocale }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-56 items-center justify-center gap-3 rounded-3xl bg-[#2E2E5C] px-6 text-sm font-bold text-white">
      <span aria-hidden="true" className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white motion-safe:animate-spin" />
      {CHAT_FEEDBACK[locale].loading}
    </div>
  );
}

// A failed optional download must leave the result page and close button usable.
class ChatLoadBoundary extends Component<{ locale: AppResultLocale; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    const copy = CHAT_FEEDBACK[this.props.locale];
    return (
      <div role="alert" className="rounded-3xl bg-[#2E2E5C] px-6 py-16 text-center text-sm font-bold text-white">
        <p>{copy.failed}</p>
        <button type="button" className="mt-4 rounded-full border px-5 py-2" onClick={() => window.location.reload()}>{copy.reload}</button>
      </div>
    );
  }
}

const LAUNCHER_COPY = {
  ja: { close: "チャットを閉じる" },
  ko: { close: "채팅 닫기" },
  en: { close: "Close chat" },
  id: { close: "Tutup chat" },
} as const;

export function MeUnmeiChatLauncher({
  ownerToken,
  locale = "ja",
  product = "full_access",
  previewMode = false,
  source = "unmei_promo_card",
  className,
  style,
  children,
}: {
  ownerToken: string | null;
  locale?: AppResultLocale;
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
                <ChatLoadBoundary locale={locale}>
                  <Suspense fallback={<ChatLoading locale={locale} />}>
                    <MeUnmeiChat
                      ownerToken={ownerToken}
                      product={product}
                      locale={locale}
                      previewMode={previewMode}
                      onReady={() =>
                        router.push(
                          locale === "en"
                            ? "/en/unmei"
                            : locale === "ko"
                              ? "/ko/unmei"
                              : "/unmei",
                        )
                      }
                    />
                  </Suspense>
                </ChatLoadBoundary>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
