"use client";

import { isMotionReduced } from "@/lib/a11y-style";
import { useUiText } from "@/i18n/ui/use-ui-copy";

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

import type { AppResultLocale } from "@/i18n/result";
import type { AccessProduct } from "@/lib/access-products";
import { paywallCardMode, type PaywallCardMode } from "@/lib/feature-flags";
import { jaFullAccessOfferForQuote, type JaFullAccessPriceArm } from "@/lib/full-access-pricing";
import { useFullAccessQuote } from "@/lib/use-full-access-quote";
import { FullAccessTreasure } from "./FullAccessTreasure";
import { fullAccessTreasureLayoutFor, type FullAccessTreasureLayout } from "@/lib/full-access-treasure-layout";
import { preloadTreasureScene } from "@/components/result-upgrade/ResultUpgradeTreasure";
import { PAYWALL_OPEN_EVENT } from "@/lib/scroll-to-paywall";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FullAccessPromoCard } from "./FullAccessPromoCard";

interface PaywallModalProps {
  ownerToken?: string;
  imageSrc?: string | null;
  /** キャラ別PDF表紙を選ぶための元キャラ画像。 */
  reportCharacterImageSrc?: string | null;
  imageAlt?: string;
  group?: ThirtyTwoGroup;
  variant?: "self" | "aisho";
  locale?: AppResultLocale;
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
  cardMode?: PaywallCardMode;
  /**
   * 導線(ctaSource)に関係なく宝箱の対象にする。日本語・完全版(日本円)の見積もりなどの条件は従来どおり。
   * 自己診断結果ページのモーダルと、下部ナビ・ハンバーガーメニューのロック(Alice・相性・タロット)で使う。
   */
  treasureEntry?: boolean;
  /** 友達診断ページの上部バー・鍵つきの友達タブから開いたときも宝箱にする（日本語の友達診断ページで指定）。 */
  takoTreasure?: boolean;
}

// オーバーレイ本体 (制御コンポーネント)。マウント中は常に表示。
// 呼び出し側がユーザー操作 (クリック) 経由でマウントする前提のため、
// createPortal 時点では常にクライアント環境 (SSR ガード不要)。
export function PaywallOverlay({
  onClose,
  ctaSource,
  friendName,
  scrollLocked = false,
  treasureEntry = false,
  treasurePreviewArm,
  treasurePreviewLayout,
  ...cardProps
}: PaywallModalProps & {
  onClose: () => void;
  ctaSource?: string;
  /** 鍵つきの友達タブから開いたとき、その友達の呼び名。宝箱の先頭の特典の説明に使う。 */
  friendName?: string;
  scrollLocked?: boolean;
  /** ローカルのプレビュー専用: 価格テストのどちらの群の値札を宝箱に出すか。 */
  treasurePreviewArm?: JaFullAccessPriceArm;
  /** ローカルのプレビュー専用: 宝箱の特典の見せ方を指定する（未指定なら本番と同じく owner_token で決まる）。 */
  treasurePreviewLayout?: FullAccessTreasureLayout;
}) {
  const presentation = useFullAccessTreasurePresentation(cardProps, ctaSource, treasureEntry);
  // 宝箱の特典の見せ方（A/B）。owner_token から決まるまでの一瞬は、暗い背景だけを出す。
  const assignedLayout = useFullAccessTreasureLayout(cardProps.ownerToken);
  const treasureLayout = treasurePreviewLayout ?? assignedLayout;
  if (presentation.mode === "pending" || (presentation.mode === "treasure" && treasureLayout === null)) {
    return createPortal(
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[100] bg-[#2E2E5C]/55 backdrop-blur-sm"
        onClick={onClose}
      />,
      document.body,
    );
  }
  if (presentation.mode === "treasure") {
    return (
      <FullAccessTreasure
        ownerToken={cardProps.ownerToken}
        ctaSource={ctaSource}
        returnTo={cardProps.returnTo}
        surface={cardProps.surface}
        variant={cardProps.variant}
        previewMode={cardProps.previewMode}
        previewArm={treasurePreviewArm}
        layout={treasureLayout ?? "stack"}
        friendName={friendName}
        priceState={presentation.priceState}
        onClose={onClose}
      />
    );
  }
  return (
    <PaywallCardOverlay
      {...cardProps}
      ctaSource={ctaSource}
      scrollLocked={scrollLocked}
      onClose={onClose}
    />
  );
}

/** 宝箱の特典の見せ方（A/B の群）。owner_token から計算し終えるまでは null。 */
function useFullAccessTreasureLayout(ownerToken: string | undefined): FullAccessTreasureLayout | null {
  const [layout, setLayout] = useState<FullAccessTreasureLayout | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fullAccessTreasureLayoutFor(ownerToken).then((value) => {
      if (!cancelled) setLayout(value);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerToken]);
  return layout;
}

// 日本語Webの完全版（日本円の見積もり。¥499 / 価格テストの¥699）で、対象の導線から開いたときだけ、課金カードの代わりに宝箱の演出を出す。
// 2026-11-19: 小規模テストとして、自己診断結果の本文にあるロック解除CTA（「今すぐアクセス」系）だけを対象にする。
// 同日、自己診断結果ページ上部の固定バー（sticky_bar）も対象に加えた。友達診断ページの上部バーも
// 同じ sticky_bar を使うため、そちらは surface="tako" で除外する。
// 2026-11-20: 自己診断結果ページからの流入は導線を問わず全て宝箱にする(ページ下部のカードも含む)。
// 下部ナビ・ハンバーガーメニューのロック(Alice・相性・タロット)も宝箱にする。どちらも treasureEntry で指定する。
// 友達診断ページ・相性ページの課金カードは従来のまま。
const TREASURE_CTA_SOURCES: ReadonlySet<string> = new Set([
  "love_payoff_card",
  "love_endure_card",
  "career_fit_card",
  "career_relations_card",
  "deepdive_card",
  "scene_caution_card",
  "moshimo_card",
  "friend_dislike_card",
  "relations_card",
  "caution_lock_card",
  "traits_card",
]);
// 自己診断結果ページ（surface が tako 以外）のときだけ宝箱にする導線。
const TREASURE_SELF_ONLY_CTA_SOURCES: ReadonlySet<string> = new Set(["sticky_bar"]);
// 友達診断ページで宝箱にする導線（takoTreasure を指定したページだけ）。
// 上部バー・鍵つきの友達タブ・ページ末尾のカード（価格を出さずに宝箱を開くボタン）。
const TREASURE_TAKO_CTA_SOURCES: ReadonlySet<string> = new Set([
  "sticky_bar",
  "friend_list",
  "tako_promo_card",
  // 未購入・回答1人の上部バーのプレゼントの丸ボタン。
  "tako_gift_icon",
]);
// 見積もりが返るまでは暗い背景だけを出し、返らなければ従来のカードにする。
// 一度決めた表示は、見積もりがあとから届いても切り替えない。
const TREASURE_QUOTE_WAIT_MS = 2500;

function useFullAccessTreasurePresentation(
  cardProps: PaywallModalProps,
  ctaSource: string | undefined,
  treasureEntry: boolean,
) {
  const locale = cardProps.locale ?? "ja";
  const previewMode = cardProps.previewMode ?? false;
  const takoTreasureSource =
    cardProps.surface === "tako" &&
    Boolean(cardProps.takoTreasure) &&
    ctaSource !== undefined &&
    TREASURE_TAKO_CTA_SOURCES.has(ctaSource);
  const treasureSource =
    takoTreasureSource ||
    (treasureEntry && cardProps.surface !== "tako") ||
    (ctaSource !== undefined &&
    (TREASURE_CTA_SOURCES.has(ctaSource) ||
      (TREASURE_SELF_ONLY_CTA_SOURCES.has(ctaSource) && cardProps.surface !== "tako")));
  // 見本表示では導線を問わず宝箱にする。友達診断ページの見本だけは、本番と同じ条件で決める。
  const previewTreasure = previewMode && (cardProps.surface !== "tako" || takoTreasureSource);
  const eligible =
    (previewTreasure || treasureSource) &&
    locale === "ja" &&
    !cardProps.legacyPlanStyle &&
    cardProps.variant !== "aisho" &&
    (cardProps.cardMode ?? paywallCardMode()) === "legacy";
  const priceState = useFullAccessQuote(eligible && !previewMode, "ja", cardProps.ownerToken);
  const [decision, setDecision] = useState<"treasure" | "card" | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const { quote, failed } = priceState;
  if (decision === null) {
    const next = !eligible
      ? "card"
      : previewMode
        ? "treasure"
        : quote
          ? jaFullAccessOfferForQuote(quote) !== null
            ? "treasure"
            : "card"
          : failed || timedOut
            ? "card"
            : null;
    if (next) setDecision(next);
  }
  useEffect(() => {
    if (decision !== null) return;
    const timer = window.setTimeout(() => setTimedOut(true), TREASURE_QUOTE_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [decision]);
  return {
    mode: decision ?? "pending",
    priceState,
  } as const;
}

function PaywallCardOverlay({
  onClose,
  ctaSource,
  scrollLocked = false,
  ...cardProps
}: PaywallModalProps & {
  onClose: () => void;
  ctaSource?: string;
  scrollLocked?: boolean;
}) {
  const uiText = useUiText(cardProps.locale ?? "ja", "result.PaywallModal");
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // 開いている間は背面スクロールとフォーカスを閉じ込め、閉じたら元の操作先に戻す。
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusableElements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );
    focusableElements()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const elements = focusableElements();
      if (elements.length === 0) {
        e.preventDefault();
        dialog?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const focusIsOutside = !dialog?.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || focusIsOutside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || focusIsOutside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);


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

    const reduceMotion = isMotionReduced();
    container.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={uiText("ロック解除")}
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
        aria-label={uiText("モーダル上部へ戻る")}
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
        <span>{uiText("上へ")}</span>
      </button>
    </div>,
    document.body,
  );
}

export function PaywallModal(
  props: PaywallModalProps & {
    /** 見本表示専用: 宝箱の特典の見せ方を指定する（未指定なら本番と同じく owner_token で決まる）。 */
    treasurePreviewLayout?: FullAccessTreasureLayout;
  },
) {
  // open は必ずクライアントの CustomEvent (ユーザークリック) 経由でのみ true になる。
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [friendName, setFriendName] = useState<string | null>(null);

  // 開く要求 (scrollToPaywall からの CustomEvent) を拾う。preventDefault で
  // 呼び出し側のスクロールフォールバックを止める。
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      const detail = (e as CustomEvent<{ source?: unknown; friendName?: unknown }>).detail;
      setSource(typeof detail?.source === "string" ? detail.source : null);
      setFriendName(typeof detail?.friendName === "string" ? detail.friendName : null);
      setOpen(true);
    };
    window.addEventListener(PAYWALL_OPEN_EVENT, handler);
    return () => window.removeEventListener(PAYWALL_OPEN_EVENT, handler);
  }, []);

  // このページのどのCTAからも宝箱が開くとき（自己診断結果ページ）は、ページを読んでいる間の空き時間に
  // 最初の場面の絵を読み込んでおく。押してから読み込むと、宝箱が出るまで間が空く。
  // 通信量を節約する設定の人には先読みしない。
  const warmsTreasure =
    (props.surface === "tako" ? Boolean(props.takoTreasure) : Boolean(props.treasureEntry)) &&
    (props.locale ?? "ja") === "ja" &&
    !props.previewMode &&
    !props.legacyPlanStyle &&
    props.variant !== "aisho" &&
    (props.cardMode ?? paywallCardMode()) === "legacy";
  useEffect(() => {
    if (!warmsTreasure) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    let idle: number | null = null;
    // ページ自体の読み込みを邪魔しないよう、少し待ってから手の空いたときに始める。
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(() => preloadTreasureScene(), { timeout: 3000 });
      } else {
        preloadTreasureScene();
      }
    }, 1500);
    return () => {
      window.clearTimeout(timer);
      if (idle !== null) window.cancelIdleCallback(idle);
    };
  }, [warmsTreasure]);

  if (!open) return null;

  return (
    <PaywallOverlay
      {...props}
      ctaSource={source ?? undefined}
      friendName={friendName ?? undefined}
      onClose={() => setOpen(false)}
    />
  );
}
