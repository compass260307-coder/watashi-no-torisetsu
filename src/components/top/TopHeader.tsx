"use client";

// feat/top-page: 独立した白いヘッダーバー (16Personalities 型)。
// 構造: ロゴ(左) | メニュー + ログイン + 言語切替(右寄せ)。PC は横並び、SP はハンバーガー。
// 白背景・ダーク文字。下にキービジュアルのヒーローが続く。sticky で追従。

import { useState } from "react";
import Link from "next/link";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

// ナビ表記ルール: 機能名は「性格診断テスト / 他己診断テスト / 性格タイプ」で統一。
// (旧表記: 相互理解度 → 他己診断テスト、キャラ図鑑 → 性格タイプ。ナビのみの変更で
//  各ページ内のタイトル等は別途。) ログインは右端・言語切替の左に置く。
// disabled: 準備中 (グレー表示・リンクなし)。ページが公開できたら外す。
const NAV: { label: string; href: string; disabled?: boolean }[] = [
  { label: "性格診断テスト", href: "/diagnosis" },
  { label: "他己診断テスト", href: "/friend-evaluation" },
  { label: "性格タイプ", href: "/types" },
  { label: "サービスについて", href: "/about" },
  { label: "ログイン", href: "/login", disabled: true },
];

export default function TopHeader() {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

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
          {NAV.map((n) =>
            n.disabled ? (
              <span
                key={n.href}
                className="whitespace-nowrap text-[16px] xl:text-[20px] font-bold text-[#B4B4C4]"
                aria-disabled="true"
              >
                {n.label}
                <span className="text-[11px] xl:text-[13px]">（準備中）</span>
              </span>
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

          {/* 言語切替 (⚠️ 一旦プレースホルダ。英語は準備中) */}
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
          onClick={() => setOpen((v) => !v)}
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

      {/* SP: ドロップダウン (白・ダーク文字) */}
      {open && (
        <>
          <div
            className="fixed inset-0 top-[72px] z-40 bg-black/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav className="relative z-50 border-t border-[#2E2E5C]/10 bg-white px-8 py-2 lg:hidden">
            {NAV.map((n) =>
              n.disabled ? (
                <span
                  key={n.href}
                  className="block py-3.5 text-[19px] font-bold text-[#B4B4C4]"
                  aria-disabled="true"
                >
                  {n.label}
                  <span className="text-[12px]">（準備中）</span>
                </span>
              ) : (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="block py-3.5 text-[19px] font-bold transition-colors hover:text-[#5B5BEF]"
                  style={{ color: NAVY }}
                >
                  {n.label}
                </Link>
              ),
            )}
            {/* SP でも言語表示 (プレースホルダ) */}
            <div className="flex items-center gap-1.5 py-3.5 text-[19px] font-bold" style={{ color: NAVY }}>
              <GlobeIcon />
              日本語
            </div>
          </nav>
        </>
      )}
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
