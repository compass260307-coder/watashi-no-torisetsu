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
      <div className="flex h-full min-h-0 items-center justify-center rounded-[28px] bg-[#F5F4FB] text-[14px] font-bold text-[#2E2E5C]/60">
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
    const syncViewport = () => {
      if (!viewportRef.current) return;
      viewportRef.current.style.top = `${viewport?.offsetTop ?? 0}px`;
      viewportRef.current.style.height = `${viewport?.height ?? window.innerHeight}px`;
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
              className="fixed inset-x-0 top-0 h-svh z-[120] flex items-center justify-center bg-[#2E2E5C]/60 p-2 backdrop-blur-sm md:p-6"
            >
              <div className="relative h-full max-h-[760px] min-h-0 w-full max-w-[720px] overflow-hidden rounded-[28px] shadow-[0_24px_70px_rgba(21,21,55,0.35)]">
                <button
                  ref={closeRef}
                  type="button"
                  aria-label={copy.close}
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span aria-hidden="true" className="text-[17px] leading-none">
                    ✕
                  </span>
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
