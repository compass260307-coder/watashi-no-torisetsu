"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ResultUpgradeChat = dynamic(
  () =>
    import("@/components/result-upgrade/ResultUpgradeChat").then(
      (module) => module.ResultUpgradeChat,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center rounded-[28px] bg-[#F5F4FB] text-[14px] font-bold text-[#2E2E5C]/60">
        Aliceを呼んでいます…
      </div>
    ),
  },
);

type ResultUpgradeChatLauncherProps = {
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
  existingAnswers = [],
  initialState,
  premiumPaid,
  preview = false,
  className,
  style,
  children,
}: ResultUpgradeChatLauncherProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      (previousFocus ?? trigger)?.focus();
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
              role="dialog"
              aria-modal="true"
              aria-label="Aliceと結果をアップグレード"
              className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2E2E5C]/60 p-2 backdrop-blur-sm md:p-6"
            >
              <div className="relative h-[calc(100dvh-1rem)] w-full max-w-[720px] overflow-hidden rounded-[28px] shadow-[0_24px_70px_rgba(21,21,55,0.35)] md:h-[min(760px,calc(100dvh-3rem))]">
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="チャットを閉じる"
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span aria-hidden="true" className="text-[17px] leading-none">
                    ✕
                  </span>
                </button>
                <ResultUpgradeChat
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
