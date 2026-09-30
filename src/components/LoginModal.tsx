"use client";

// ヘッダーの「ログイン」から開くモーダル。現在のページの上に暗幕 + 中央カードで重ねる
// (16personalities のログイン導線と同じ体験。別ページ遷移はしない)。
//   - 背景クリック / Esc / × で閉じる。
//   - 開いている間は背面のスクロールをロック。

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LoginCard } from "./LoginCard";
import type { ResultLocale } from "@/i18n/result";

export function LoginModal({
  open,
  onClose,
  locale = "ja",
}: {
  open: boolean;
  onClose: () => void;
  locale?: ResultLocale | "en" | "id";
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Esc で閉じる + 背面スクロールロック (open の間だけ)
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(cardRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!cardRef.current?.contains(document.activeElement) ||
            (e.shiftKey && document.activeElement === first) ||
            (!e.shiftKey && document.activeElement === last)) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // sticky ヘッダー (z-50 のスタッキングコンテキスト) の内側から呼ばれるため、
  // body 直下へポータルして BottomNav 等 (z-50) より確実に前面に出す。
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-5 py-10"
      role="dialog"
      aria-modal="true"
      aria-label={
        locale === "ko" ? "로그인" : locale === "en" ? "Sign in" : locale === "id" ? "Masuk" : "ログイン"
      }
    >
      {/* 暗幕: クリックで閉じる */}
      <div
        className="absolute inset-0 bg-[#2E2E5C]/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* カード本体 (暗幕より前面) */}
      <div ref={cardRef} className="relative z-10 w-full max-w-[440px]">
        <LoginCard onClose={onClose} locale={locale} />
      </div>
    </div>,
    document.body,
  );
}
