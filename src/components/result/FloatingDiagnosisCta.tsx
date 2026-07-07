"use client";

// 評価完了ページ (/evaluate/sent) 右下のフローティング診断 CTA。
//
// 既存 FloatingShareCta (円形・スクロール追従・safe-area) のパターンを踏襲しつつ、
// 本タスク用に pill 形状 + 「終端メインCTAが画面内に入ったら隠す」挙動を追加。
//   - 出現: 少しスクロールしたらフェードイン (最初は出さない)
//   - 退場: hideWhenId の要素 (末尾メインCTA) が画面内に入ったら隠す (二重表示回避)
//   - safe-area 対応 (env(safe-area-inset-bottom))・本文を妨げないサイズ感
// 色は CTA と統一 (sunYellow #5B5BEF + deepPurple 文字)。遷移先は診断開始。

import Link from "next/link";
import { useEffect, useState } from "react";
import { track } from "@/lib/track";

interface FloatingDiagnosisCtaProps {
  /** 遷移先 (既定: /diagnosis、末尾メインCTAと同じ)。 */
  href?: string;
  /** ラベル (既定: アナタも診断)。 */
  label?: string;
  /** この id の要素が画面内に入ったら隠す (末尾メインCTAの id)。 */
  hideWhenId?: string;
}

export function FloatingDiagnosisCta({
  href = "/diagnosis",
  label = "アナタも診断",
  hideWhenId,
}: FloatingDiagnosisCtaProps) {
  const [scrolled, setScrolled] = useState(false);
  const [endInView, setEndInView] = useState(false);

  // 少しスクロールしたら出現
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 160);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 末尾メインCTAが画面内に入ったら隠す
  useEffect(() => {
    if (!hideWhenId) return;
    const el = document.getElementById(hideWhenId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setEndInView(entries[0]?.isIntersecting ?? false),
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hideWhenId]);

  const visible = scrolled && !endInView;

  return (
    <Link
      href={href}
      aria-label={label}
      onClick={() =>
        track("friend_to_diagnosis_clicked", { metadata: { source: "floating" } })
      }
      className="fixed z-50 flex items-center gap-1.5 rounded-full transition-all duration-300 ease-out active:scale-95"
      style={{
        right: "16px",
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        background: "#5B5BEF",
        color: "#FFFFFF",
        fontFamily: "var(--font-noto-sans), sans-serif",
        fontWeight: 800,
        fontSize: "14px",
        padding: "10px 16px",
        boxShadow:
          "0 10px 22px rgba(58,45,107,0.28), 0 2px 6px rgba(58,45,107,0.18)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <SparkleIcon />
      <span>{label}</span>
      <ArrowRight />
    </Link>
  );
}

// キラッ (4 点星)。emoji 不使用=ブランド規約。
function SparkleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M12 2c.5 4.5 3 7 7.5 7.5C15 10 12.5 12.5 12 17c-.5-4.5-3-7-7.5-7.5C9 9 11.5 6.5 12 2Z"
        fill="#2E2E5C"
      />
    </svg>
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
        stroke="#2E2E5C"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
