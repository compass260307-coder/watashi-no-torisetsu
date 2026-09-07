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
//
// 2026-07-28: オーバーレイ本体を PaywallOverlay として分離。イベント駆動 (PaywallModal)
// のほか、下部ナビのロック相性タブなど「タップでその場で開きたい」呼び出し元が
// open/onClose を自前管理して直接使えるようにした。

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FullAccessPromoCard } from "./FullAccessPromoCard";
import { PAYWALL_OPEN_EVENT } from "@/lib/scroll-to-paywall";
import type { AccessProduct } from "@/lib/access-products";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import type { ResultLocale } from "@/i18n/result";

interface PaywallModalProps {
  ownerToken?: string;
  imageSrc?: string | null;
  /** キャラ別PDF表紙を選ぶための元キャラ画像。 */
  reportCharacterImageSrc?: string | null;
  imageAlt?: string;
  group?: ThirtyTwoGroup;
  variant?: "self" | "aisho";
  locale?: ResultLocale;
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  surface?: "self" | "tako";
  products?: readonly AccessProduct[];
  /** ローカルUI確認用。計測・権利確認・Checkoutを実行しない。 */
  previewMode?: boolean;
  /** 3コース化以前のコンパクトな単一課金カード表示。 */
  legacyPlanStyle?: boolean;
  /** 3コース比較で最初に表示するコース。 */
  defaultProduct?: AccessProduct;
  /** モーダルを開いた導線に合わせた見出し。 */
  heading?: string;
}

// オーバーレイ本体 (制御コンポーネント)。マウント中は常に表示。
// 呼び出し側がユーザー操作 (クリック) 経由でマウントする前提のため、
// createPortal 時点では常にクライアント環境 (SSR ガード不要)。
export function PaywallOverlay({
  onClose,
  ctaSource,
  scrollLocked = false,
  ...cardProps
}: PaywallModalProps & {
  onClose: () => void;
  ctaSource?: string;
  scrollLocked?: boolean;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // 開いている間は背面スクロールをロック + Esc で閉じる。
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const isKorean = cardProps.locale === "ko";

  const updateScrollToTopVisibility = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const maxScroll = Math.max(
      0,
      container.scrollHeight - container.clientHeight,
    );
    const distanceFromBottom = maxScroll - container.scrollTop;
    const nextVisible = maxScroll > 300 && distanceFromBottom <= 64;
    setShowScrollToTop((current) =>
      current === nextVisible ? current : nextVisible,
    );
  };

  const scrollModalToTop = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    container.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isKorean ? "잠금 해제" : "ロック解除"}
      // 背景は固定 (スクロールしない)。箱を中央に置き、中身だけスクロールさせる。
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2E2E5C]/55 px-3 py-5 backdrop-blur-sm md:py-8"
      onClick={onClose}
    >
      {/* 箱: 高さ上限つき + 内部スクロール。中身(カード)がはみ出す分だけ箱内で
          スクロールする (背景全体はスクロールしない)。×はカード右上に内蔵。 */}
      <div
        ref={scrollContainerRef}
        className={`relative max-h-[calc(100dvh-2.5rem)] w-full max-w-[1120px] overscroll-contain rounded-3xl md:max-h-[calc(100dvh-4rem)] ${
          scrollLocked ? "overflow-hidden" : "overflow-y-auto"
        }`}
        onClick={(e) => e.stopPropagation()}
        onScroll={updateScrollToTopVisibility}
      >
        <FullAccessPromoCard
          {...cardProps}
          anchorId="fullaccess-promo-modal"
          ctaSource={ctaSource}
          onClose={onClose}
        />
      </div>
      <button
        type="button"
        aria-label={isKorean ? "모달 맨 위로 이동" : "モーダル上部へ戻る"}
        aria-hidden={!showScrollToTop}
        tabIndex={showScrollToTop ? 0 : -1}
        onClick={(event) => {
          event.stopPropagation();
          scrollModalToTop();
        }}
        className={`fixed left-1/2 z-[110] flex h-11 -translate-x-1/2 items-center gap-1 rounded-full bg-[#2A3A5C] px-3 text-[12px] font-black text-white shadow-[0_7px_20px_rgba(42,58,92,0.3)] transition duration-200 touch-manipulation active:scale-95 print:hidden md:hidden ${
          showScrollToTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
        style={{ top: "calc(72px + env(safe-area-inset-top))" }}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 15 6-6 6 6" />
        </svg>
        <span>{isKorean ? "맨 위로" : "上へ"}</span>
      </button>
    </div>,
    document.body,
  );
}

export function PaywallModal(props: PaywallModalProps) {
  // open は必ずクライアントの CustomEvent (ユーザークリック) 経由でのみ true になる。
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  // 開く要求 (scrollToPaywall からの CustomEvent) を拾う。preventDefault で
  // 呼び出し側のスクロールフォールバックを止める。
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const detail = (e as CustomEvent<{ source?: unknown }>).detail;
      setSource(typeof detail?.source === "string" ? detail.source : null);
      setOpen(true);
    };
    window.addEventListener(PAYWALL_OPEN_EVENT, handler);
    return () => window.removeEventListener(PAYWALL_OPEN_EVENT, handler);
  }, []);

  if (!open) return null;

  return (
    <PaywallOverlay
      {...props}
      ctaSource={source ?? undefined}
      onClose={() => setOpen(false)}
    />
  );
}
