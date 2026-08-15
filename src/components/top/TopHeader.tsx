"use client";

// feat/top-page: 独立した白いヘッダーバー (16Personalities 型)。
// 構造: ロゴ(左) | メニュー + ログイン + 言語切替(右寄せ)。PC は横並び、SP はハンバーガー。
// 白背景・ダーク文字。下にキービジュアルのヒーローが続く。sticky で追従。
//
// 2026-08-15: 日本語版と韓国語版 (旧 KoTopHeader) を locale prop で統合。
// 文言・リンク先だけ CONTENT で分岐し、挙動・DOM は完全共通にする。
// DOM は旧 KoTopHeader 側の改良 (オーバーレイの button 化・ドロワーの
// pointer-events ラッパー) を両ロケールに採用。

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoginModal } from "@/components/LoginModal";
import { TakoLockPopover } from "@/components/TakoLockPopover";
import { resetLocalData } from "@/lib/reset-data";
import { localeSwitchPath, type SiteLocale } from "@/lib/locale-switch";
import { KO_TOP_CONTENT } from "@/i18n/ko/top";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

type NavItem = {
  label: string;
  href: string;
  // 友達診断テスト: owner_token があれば /tako/[token] に解決、無ければロック表示
  // (BottomNav の友達診断タブと同じ挙動)。
  tako?: boolean;
  // ログイン: 別ページ遷移ではなく、現在のページの上にモーダルで重ねる。
  login?: boolean;
  // disabled: 準備中 (グレー表示・リンクなし)。ページが公開できたら外す。
  disabled?: boolean;
};

type HeaderContent = {
  siteName: string;
  homeHref: string;
  nav: NavItem[];
  preparing: string;
  englishPreparing: string;
  currentLangLabel: string;
  otherLangMenuLabel: string;
  otherLangDrawerLabel: string;
  ariaLangSwitch: string;
  ariaLangMenuClose: string;
  menuTitle: string;
  ariaMenuOpen: string;
  ariaMenuClose: string;
  reset: { label: string; confirm: string; run: string; cancel: string };
};

// ナビ表記ルール: 機能名は「性格診断テスト / 友達診断テスト / 性格タイプ」で統一。
// (旧表記: 相互理解度 → 友達診断テスト、キャラ図鑑 → 性格タイプ。ナビのみの変更で
//  各ページ内のタイトル等は別途。) ログインは右端・言語切替の左に置く。
const CONTENT: Record<SiteLocale, HeaderContent> = {
  ja: {
    siteName: "ワタシのトリセツ",
    homeHref: "/",
    nav: [
      { label: "性格診断テスト", href: "/diagnosis" },
      { label: "友達診断テスト", href: "/tako", tako: true },
      { label: "性格タイプ", href: "/types" },
      { label: "運命の設計図", href: "/unmei" },
      { label: "占い師", href: "/hoshiyomi" },
      { label: "ログイン", href: "/login", login: true },
    ],
    preparing: "（準備中）",
    englishPreparing: "English（準備中）",
    currentLangLabel: "日本語",
    otherLangMenuLabel: "한국어",
    otherLangDrawerLabel: "한국어로 보기",
    ariaLangSwitch: "言語を切り替え",
    ariaLangMenuClose: "言語メニューを閉じる",
    menuTitle: "メニュー",
    ariaMenuOpen: "メニューを開く",
    ariaMenuClose: "メニューを閉じる",
    reset: {
      label: "データをリセット",
      confirm:
        "診断結果や招待リンクがこの端末から消えます。もとに戻せません。",
      run: "リセットする",
      cancel: "キャンセル",
    },
  },
  ko: {
    siteName: KO_TOP_CONTENT.siteName,
    homeHref: "/ko",
    nav: [
      { label: KO_TOP_CONTENT.navigation.diagnosis, href: "/ko/diagnosis" },
      { label: KO_TOP_CONTENT.navigation.friend, href: "/ko/tako", tako: true },
      { label: KO_TOP_CONTENT.navigation.types, href: "/ko/types" },
      { label: "운명의 설계도", href: "/ko/unmei" },
      { label: "별자리 상담사", href: "/ko/hoshiyomi" },
      { label: KO_TOP_CONTENT.navigation.login, href: "/ko/login", login: true },
    ],
    preparing: `(${KO_TOP_CONTENT.navigation.preparing})`,
    englishPreparing: `English（${KO_TOP_CONTENT.navigation.preparing}）`,
    currentLangLabel: "한국어",
    otherLangMenuLabel: "日本語",
    otherLangDrawerLabel: "日本語로 보기",
    ariaLangSwitch: "언어 변경",
    ariaLangMenuClose: "언어 메뉴 닫기",
    menuTitle: KO_TOP_CONTENT.navigation.menu,
    ariaMenuOpen: KO_TOP_CONTENT.navigation.menuOpen,
    ariaMenuClose: KO_TOP_CONTENT.navigation.menuClose,
    reset: {
      label: "데이터 초기화",
      confirm: "진단 결과와 초대 링크가 이 기기에서 삭제되며 되돌릴 수 없어요.",
      run: "초기화",
      cancel: "취소",
    },
  },
};

export default function TopHeader({
  locale = "ja",
}: {
  locale?: SiteLocale;
}) {
  const isKo = locale === "ko";
  const content = CONTENT[locale];
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // データリセットは誤操作防止のためドロワー内で確認ステップを挟む。
  const [confirmReset, setConfirmReset] = useState(false);
  const pathname = usePathname() ?? content.homeHref;
  const [currentSearch, setCurrentSearch] = useState("");
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  // 初期値 true (=ロックなし): 診断済みユーザーに一瞬ロックが見えるのを避ける
  // (BottomNav と同じ判断。未診断側は hydration 後にロックが現れる)。
  const [hasToken, setHasToken] = useState(true);
  const [takoLockOpen, setTakoLockOpen] = useState(false);

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
  }, [pathname]);

  const otherLocaleHref = localeSwitchPath(
    pathname,
    isKo ? "ja" : "ko",
    ownerToken,
    currentSearch,
  );

  const nav = content.nav.map((n) =>
    n.tako && ownerToken
      ? {
          ...n,
          href: `${isKo ? "/ko" : ""}/tako/${encodeURIComponent(ownerToken)}`,
        }
      : n,
  );

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

  // 日本語はページ側でフォントが確定しないため FONT_STACK を明示。
  // 韓国語は ko レイアウトのフォント設定をそのまま継承する。
  const fontStyle = isKo ? undefined : { fontFamily: FONT_STACK };

  const currentFlag = isKo ? <KoreaFlagIcon /> : <JapanFlagIcon />;
  const otherFlag = isKo ? <JapanFlagIcon /> : <KoreaFlagIcon />;

  // lg (1024px) では項目 6 つ + 言語切替が収まるよう小さめ・詰めめ、xl で従来サイズに。
  // whitespace-nowrap でラベルの途中折返しを禁止 (幅不足時は wrap せず溢れが分かるように)。
  const navLinkClass =
    "whitespace-nowrap text-[16px] xl:text-[20px] font-bold transition-colors hover:text-[#5B5BEF]";

  return (
    <header className="sticky top-0 z-50 w-full bg-white" style={fontStyle}>
      <div className="flex w-full items-center gap-4 px-8 py-4">
        {/* ロゴ (左) */}
        <Link
          href={content.homeHref}
          className="whitespace-nowrap text-[18px] xl:text-[21px] font-bold tracking-[0.01em]"
          style={{ color: NAVY }}
        >
          {content.siteName}
        </Link>

        {/* PC: メニュー + ログイン + 言語切替 (右寄せ)。lg は gap 詰めめ、xl で広げる */}
        <div className="ml-auto hidden items-center gap-5 xl:gap-8 lg:flex">
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
            ) : (
              <Link
                key={n.href}
                href={n.href}
                className={navLinkClass}
                style={{ color: NAVY }}
              >
                {n.label}
              </Link>
            ),
          )}

          {/* 言語切替。日本語/韓国語を相互に移動可能にする。 */}
          <div className="relative">
            <button
              type="button"
              aria-label={content.ariaLangSwitch}
              aria-expanded={langOpen}
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1.5 whitespace-nowrap text-[16px] xl:text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
              style={{ color: NAVY }}
            >
              {currentFlag}
              {content.currentLangLabel}
              <CaretDown />
            </button>

            {langOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setLangOpen(false)}
                  aria-label={content.ariaLangMenuClose}
                />
                <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-xl border border-[#2E2E5C]/10 bg-white py-1 shadow-[0_8px_24px_rgba(42,58,92,0.16)]">
                  <div
                    className="px-4 py-2.5 text-[15px] font-bold"
                    style={{ color: "#5B5BEF" }}
                  >
                    {content.currentLangLabel}
                  </div>
                  <Link
                    href={otherLocaleHref}
                    onClick={() => setLangOpen(false)}
                    className="block px-4 py-2.5 text-[15px] text-[#2E2E5C] transition-colors hover:bg-[#F5F5FF]"
                  >
                    {content.otherLangMenuLabel}
                  </Link>
                  <div className="px-4 py-2.5 text-[15px] text-[#B4B4C4]">
                    {content.englishPreparing}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SP: ハンバーガー (右) */}
        <button
          type="button"
          aria-label={content.ariaMenuOpen}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="ml-auto flex h-10 w-10 items-center justify-center lg:hidden"
        >
          <MenuIcon />
        </button>
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
          overflow-hidden のラッパーで包む (クリックはラッパーを素通しする)。 */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden lg:hidden">
        <nav
          aria-label={content.menuTitle}
          aria-hidden={!open}
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
            {nav.map((n) =>
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
              ) : (
                <Link
                  key={n.href}
                  href={n.href}
                  tabIndex={open ? 0 : -1}
                  onClick={() => setOpen(false)}
                  className="py-3.5 text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
                  style={{ color: NAVY }}
                >
                  {n.label}
                </Link>
              ),
            )}
            {/* SP の言語切替 */}
            <div
              className="flex items-center gap-1.5 py-3.5 text-[19px] font-bold"
              style={{ color: NAVY }}
            >
              {currentFlag}
              {content.currentLangLabel}
            </div>
            <Link
              href={otherLocaleHref}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 py-3.5 text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
              style={{ color: NAVY }}
            >
              {otherFlag}
              {content.otherLangDrawerLabel}
            </Link>

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
                      onClick={resetLocalData}
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

      {/* ログインモーダル (現在のページの上に重ねる) */}
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        locale={locale}
      />

      {/* 未診断でロック中の友達診断テストを押したときの吹き出し (BottomNav と共用)。
          画面下部・ボトムナビの友達診断タブの真上に出る。 */}
      <TakoLockPopover
        isOpen={takoLockOpen}
        onClose={() => setTakoLockOpen(false)}
        locale={locale}
      />
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

// 日の丸アイコン (言語切替マーク)。絵文字の国旗は Windows で表示されないため SVG で描く。
function JapanFlagIcon() {
  return (
    <svg width="22" height="15" viewBox="0 0 22 15" aria-hidden="true">
      <rect x="0.5" y="0.5" width="21" height="14" rx="2" fill="#FFFFFF" stroke="#D4D4DE" />
      <circle cx="11" cy="7.5" r="4" fill="#BC002D" />
    </svg>
  );
}

// 太極旗アイコン (言語切替マーク)。小サイズで潰れる四卦は省略し、太極のみの簡略版。
function KoreaFlagIcon() {
  return (
    <svg width="22" height="15" viewBox="0 0 22 15" aria-hidden="true">
      <rect x="0.5" y="0.5" width="21" height="14" rx="2" fill="#FFFFFF" stroke="#D4D4DE" />
      <path d="M7 7.5a4 4 0 0 1 8 0 2 2 0 0 1-4 0 2 2 0 0 0-4 0Z" fill="#CD2E3A" />
      <path d="M7 7.5a4 4 0 0 0 8 0 2 2 0 0 1-4 0 2 2 0 0 0-4 0Z" fill="#0047A0" />
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

function CaretDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
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

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke={NAVY} strokeWidth="2" strokeLinecap="round">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </g>
    </svg>
  );
}
