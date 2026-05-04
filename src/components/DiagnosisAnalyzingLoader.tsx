"use client";

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
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
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
        className="text-lg font-medium text-center animate-fade-in min-h-[1.75rem] mb-6"
      >
        {MESSAGES[messageIndex]}
      </p>

      {/* Progress bar */}
      <div className="w-72 max-w-full h-1.5 rounded-full bg-card-border overflow-hidden mb-6">
        <div className="h-full bg-primary-gradient rounded-full animate-progress-20s" />
      </div>

      {/* Checkmark steps */}
      <ul className="w-72 max-w-full flex flex-col gap-2.5">
        {STEPS.map((label, i) => {
          const isDone = completedSteps > i;
          const isCurrent = completedSteps === i;
          return (
            <li key={label} className="flex items-center gap-2 text-sm">
              {isDone ? (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold shrink-0">
                  ✓
                </span>
              ) : isCurrent ? (
                <span className="inline-flex w-5 h-5 rounded-full border-2 border-primary/50 bg-primary/10 animate-pulse shrink-0" />
              ) : (
                <span className="inline-flex w-5 h-5 rounded-full border-2 border-card-border shrink-0" />
              )}
              <span
                className={
                  isDone
                    ? "text-foreground"
                    : isCurrent
                      ? "text-foreground"
                      : "text-muted/60"
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
