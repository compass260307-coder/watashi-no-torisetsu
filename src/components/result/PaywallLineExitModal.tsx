"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import LineAliceLinkCard, { type LineAliceTrackingSource } from "./LineAliceLinkCard";

// 旧設置位置の課金カードからだけ呼び出す、通常のLINE登録導線。
export default function PaywallLineExitModal({
  ownerToken,
  onClose,
  variant,
  trackingSource,
  previewMode = false,
}: {
  ownerToken?: string;
  onClose: () => void;
  variant: "conversation" | "fortune";
  trackingSource: LineAliceTrackingSource;
  previewMode?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        dialog?.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={variant === "fortune" ? "LINEでAliceに占ってもらう" : "LINEでもAliceと話す"}
      tabIndex={-1}
      ref={dialogRef}
      className="fixed inset-0 z-[110] overflow-y-auto overscroll-contain bg-[#2E2E5C]/35 px-3 py-5 backdrop-blur-[2px] md:py-8"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="pointer-events-none flex min-h-full items-center justify-center">
        <div className="pointer-events-auto relative w-full max-w-[1120px] px-3 pb-6 pt-10 md:px-6 md:pb-10">
          <LineAliceLinkCard
            ownerToken={ownerToken}
            trackingSource={trackingSource}
            onClose={onClose}
            variant={variant}
            previewMode={previewMode}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
