"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const MESSAGES = [
  "あなたの回答を読み込んでいます...",
  "あなたを表すタイプを探しています...",
  "あなただけのトリセツを作っています...",
  "もうすぐお届けします...",
];

export function AnalyzingLoader() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => Math.min(prev + 1, MESSAGES.length - 1));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5">
      <Image
        src="/mascot/analyzing-penguin.png"
        alt=""
        width={224}
        height={224}
        priority
        className="w-48 sm:w-56 h-auto object-contain mb-6 animate-bounce-slow"
      />
      <p
        key={messageIndex}
        className="text-lg font-medium text-center animate-fade-in min-h-[1.75rem]"
      >
        {MESSAGES[messageIndex]}
      </p>
      <p className="text-xs text-muted text-center mt-3">
        Big Five 心理学に基づいて分析中
      </p>
    </div>
  );
}
