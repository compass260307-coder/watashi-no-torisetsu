"use client";

// Phase 1.5-α: 常時表示フローティング CTA (Koi 参考)。
//
// - 画面右下に position: fixed。スクロールしても常に表示。
// - 円形 (sunYellow 背景 + deepPurple 文字 + やわらかい影 + M PLUS Rounded 太字)。
// - 2 行ラベル + 矢印 SVG (emoji 不使用=ブランド規約)。
// - 出現: 少しスクロールしたらフェードイン。
//
// 動作は 2 系統:
//   - href 指定  … next/link でクライアント遷移 (例: /me → /friend-evaluation)。
//   - onClick 指定 … その場でハンドラ実行 (例: /friend → 評価フロー開始)。onClick が優先。

import Link from "next/link";
import { useEffect, useState } from "react";

interface FloatingShareCtaProps {
  /** 遷移先の内部ルート (既定: /friend-evaluation)。onClick 未指定時に使用。 */
  href?: string;
  /** タップ時のハンドラ。指定時は <button> としてレンダリングし href より優先。 */
  onClick?: () => void;
  /** 1 行目 (既定: 相互理解度)。 */
  line1?: string;
  /** 2 行目 (既定: はこちら)。矢印 SVG が後ろに付く。 */
  line2?: string;
  /** アクセシブルラベル (既定: line1+line2)。 */
  ariaLabel?: string;
}

export function FloatingShareCta({
  href = "/friend-evaluation",
  onClick,
  line1 = "他己診断",
  line2 = "テストへ",
  ariaLabel,
}: FloatingShareCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 140);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const wrapperClassName =
    "fixed z-50 transition-all duration-300 ease-out active:scale-95";
  const wrapperStyle = {
    right: "16px",
    bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    pointerEvents: visible ? "auto" : "none",
  } as const;

  const inner = (
    <span
      className="flex flex-col items-center justify-center text-center rounded-full"
      style={{
        width: "84px",
        height: "84px",
        background: "#FFE993",
        color: "#3A2D6B",
        fontFamily: "var(--font-m-plus-rounded), sans-serif",
        fontWeight: 800,
        lineHeight: 1.25,
        boxShadow:
          "0 10px 22px rgba(58,45,107,0.28), 0 2px 6px rgba(58,45,107,0.18)",
      }}
    >
      <span style={{ fontSize: "13px" }}>{line1}</span>
      <span className="flex items-center" style={{ fontSize: "12px", gap: "2px" }}>
        {line2}
        <ArrowRight />
      </span>
    </span>
  );

  const label = ariaLabel ?? `${line1}${line2}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={wrapperClassName}
        style={wrapperStyle}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={wrapperClassName}
      style={wrapperStyle}
    >
      {inner}
    </Link>
  );
}

function ArrowRight() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M4 12h14M13 6l6 6-6 6"
        stroke="#3A2D6B"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
