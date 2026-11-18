"use client";

import { usePathname } from "next/navigation";
import { RESULT_UPGRADE_COPY, type ResultUpgradeLocale } from "@/i18n/result-upgrade";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

let pendingChat: Promise<typeof import("./ResultUpgradeChat")> | undefined;
function preloadChat() {
  return pendingChat ??= import("./ResultUpgradeChat").catch(error => {
    pendingChat = undefined;
    throw error;
  });
}

const ResultUpgradeChat = dynamic(
  () => preloadChat().then(module => module.ResultUpgradeChat),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center bg-[#FBF8F3] text-[14px] font-bold text-[#2E2E5C]/60">
        <UpgradeLoadingLabel />
      </div>
    ),
  },
);

function UpgradeLoadingLabel() {
  const pathname = usePathname();
  return RESULT_UPGRADE_COPY[pathname?.startsWith("/ko/") ? "ko" : "ja"].calling;
}

type ResultUpgradeChatLauncherProps = {
  locale?: ResultUpgradeLocale;
  ownerToken: string;
  existingAnswers?: string[];
  initialState?: string | null;
  premiumPaid: boolean;
  preview?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function ResultUpgradeChatLauncher({
  ownerToken,
  locale = "ja",
  existingAnswers = [],
  initialState,
  premiumPaid,
  preview = false,
  className,
  style,
  children,
}: ResultUpgradeChatLauncherProps) {
  const copy = RESULT_UPGRADE_COPY[locale];
  // The server mounts this launcher only for purchased results.
  // Warm code without requesting answers or starting Checkout.
  useEffect(() => { if (!preview) void preloadChat().catch(() => {}); }, [preview]);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const previousBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const previousFocus = document.activeElement as HTMLElement | null;
    const trigger = triggerRef.current;
    // Keep the underlying result at its original scroll position when iOS opens the keyboard.
    Object.assign(document.body.style, {
      overflow: "hidden", position: "fixed", top: `-${scrollY}px`, width: "100%",
    });
    const viewport = window.visualViewport;
    // LINEと同じく、キーボードが出たら見えている範囲いっぱいにチャットを縮め、入力欄をキーボードのすぐ上に置く。
    const syncViewport = () => {
      const overlay = viewportRef.current;
      if (!overlay) return;
      overlay.style.top = `${viewport?.offsetTop ?? 0}px`;
      overlay.style.height = `${viewport?.height ?? window.innerHeight}px`;
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    closeRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      Object.assign(document.body.style, previousBodyStyle);
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
      window.removeEventListener("keydown", handleKeyDown);
      (previousFocus ?? trigger)?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={style}
      >
        {children}
      </button>

      {open
        ? createPortal(
            <div
              ref={viewportRef}
              role="dialog"
              aria-modal="true"
              aria-label={copy.dialog}
              onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
              className="fixed inset-x-0 top-0 z-[120] flex h-svh justify-center overscroll-none bg-[#FBF8F3] md:items-center md:bg-[#2E2E5C]/55 md:p-6 md:backdrop-blur-sm"
            >
              <div className="relative h-full min-h-0 w-full overflow-hidden animate-chat-sheet-in md:max-h-[860px] md:max-w-[560px] md:rounded-[28px] md:shadow-[0_24px_70px_rgba(21,21,55,0.35)]">
                <button
                  ref={closeRef}
                  type="button"
                  aria-label={copy.close}
                  onClick={() => setOpen(false)}
                  className="absolute left-1.5 top-2.5 z-20 flex h-10 w-10 items-center justify-center rounded-full text-[#2E2E5C] transition-colors hover:bg-[#F2F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B5BEF]"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <ResultUpgradeChat
                  locale={locale}
                  ownerToken={ownerToken}
                  existingAnswers={existingAnswers}
                  initialState={initialState}
                  premiumPaid={premiumPaid}
                  preview={preview}
                  modal
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
