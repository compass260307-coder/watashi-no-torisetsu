"use client";

// Phase 1.5-α Day 12-Polish-E E-1: 解析待ち画面の Brand v2 化
//   - 背景: 白 → grid-bg (lavender グラデ + 32px グリッドオーバーレイ)
//   - テキスト: 黒 → deepPurple #3A2D6B、M PLUS Rounded 1c (global font)
//   - 進捗バー: lavender トラック (#E4E0F5) + vividPink 塗り (#FE3C72)
//   - チェックリスト: 完了 = vividPink チェック (SVG)、未完 = lavender 空円
//   - マスコット (青ペンギン)・MESSAGES 文言・STEPS 文言・アニメは維持
//   - 絵文字なし (T3-5)。チェックは inline SVG。

import { useEffect, useState } from "react";
import Image from "next/image";

const MESSAGES = [
  "あなたの回答を読み込んでいます...",
  "Big Five 心理学で解析中...",
  "開放性・誠実性・外向性を判定...",
  "協調性・神経症傾向を分析...",
  "あなたを表すタイプを探しています...",
  "8タイプから絞り込み中...",
  "あなただけの強みを見つけています...",
  "あなたの取扱説明書を綴っています...",
  "最後の仕上げをしています...",
  "もうすぐお届けします...",
];

const STEPS = [
  "回答データを取得",
  "性格特性を解析",
  "タイプを判定",
  "トリセツを生成",
];

export function DiagnosisAnalyzingLoader() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => Math.min(prev + 1, MESSAGES.length - 1));
    }, 2000);

    const stepInterval = setInterval(() => {
      setCompletedSteps((prev) => Math.min(prev + 1, STEPS.length));
    }, 5000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <div className="grid-bg flex flex-col flex-1 min-h-screen items-center justify-center px-5 py-10">
      <Image
        src="/mascot/analyzing-penguin.png"
        alt=""
        width={224}
        height={224}
        priority
        className="w-48 h-48 object-contain mb-6 animate-bounce-slow"
      />

      <p
        key={messageIndex}
        className="text-lg font-bold text-[#3A2D6B] text-center animate-fade-in min-h-[1.75rem] mb-6"
      >
        {MESSAGES[messageIndex]}
      </p>

      {/* Progress bar (lavender track + vividPink fill) */}
      <div
        className="w-72 max-w-full h-1.5 rounded-full bg-[#E4E0F5] overflow-hidden mb-6"
        aria-hidden
      >
        <div className="h-full bg-[#FE3C72] rounded-full animate-progress-20s" />
      </div>

      {/* Checkmark steps */}
      <ul className="w-72 max-w-full flex flex-col gap-2.5">
        {STEPS.map((label, i) => {
          const isDone = completedSteps > i;
          const isCurrent = completedSteps === i;
          return (
            <li
              key={label}
              className="flex items-center gap-2 text-sm font-bold"
            >
              {isDone ? (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FE3C72] text-white shrink-0">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              ) : isCurrent ? (
                <span className="inline-flex w-5 h-5 rounded-full border-2 border-[#FE3C72] bg-[#FE3C72]/15 animate-pulse shrink-0" />
              ) : (
                <span className="inline-flex w-5 h-5 rounded-full border-2 border-[#E4E0F5] bg-white shrink-0" />
              )}
              <span
                className={
                  isDone || isCurrent
                    ? "text-[#3A2D6B]"
                    : "text-[#3A2D6B]/40"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
