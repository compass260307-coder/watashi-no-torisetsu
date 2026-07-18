"use client";

// feat/top-page: 独立した白いヘッダーバー (16Personalities 型)。
// 構造: ロゴ(左) | メニュー + ログイン + 言語切替(右寄せ)。PC は横並び、SP はハンバーガー。
// 白背景・ダーク文字。下にキービジュアルのヒーローが続く。sticky で追従。

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoginModal } from "@/components/LoginModal";
import { resetLocalData } from "@/lib/reset-data";
import { localeSwitchPath } from "@/lib/locale-switch";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

// ナビ表記ルール: 機能名は「性格診断テスト / 友達診断テスト / 性格タイプ」で統一。
// (旧表記: 相互理解度 → 友達診断テスト、キャラ図鑑 → 性格タイプ。ナビのみの変更で
//  各ページ内のタイトル等は別途。) ログインは右端・言語切替の左に置く。
// disabled: 準備中 (グレー表示・リンクなし)。ページが公開できたら外す。
const NAV: { label: string; href: string; disabled?: boolean }[] = [
  { label: "性格診断テスト", href: "/diagnosis" },
  // 友達診断テストの href は実行時に上書き (BottomNav と同じ /tako/[token] 解決)。
  { label: "友達診断テスト", href: "/tako" },
  { label: "性格タイプ", href: "/types" },
  { label: "ログイン", href: "/login" },
];

export default function TopHeader() {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  // ログインは別ページ遷移ではなく、現在のページの上にモーダルで重ねる。
  const [loginOpen, setLoginOpen] = useState(false);
  // データリセットは誤操作防止のためドロワー内で確認ステップを挟む。
  const [confirmReset, setConfirmReset] = useState(false);
  const pathname = usePathname() ?? "/";

  // 友達診断テストの遷移先を BottomNav と同じルールで解決:
  //   localStorage の owner_token があれば /tako/[token]、無ければ /tako (未診断ガード)。
  //   クライアント遷移で token が変わっても追従するよう pathname を依存に入れる。
  const [takoUrl, setTakoUrl] = useState("/tako");
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // localStorage 不可環境: フォールバックのまま。
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTakoUrl(token ? `/tako/${token}` : "/tako");
    setOwnerToken(token);
  }, [pathname]);

  const koreanHref = localeSwitchPath(pathname, "ko", ownerToken);

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


  const nav = NAV.map((n) =>
    n.label === "友達診断テスト" ? { ...n, href: takoUrl } : n,
  );

  // lg (1024px) では項目 5 つ + 言語切替が収まるよう小さめ・詰めめ、xl で従来サイズに。
  // whitespace-nowrap でラベルの途中折返しを禁止 (幅不足時は wrap せず溢れが分かるように)。
  const navLinkClass =
    "whitespace-nowrap text-[16px] xl:text-[20px] font-bold transition-colors hover:text-[#5B5BEF]";

  return (
    <header
      className="sticky top-0 z-50 w-full bg-white"
      style={{ fontFamily: FONT_STACK }}
    >
      <div className="flex w-full items-center gap-4 px-8 py-4">
        {/* ロゴ (左) */}
        <Link
          href="/"
          className="whitespace-nowrap text-[18px] xl:text-[21px] font-bold tracking-[0.01em]"
          style={{ color: NAVY }}
        >
          ワタシのトリセツ
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
                <span className="text-[11px] xl:text-[13px]">（準備中）</span>
              </span>
            ) : n.href === "/login" ? (
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

          {/* 言語切替。韓国語トップを公開し、日本語/韓国語を相互に移動可能にする。 */}
          <div className="relative">
            <button
              type="button"
              aria-label="言語を切り替え"
              aria-expanded={langOpen}
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1.5 whitespace-nowrap text-[16px] xl:text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
              style={{ color: NAVY }}
            >
              <GlobeIcon />
              日本語
              <CaretDown />
            </button>

            {langOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLangOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-xl border border-[#2E2E5C]/10 bg-white py-1 shadow-[0_8px_24px_rgba(42,58,92,0.16)]"
                  style={{ fontFamily: FONT_STACK }}
                >
                  <div
                    className="px-4 py-2.5 text-[15px] font-bold"
                    style={{ color: "#5B5BEF" }}
                  >
                    日本語
                  </div>
                  <Link
                    href={koreanHref}
                    onClick={() => setLangOpen(false)}
                    className="block px-4 py-2.5 text-[15px] text-[#2E2E5C] transition-colors hover:bg-[#F5F5FF]"
                  >
                    한국어
                  </Link>
                  <div className="px-4 py-2.5 text-[15px] text-[#B4B4C4]">
                    English（準備中）
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SP: ハンバーガー (右) */}
        <button
          type="button"
          aria-label="メニューを開く"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="ml-auto flex h-10 w-10 items-center justify-center lg:hidden"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <g stroke={NAVY} strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </g>
          </svg>
        </button>
      </div>

      {/* SP: 横からスライドインするドロワー (右→左)。
          アニメーションのため常時マウントし、transform / opacity で出し入れする。 */}
      {/* オーバーレイ (背景を暗くする) */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      {/* ドロワー本体 */}
      <nav
        aria-label="メニュー"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[78%] max-w-[320px] flex-col bg-white shadow-[0_0_40px_rgba(42,58,92,0.2)] transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ fontFamily: FONT_STACK }}
      >
        {/* ヘッダー: 閉じるボタン */}
        <div className="flex items-center justify-between border-b border-[#2E2E5C]/10 px-6 py-4">
          <span className="text-[16px] font-bold" style={{ color: NAVY }}>
            メニュー
          </span>
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <g stroke={NAVY} strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </g>
            </svg>
          </button>
        </div>

        {/* リンク一覧 */}
        <div className="flex flex-col px-6 py-2">
          {nav.map((n) =>
            n.disabled ? (
              <span
                key={n.href}
                className="block py-3.5 text-[19px] font-bold text-[#B4B4C4]"
                aria-disabled="true"
              >
                {n.label}
                <span className="text-[12px]">（準備中）</span>
              </span>
            ) : n.href === "/login" ? (
              // ログインは遷移せずモーダルを開く (SP はメニューを閉じてから)
              <button
                key={n.href}
                type="button"
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  setOpen(false);
                  setLoginOpen(true);
                }}
                className="block w-full py-3.5 text-left text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
                style={{ color: NAVY }}
              >
                {n.label}
              </button>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="block py-3.5 text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
                style={{ color: NAVY }}
              >
                {n.label}
              </Link>
            ),
          )}
          {/* SP の言語切替 */}
          <div className="flex items-center gap-1.5 py-3.5 text-[19px] font-bold" style={{ color: NAVY }}>
            <GlobeIcon />
            日本語
          </div>
          <Link
            href={koreanHref}
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
            className="pb-3.5 text-[17px] font-bold text-[#5B5BEF]"
          >
            한국어로 보기
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
                データをリセット
              </button>
            ) : (
              <div className="rounded-xl bg-[#FBE9EC] p-3.5">
                <p className="text-[13px] font-bold leading-relaxed text-[#8f2f45]">
                  診断結果や招待リンクがこの端末から消えます。もとに戻せません。
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    tabIndex={open ? 0 : -1}
                    onClick={resetLocalData}
                    className="flex-1 rounded-full bg-[#B4415C] py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-[#8f2f45]"
                  >
                    リセットする
                  </button>
                  <button
                    type="button"
                    tabIndex={open ? 0 : -1}
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 rounded-full bg-white py-2.5 text-[14px] font-bold transition-colors hover:bg-[#f3f3f7]"
                    style={{ color: NAVY }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ログインモーダル (現在のページの上に重ねる) */}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
}

// 地球アイコン (絵文字不使用の言語切替マーク)。currentColor で文字色に追従。
function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3c2.7 2.6 2.7 15.4 0 18M12 3c-2.7 2.6-2.7 15.4 0 18"
        stroke="currentColor"
        strokeWidth="1.8"
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
