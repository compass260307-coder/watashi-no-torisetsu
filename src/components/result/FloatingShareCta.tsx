"use client";

// Phase 1.5-α: /me 結果ページの常時表示フローティング CTA (Koi 参考)。
//
// - 画面右下に position: fixed。スクロールしても常に表示。
// - 円形 (sunYellow 背景 + deepPurple 文字 + やわらかい影 + M PLUS Rounded 太字)。
// - 文言「相互理解度 / はこちら →」(矢印は SVG、emoji 不使用=ブランド規約)。
// - タップ=/friend-evaluation へ next/link でクライアント遷移 (内部ルート、外部URLは使わない)。
// - 出現: ヒーローを少しスクロールしたらフェードイン。

import Link from "next/link";
import { useEffect, useState } from "react";

interface FloatingShareCtaProps {
  /** 遷移先の内部ルート (既定: /friend-evaluation)。 */
  href?: string;
}

export function FloatingShareCta({ href = "/friend-evaluation" }: FloatingShareCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 140);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Link
      href={href}
      aria-label="相互理解度はこちら — 友達から見たアナタを見る"
      className="fixed z-50 transition-all duration-300 ease-out active:scale-95"
      style={{
        right: "16px",
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
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
        <span style={{ fontSize: "13px" }}>相互理解度</span>
        <span className="flex items-center" style={{ fontSize: "12px", gap: "2px" }}>
          はこちら
          <ArrowRight />
        </span>
      </span>
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
