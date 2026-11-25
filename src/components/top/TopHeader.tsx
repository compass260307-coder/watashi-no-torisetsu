"use client";

import { withTakoEntry } from "@/lib/tako-entry";
import { useNavigationCopy, useNavigationText } from "@/i18n/ui/use-navigation-copy";
// feat/top-page: 独立した白いヘッダーバー (16Personalities 型)。
// 構造: ロゴ(左) | メニュー + ログイン + 言語切替(右寄せ)。PC は横並び、SP はハンバーガー。
// 白背景・ダーク文字。下にキービジュアルのヒーローが続く。sticky で追従。
//
// 2026-08-15: 日本語版と韓国語版 (旧 KoTopHeader) を locale prop で統合。
// 文言・リンク先だけ CONTENT で分岐し、挙動・DOM は完全共通にする。
// DOM は旧 KoTopHeader 側の改良 (オーバーレイの button 化・ドロワーの
// pointer-events ラッパー) を両ロケールに採用。

import { DeferredLoginModal as LoginModal, DeferredPaywallOverlay as PaywallOverlay } from "@/components/DeferredOverlays";
import { AccessibilityStyleDialog, AccessibilityStyleIcon } from "@/components/AccessibilityStyleDialog";
import { TakoLockPopover } from "@/components/TakoLockPopover";
import { preloadPaywall } from "@/lib/paywall-loader";
import { accessPaywallVersionForLocale } from "@/lib/access-products";
import { localeSwitchPath, type SiteLocale } from "@/lib/locale-switch";
import { loginNotice } from "@/lib/login-recovery";
import { resetLocalData } from "@/lib/reset-data";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import { useAishoNavigationAccess } from "@/lib/use-aisho-navigation-access";
import { useCourseNavigationAccess } from "@/lib/use-course-navigation-access";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PaywallOverlay as PurchaseOverlayType } from "@/components/result/PaywallModal";
import { useCallback, useEffect, useId, useRef, useState, type ComponentProps, type ComponentType } from "react";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

// ヘッダー右のマーク (アクセシビリティスタイル / 言語) のボタン。
// 主役はロゴとメニューなので、マークは小さめ・淡いグレーで控えめに置く
// (2026-11-25 指示: 主張を弱く、マークどうしの余白を詰める)。
// 押せる範囲は縦 40px を保ち、横だけ詰める。
// 「コントラストを高める」では globals.css 側で濃くなる。
const HEADER_MARK_BUTTON_CLASS =
  "flex h-10 w-8 shrink-0 items-center justify-center rounded-full text-[#9AA1B4] transition-colors hover:bg-[#F1F2F6] hover:text-[#5A6072]";



type TopLocale = SiteLocale | "en" | "id";

// ナビ表記ルール: 機能名は「性格診断テスト / 友達診断テスト / 性格タイプ」で統一。
// (旧表記: 相互理解度 → 友達診断テスト、キャラ図鑑 → 性格タイプ。ナビのみの変更で
//  各ページ内のタイトル等は別途。) ログインは右端・言語切替の左に置く。

export default function TopHeader({
  locale = "ja",
  PurchaseOverlay = PaywallOverlay,
  preloadPurchaseOnIntent = true,
}: {
  locale?: TopLocale;
  preloadPurchaseOnIntent?: boolean;
  PurchaseOverlay?: ComponentType<ComponentProps<typeof PurchaseOverlayType>>;
}) {
  const uiText = useNavigationText(locale, "top.TopHeader");
  const isKo = locale === "ko";
  const isEn = locale === "en";
  const isId = locale === "id";
  const content = useNavigationCopy(locale).header;
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  // アクセシビリティスタイル (見え方の追加設定) のモーダル。
  const [a11yOpen, setA11yOpen] = useState(false);
  const closeA11y = useCallback(() => setA11yOpen(false), []);
  const languageDialogRef = useRef<HTMLDialogElement>(null);
  const languageTitleId = useId();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | undefined>();
  // データリセットは誤操作防止のためドロワー内で確認ステップを挟む。
  const [confirmReset, setConfirmReset] = useState(false);
  const pathname = usePathname() ?? content.homeHref;
  const [currentSearch, setCurrentSearch] = useState("");
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  // 初期値 true (=ロックなし): 診断済みユーザーに一瞬ロックが見えるのを避ける
  // (BottomNav と同じ判断。未診断側は hydration 後にロックが現れる)。
  const [hasToken, setHasToken] = useState(true);
  const [takoLockOpen, setTakoLockOpen] = useState(false);
  const [coursePaywall, setCoursePaywall] = useState<"hoshiyomi" | "tarot" | null>(null);
  // PaywallOverlay は onClose が変わるたびに effect を張り直し、そのたびに
  // 開く前のフォーカス先へ focus() し直す。毎レンダー新しい関数を渡すと
  // 開いている間もフォーカスが動くため、同じ関数を渡す。
  const closeCoursePaywall = useCallback(() => setCoursePaywall(null), []);
  const [desktopNavVisible, setDesktopNavVisible] = useState(false);

  // 相性診断の権限APIは、実際に導線を見せる直前まで呼ばない。
  // SPはドロワーを開いた時、PCは常時表示ナビの確定後に有1回だけ確認する。
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateDesktopNavVisibility = () => {
      setDesktopNavVisible(mediaQuery.matches);
    };
    updateDesktopNavVisibility();
    mediaQuery.addEventListener("change", updateDesktopNavVisibility);
    return () =>
      mediaQuery.removeEventListener("change", updateDesktopNavVisibility);
  }, []);

  const hasAishoNavigationAccess = useAishoNavigationAccess(
    pathname,
    open || desktopNavVisible,
  );

  // クライアント遷移で token が変わっても追従するよう pathname を依存に入れる。
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // localStorage 不可環境: フォールバックのまま。
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwnerToken(token);
    setHasToken(Boolean(token));
    setCurrentSearch(window.location.search);
    const url = new URL(window.location.href);
    if (url.searchParams.get("login") === "1") {
      setLoginMessage(loginNotice(locale, url.searchParams.get("login_error")));
      setLoginOpen(true);
      url.searchParams.delete("login");
      url.searchParams.delete("login_error");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, [pathname, locale]);

  const nativeLanguageNames: Record<TopLocale, string> = {
    ja: "日本語",
    ko: "한국어",
    en: "English",
    id: "Bahasa Indonesia",
  };
  const languageOptions = [
    {
      locale,
      localLabel: content.currentLangLabel,
      nativeLabel: nativeLanguageNames[locale],
      href: localeSwitchPath(pathname, locale, ownerToken, currentSearch),
    },
    ...content.languageOptions.map((option) => ({
      ...option,
      href: localeSwitchPath(pathname, option.locale, ownerToken, currentSearch),
    })),
  ];

  // 未確認・未購入は安全側のロック表示。購入済みと確認できた場合だけリンクを解放する。
  const resolvedCourseAccess = useCourseNavigationAccess(ownerToken);

  const warmPurchase = () => {
    if (preloadPurchaseOnIntent && PurchaseOverlay === PaywallOverlay) void preloadPaywall(locale).catch(() => {});
  };
  const purchaseIntent = { onPointerEnter: warmPurchase, onFocus: warmPurchase, onTouchStart: warmPurchase };
  const openCoursePaywall = (course: "astrologer" | "tarot") => {
    const target = course === "astrologer" ? "hoshiyomi" : course;
    const source = `nav_locked_${target}`;
    track("paywall_scroll_clicked", {
      ownerToken,
      metadata: {
        source,
        page: trackingPageFromPathname(pathname),
        surface: target,
        destination: target,
        paywall_version: accessPaywallVersionForLocale(locale),
      },
    });
    setCoursePaywall(target);
  };

  const nav = content.nav
    .filter(
      (item) =>
        !item.href.includes("/aisho") || hasAishoNavigationAccess,
    )
    .map((n) =>
      n.tako && ownerToken
        ? {
            ...n,
            href: withTakoEntry(`${isKo ? "/ko" : isEn ? "/en" : isId ? "/id" : ""}/tako/${encodeURIComponent(ownerToken)}`, "top_header"),
          }
        : n,
    );

  // ハンバーガーメニュー (SP ドロワー) は、自己診断が終わるまで「性格診断テスト / 性格タイプ / ログイン」だけにする
  // (2026-11-19 指示: 診断前に友達診断・相性・Alice・タロットを見せる必要はない)。
  // 診断済み (owner_token あり) なら従来どおり全項目を出す (未課金のコースは鍵付き)。
  // PC の常時表示ナビは対象外。
  const drawerNav = hasToken
    ? nav
    : nav.filter((n) => !n.tako && !n.course && !n.href.includes("/aisho"));

  // ドロワーを開いている間は背景スクロールを固定 + Escape で閉じる。
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
      // 閉じたら確認ステップを初期状態に戻す。
      setConfirmReset(false);
    };
  }, [open]);

  // 16Personalities と同様、言語一覧をページ中央のモーダルとして表示する。
  // dialog 要素により背景を inert にし、Escape とフォーカス移動はブラウザ標準に委ねる。
  useEffect(() => {
    const dialog = languageDialogRef.current;
    if (!dialog) return;

    if (langOpen && !dialog.open) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog.showModal();
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    } else if (!langOpen && dialog.open) {
      dialog.close();
    }
  }, [langOpen]);

  // 日本語はページ側でフォントが確定しないため FONT_STACK を明示。
  // 韓国語は ko レイアウトのフォント設定をそのまま継承する。
  const fontStyle = isKo ? undefined : { fontFamily: FONT_STACK };

  // lg (1024px) では項目 7 つ + 言語切替が収まるよう小さめ・詰めめ、xl で従来サイズに。
  // whitespace-nowrap でラベルの途中折返しを禁止 (幅不足時は wrap せず溢れが分かるように)。
  const navLinkClass =
    "whitespace-nowrap text-[16px] xl:text-[20px] font-bold transition-colors hover:text-[#5B5BEF]";
  // 常設ナビのリンク先はクリック時に取得し、ページ表示だけで発生する
  // RSC prefetchの増幅を避ける。
  const navigationPrefetch = false;

  return (
    <header className="sticky top-0 z-50 w-full bg-white" style={fontStyle}>
      {/* スマホ幅はバーの高さを 56px に抑える (2026-11-25 指示: 72px は縦に間延びして見える)。
          PC 幅はメニューの文字が並ぶため従来の 72px のまま。 */}
      <div className="flex w-full items-center gap-4 px-4 py-2 sm:px-8 lg:py-4">
        {/* ロゴ (左) */}
        <Link
          href={content.homeHref}
          prefetch={navigationPrefetch}
          // 右のマークが3つ並ぶため、320px 幅の英語ロゴなど収まらないときは
          // 横にはみ出させず末尾を省略する (日本語・韓国語は 320px でも収まる)。
          className="min-w-0 truncate text-[18px] xl:text-[21px] font-bold tracking-[0.01em]"
          style={{ color: NAVY }}
        >
          {content.siteName}
        </Link>

        {/* PC: メニュー + ログイン + 言語切替 (右寄せ)。lg は gap 詰めめ、xl で広げる */}
        <div className="ml-auto hidden items-center gap-5 lg:flex xl:gap-8">
          {nav.map((n) =>
            n.disabled ? (
              <span
                key={n.href}
                className="whitespace-nowrap text-[16px] xl:text-[20px] font-bold text-[#B4B4C4]"
                aria-disabled="true"
              >
                {n.label}
                <span className="text-[11px] xl:text-[13px]">
                  {content.preparing}
                </span>
              </span>
            ) : n.login ? (
              // ログインは遷移せずモーダルを開く
              <button
                key={n.href}
                type="button"
                onClick={() => setLoginOpen(true)}
                className={navLinkClass}
                style={{ color: NAVY }}
              >
                {n.label}
              </button>
            ) : n.tako && !hasToken ? (
              // 未診断時はロック表示: 遷移せずポップオーバーで解放条件を伝える
              // (BottomNav の友達診断タブと同じ挙動。色もロック中タブと同じグレー)。
              <button
                key={n.href}
                type="button"
                onClick={() => setTakoLockOpen(true)}
                className={`${navLinkClass} flex items-center gap-1`}
                style={{ color: "#9BA3B4" }}
              >
                {n.label}
                <MenuLockIcon />
              </button>
            ) : n.course && !resolvedCourseAccess?.[n.course] ? (
              <button
                key={n.href}
                type="button"
                aria-label={`${n.label}${
                  uiText("（ロック中）")
                }`}
                {...purchaseIntent}
                onClick={() => n.course && openCoursePaywall(n.course)}
                className={`${navLinkClass} flex items-center gap-1`}
                style={{ color: "#9BA3B4" }}
              >
                {n.label}
                <MenuLockIcon />
              </button>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                prefetch={navigationPrefetch}
                className={navLinkClass}
                style={{ color: NAVY }}
              >
                {n.label}
              </Link>
            ),
          )}

          {/* アクセシビリティスタイルと言語切替。16Personalities と同じく、
              控えめなグレーの丸いマーク2つを並べる (国旗・言語名は出さない)。
              どちらも押すと中央のモーダルを開く。 */}
          <div className="-mx-1 flex items-center">
            <button
              type="button"
              aria-label={content.accessibility.ariaOpen}
              title={content.accessibility.title}
              aria-haspopup="dialog"
              aria-expanded={a11yOpen}
              onClick={() => setA11yOpen(true)}
              className={HEADER_MARK_BUTTON_CLASS}
            >
              <AccessibilityStyleIcon size={22} />
            </button>
            <button
              type="button"
              aria-label={`${content.ariaLangSwitch}: ${content.currentLangLabel}`}
              title={content.languageModalTitle}
              aria-haspopup="dialog"
              aria-expanded={langOpen}
              onClick={() => setLangOpen(true)}
              className={HEADER_MARK_BUTTON_CLASS}
            >
              <GlobeIcon size={22} />
            </button>
          </div>
        </div>

        {/* SP: 言語選択をハンバーガーメニューから独立させる。 */}
        <div className="ml-auto flex shrink-0 items-center lg:hidden">
          <button
            type="button"
            aria-label={content.accessibility.ariaOpen}
            aria-haspopup="dialog"
            aria-expanded={a11yOpen}
            onClick={() => setA11yOpen(true)}
            className={HEADER_MARK_BUTTON_CLASS}
          >
            <AccessibilityStyleIcon size={20} />
          </button>
          <button
            type="button"
            aria-label={`${content.ariaLangSwitch}: ${content.currentLangLabel}`}
            aria-haspopup="dialog"
            aria-expanded={langOpen}
            onClick={() => setLangOpen(true)}
            className={HEADER_MARK_BUTTON_CLASS}
          >
            <GlobeIcon size={20} />
          </button>
          <button
            type="button"
            aria-label={content.ariaMenuOpen}
            aria-expanded={open}
            {...purchaseIntent}
            onClick={() => { warmPurchase(); setOpen(true); }}
            className="flex h-10 w-10 items-center justify-center"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {/* SP: 横からスライドインするドロワー (右→左)。
          アニメーションのため常時マウントし、transform / opacity で出し入れする。 */}
      {/* オーバーレイ (背景を暗くする) */}
      <button
        type="button"
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-label={content.ariaMenuClose}
        tabIndex={open ? 0 : -1}
      />

      {/* ドロワー本体。閉状態の translate-x-full が横スクロールを生まないよう
          overflow-hidden のラッパーで包む (クリックはラッパーを素通しする)。
          閉じている間は inert + invisible にしてフォーカスできなくする。
          以前は、ロック項目 → 課金カード → 閉じる、の流れで課金カードが
          ドロワー内のロック項目へフォーカスを戻し、overflow-hidden のラッパーが
          横スクロールして閉じたはずのドロワーが画面に出たまま × で閉じられなくなっていた。 */}
      <div
        className={`pointer-events-none fixed inset-0 z-50 overflow-hidden transition-[visibility] duration-300 lg:hidden ${
          open ? "visible" : "invisible"
        }`}
      >
        <nav
          aria-label={content.menuTitle}
          aria-hidden={!open}
          inert={!open}
          className={`pointer-events-auto absolute inset-y-0 right-0 flex w-[78%] max-w-[320px] flex-col bg-white shadow-[0_0_40px_rgba(42,58,92,0.2)] transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* ヘッダー: 閉じるボタン */}
          <div className="flex items-center justify-between border-b border-[#2E2E5C]/10 px-6 py-4">
            <span className="text-[16px] font-bold" style={{ color: NAVY }}>
              {content.menuTitle}
            </span>
            <button
              type="button"
              aria-label={content.ariaMenuClose}
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
              className="flex h-10 w-10 items-center justify-center"
            >
              <CloseIcon />
            </button>
          </div>

          {/* リンク一覧 */}
          <div className="flex flex-col px-6 py-2">
            {drawerNav.map((n) =>
              n.disabled ? (
                <span
                  key={n.href}
                  className="py-3.5 text-[19px] font-bold text-[#B4B4C4]"
                  aria-disabled="true"
                >
                  {n.label}
                  <span className="text-[12px]">{content.preparing}</span>
                </span>
              ) : n.login ? (
                // ログインは遷移せずモーダルを開く (SP はメニューを閉じてから)
                <button
                  key={n.href}
                  type="button"
                  tabIndex={open ? 0 : -1}
                  onClick={() => {
                    setOpen(false);
                    setLoginOpen(true);
                  }}
                  className="w-full py-3.5 text-left text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
                  style={{ color: NAVY }}
                >
                  {n.label}
                </button>
              ) : n.tako && !hasToken ? (
                // 未診断時はロック表示。ドロワーを閉じてからポップオーバーを出すと、
                // 吹き出しの矢印がボトムナビのロック中「友達診断」タブを指して場所も伝わる。
                <button
                  key={n.href}
                  type="button"
                  tabIndex={open ? 0 : -1}
                  onClick={() => {
                    setOpen(false);
                    setTakoLockOpen(true);
                  }}
                  className="flex w-full items-center gap-1.5 py-3.5 text-left text-[19px] font-bold"
                  style={{ color: "#9BA3B4" }}
                >
                  {n.label}
                  <MenuLockIcon />
                </button>
              ) : n.course && !resolvedCourseAccess?.[n.course] ? (
                <button
                  key={n.href}
                  type="button"
                  tabIndex={open ? 0 : -1}
                  aria-label={`${n.label}${
                    uiText("（ロック中）")
                  }`}
                  {...purchaseIntent}
                  onClick={() => {
                    setOpen(false);
                    if (n.course) openCoursePaywall(n.course);
                  }}
                  className="flex w-full items-center gap-1.5 py-3.5 text-left text-[19px] font-bold"
                  style={{ color: "#9BA3B4" }}
                >
                  {n.label}
                  <MenuLockIcon />
                </button>
              ) : (
                <Link
                  key={n.href}
                  href={n.href}
                  prefetch={navigationPrefetch}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setOpen(false)}
                  className="py-3.5 text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
                  style={{ color: NAVY }}
                >
                  {n.label}
                </Link>
              ),
            )}
            {/* データをリセット (誤操作防止に確認ステップを挟む) */}
            <div className="mt-2 border-t border-[#2E2E5C]/10 pt-3">
              {!confirmReset ? (
                <button
                  type="button"
                  tabIndex={open ? 0 : -1}
                  onClick={() => setConfirmReset(true)}
                  className="flex w-full items-center gap-1.5 py-2 text-left text-[15px] font-bold text-[#B4415C] transition-colors hover:text-[#8f2f45]"
                >
                  <ResetIcon />
                  {content.reset.label}
                </button>
              ) : (
                <div className="rounded-xl bg-[#FBE9EC] p-3.5">
                  <p
                    className={`text-[13px] font-bold leading-relaxed text-[#8f2f45] ${
                      isKo ? "break-keep" : ""
                    }`}
                  >
                    {content.reset.confirm}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      tabIndex={open ? 0 : -1}
                      // リセット後は、いま見ている言語のトップへ戻す (以前はどの言語でも日本語トップへ戻っていた)。
                      onClick={() => resetLocalData(isKo ? "/ko" : isEn ? "/en" : isId ? "/id" : "/")}
                      className="flex-1 rounded-full bg-[#B4415C] py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[#8f2f45]"
                    >
                      {content.reset.run}
                    </button>
                    <button
                      type="button"
                      tabIndex={open ? 0 : -1}
                      onClick={() => setConfirmReset(false)}
                      className="flex-1 rounded-full bg-white py-2.5 text-[14px] font-bold transition-colors hover:bg-[#f3f3f7]"
                      style={{ color: NAVY }}
                    >
                      {content.reset.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* PC / SP 共通の言語選択モーダル。 */}
      <dialog
        ref={languageDialogRef}
        aria-labelledby={languageTitleId}
        onCancel={(event) => {
          event.preventDefault();
          setLangOpen(false);
        }}
        onClose={() => setLangOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setLangOpen(false);
        }}
        className="m-auto max-h-[min(720px,calc(100dvh-32px))] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-xl bg-transparent p-0 text-left shadow-[0_24px_80px_rgba(20,30,50,0.3)] backdrop:bg-[#273247]/45 backdrop:backdrop-blur-[1px]"
        style={fontStyle}
      >
        <div className="overflow-hidden rounded-xl bg-white">
          <div className="flex items-center justify-between border-b border-[#E7E8ED] px-6 py-5 sm:px-10 sm:py-7">
            <h2
              id={languageTitleId}
              className="text-[26px] font-extrabold tracking-[-0.02em] sm:text-[32px]"
              style={{ color: NAVY }}
            >
              {content.languageModalTitle}
            </h2>
            <button
              type="button"
              aria-label={content.ariaLangMenuClose}
              onClick={() => setLangOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D9DCE4] text-[#7D8493] transition-colors hover:border-[#BFC3CE] hover:bg-[#F4F5F7] hover:text-[#34394A]"
            >
              <CloseIcon size={18} color="currentColor" />
            </button>
          </div>

          <div className="max-h-[min(590px,calc(100dvh-130px))] overflow-y-auto py-2 sm:py-3">
            {languageOptions.map((option) =>
              option.locale === locale ? (
                <div
                  key={option.locale}
                  aria-current="true"
                  className="bg-[#F2F3F5] px-6 py-4 sm:px-10 sm:py-5"
                >
                  <span>
                    <span className="block text-[18px] font-extrabold leading-tight text-[#34394A] sm:text-[20px]">
                      {option.localLabel}
                    </span>
                    <span className="mt-1 block text-[15px] leading-tight text-[#717887] sm:text-[16px]">
                      {option.nativeLabel}
                    </span>
                  </span>
                </div>
              ) : (
                <Link
                  key={option.locale}
                  href={option.href}
                  prefetch={navigationPrefetch}
                  hrefLang={option.locale}
                  lang={option.locale}
                  onClick={() => setLangOpen(false)}
                  className="block px-6 py-4 transition-colors hover:bg-[#F7F7F9] focus-visible:bg-[#F7F7F9] focus-visible:outline-none sm:px-10 sm:py-5"
                >
                  <span>
                    <span className="block text-[18px] font-extrabold leading-tight text-[#34394A] sm:text-[20px]">
                      {option.localLabel}
                    </span>
                    <span className="mt-1 block text-[15px] leading-tight text-[#717887] sm:text-[16px]">
                      {option.nativeLabel}
                    </span>
                  </span>
                </Link>
              ),
            )}
          </div>
        </div>
      </dialog>

      {/* アクセシビリティスタイルのモーダル (開いている間だけ描画)。 */}
      {a11yOpen ? (
        <AccessibilityStyleDialog
          copy={content.accessibility}
          onClose={closeA11y}
          style={fontStyle}
        />
      ) : null}

      {/* ログインモーダル (現在のページの上に重ねる) */}
      {loginOpen ? (
        <LoginModal open onClose={() => { setLoginOpen(false); setLoginMessage(undefined); }} locale={locale} notice={loginMessage} />
      ) : null}

      {/* 未診断でロック中の友達診断テストを押したときの吹き出し (BottomNav と共用)。
          画面下部・ボトムナビの友達診断タブの真上に出る。 */}
      <TakoLockPopover
        isOpen={takoLockOpen}
        onClose={() => setTakoLockOpen(false)}
        locale={locale}
      />

      {coursePaywall ? (
        <PurchaseOverlay
          ownerToken={ownerToken ?? undefined}
          locale={locale}
          returnTo={coursePaywall === "tarot" ? "me" : "hoshiyomi"}
          ctaSource={`nav_locked_${coursePaywall}`}
          // 未課金の人が鍵付きの Alice・タロットを押したときは宝箱にする (2026-11-20 指示)。
          // 友達診断ページ上で押したときも同じく宝箱にする (2026-11-25 指示)。
          treasureEntry={resolvedCourseAccess?.paid === false}
          products={coursePaywall === "tarot" ? ["full_access"] : ["full_access", "premium_bundle"]}
          defaultProduct="full_access"
          heading={
            isKo || coursePaywall === "tarot"
              ? undefined
              : uiText("Aliceを試す・本格相談を選ぶ")
          }
          onClose={closeCoursePaywall}
        />
      ) : null}
    </header>
  );
}

// 未診断時に「友達診断テスト」の横に付けるミニ南京錠。BottomNav の LockBadge と同モチーフ。
function MenuLockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" fill="currentColor" />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// 言語切替のマーク (地球)。国旗は言語と国が一対一でないため使わない。
// 塗りの丸から陸地を抜いた形 (fill-rule: evenodd)。currentColor で文字色に追従。
function GlobeIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20ZM6.3 5.6C7.9 4.3 10.3 3.8 12.3 4.5c.8 1 .1 2.1-1 2.8c-.5 1.1.4 2-.4 3.1c-1 .7-2.1-.1-3.1-.9c-1-.6-2.1-.8-2.8-1.6c.2-.9.6-1.7 1.3-2.3ZM10.9 12.4c1.3-.4 2.9.2 3.5 1.5c.2 1.4-.8 2.5-1.4 3.7c-.4 1-1 1.9-1.7 1.5c-.4-1.2-.3-2.5-1-3.5c-.6-1-.4-2.5.6-3.2ZM16.7 6.2c1.3.3 2.6 1.5 3.2 3.1c.4 1.4.4 2.9 0 4.1c-1 .2-2.1-.6-2.5-1.8c-.8-.8-1.8-1.6-1.6-3c0-1 .3-1.9.9-2.4Z"
      />
    </svg>
  );
}

// リセット (ぐるっと回る矢印) アイコン。currentColor で文字色に追従。
function ResetIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12a8 8 0 1 1 2.3 5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 20v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke={NAVY} strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </g>
    </svg>
  );
}

function CloseIcon({ size = 24, color = NAVY }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </g>
    </svg>
  );
}
