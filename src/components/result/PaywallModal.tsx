"use client";

// ロック要素の「今すぐアクセス」等を押したとき、その場でポップアップ表示する課金モーダル。
// 2026-07-22: 最下部カードへのスクロールから、モーダル形式に変更 (16Personalities 参考)。
//
// scroll-to-paywall.ts が発火する CustomEvent(PAYWALL_OPEN_EVENT) を全ページ共通で拾い、
// FullAccessPromoCard をオーバーレイ表示する。イベントを preventDefault することで
// スクロールへのフォールバックを止める (モーダルの無いページは従来スクロール)。
//
// props は最下部の常設 FullAccessPromoCard と同じ (ownerToken / group / imageSrc /
// locale / returnTo / variant)。カードの anchorId はモーダル専用値にして、常設カードと
// id を重複させない。

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FullAccessPromoCard } from "./FullAccessPromoCard";
import { PAYWALL_OPEN_EVENT } from "@/lib/scroll-to-paywall";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import type { ResultLocale } from "@/i18n/result";

interface PaywallModalProps {
  ownerToken?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  group?: ThirtyTwoGroup;
  variant?: "self" | "aisho";
  locale?: ResultLocale;
  returnTo?: "me" | "tako";
  surface?: "self" | "tako";
}

export function PaywallModal(props: PaywallModalProps) {
  // open は必ずクライアントの CustomEvent (ユーザークリック) 経由でのみ true になる。
  // そのため createPortal 時点では常にクライアント環境 (SSR ガード不要)。
  const [open, setOpen] = useState(false);

  // 開く要求 (scrollToPaywall からの CustomEvent) を拾う。preventDefault で
  // 呼び出し側のスクロールフォールバックを止める。
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener(PAYWALL_OPEN_EVENT, handler);
    return () => window.removeEventListener(PAYWALL_OPEN_EVENT, handler);
  }, []);

  // 開いている間は背面スクロールをロック + Esc で閉じる。
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isKorean = props.locale === "ko";

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isKorean ? "잠금 해제" : "ロック解除"}
      // 背景は固定 (スクロールしない)。箱を中央に置き、中身だけスクロールさせる。
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2E2E5C]/55 px-3 py-5 backdrop-blur-sm md:py-8"
      onClick={() => setOpen(false)}
    >
      {/* 箱: 高さ上限つき + 内部スクロール。中身(カード)がはみ出す分だけ箱内で
          スクロールする (背景全体はスクロールしない)。×はカード右上に内蔵。 */}
      <div
        className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-[1120px] overflow-y-auto overscroll-contain rounded-3xl md:max-h-[calc(100dvh-4rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <FullAccessPromoCard
          {...props}
          anchorId="fullaccess-promo-modal"
          onClose={() => setOpen(false)}
        />
      </div>
    </div>,
    document.body,
  );
}
