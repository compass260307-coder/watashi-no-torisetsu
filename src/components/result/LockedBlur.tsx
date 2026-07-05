"use client";

// Phase 1.5-α Day 12-Polish-G 追加: ロックされたブラー本文のタップ挙動。
//
// 意図で出し分け:
//   - ブラー部分 (中身が気になって押す) → メイン解除カードへスムーズスクロール +
//     着地時に一瞬 pulse。価格・解放項目を見てから判断させる。
//   - 「解除する」ボタン (買う気の人) → 従来どおり Stripe 直行 (このコンポーネントは
//     その挙動に一切触れない。InlineLockCard を children として前面に重ねるだけ)。
//
// アクセシビリティ: ブラー領域は div の直 onClick ではなく button + aria-label。
// 前面の InlineLockCard はカード部分だけ pointer-events を有効にし、それ以外の
// ブラー領域へのクリックは背面のスクロール用 button へ透過させる。
//
// 触らない: Stripe 決済・¥500 課金ゲート・ブラー&解除フローのロジック。

import type { ReactNode } from "react";

interface LockedBlurProps {
  /** ブラー表示するプレースホルダー本文 (装飾、aria-hidden) */
  blurText: string;
  /** ブラー span の文字スタイル (サイズ/行間/whitespace 等) */
  blurTextClassName: string;
  /** ぼかし量 (px) */
  blurPx: number;
  /** 前面 (InlineLockCard) の上下パディングクラス (例 "py-4") */
  padClassName: string;
  /** スクロール先メイン解除カードの DOM id */
  targetId?: string;
  /** 前面に重ねる InlineLockCard 等 */
  children: ReactNode;
}

const PULSE_CLASS = "unlock-pulse";
const PULSE_MS = 700;

export function LockedBlur({
  blurText,
  blurTextClassName,
  blurPx,
  padClassName,
  targetId = "unlock-card",
  children,
}: LockedBlurProps) {
  const handleReveal = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // 連続タップでも確実に再生し直す: 一旦外して reflow を強制 → 付与
    el.classList.remove(PULSE_CLASS);
    el.getBoundingClientRect(); // reflow を強制してアニメーションを再起動
    el.classList.add(PULSE_CLASS);
    window.setTimeout(() => el.classList.remove(PULSE_CLASS), PULSE_MS);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* ブラー背景 = タップでメイン解除カードへスクロール (button + aria-label) */}
      <button
        type="button"
        aria-label="解除する方法を見る"
        onClick={handleReveal}
        className="absolute inset-0 w-full h-full p-4 text-left select-none cursor-pointer"
      >
        <span
          aria-hidden="true"
          className={`block text-[#2E2E5C] ${blurTextClassName}`}
          style={{ filter: `blur(${blurPx}px)` }}
        >
          {blurText}
        </span>
      </button>

      {/* 前面: InlineLockCard。カード以外のブラー領域へのクリックは背面 button へ透過。 */}
      <div
        className={`relative flex justify-center px-3 ${padClassName} pointer-events-none`}
      >
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}
