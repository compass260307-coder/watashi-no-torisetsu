"use client";

// 診断結果作成ページ (解析待ち画面)。デザインはトップページ (feat/top-page) と統一:
//   - フォント: Noto Sans JP (トップと同じ FONT_STACK)
//   - 背景: 白 / テキスト: ブランドネイビー #2E2E5C
//   - 進捗バー: 淡ブルートラック + Sora ブルー #5B5BEF 塗り (CTA と同色)
//   - チェックリスト: 完了 = Sora ブルーのチェック、未完 = 淡ブルーの空円
//   - マスコット: フェルト調ペンギン (characters/cut の透過素材 = /types と同じ世界観)
//   - MESSAGES / STEPS の文言・タイマー進行は従来のまま
import { useEffect, useState } from "react";
import Image from "next/image";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";
const TRACK = "#E6E6FB"; // Sora ブルーの淡ティント (トラック / 空円)

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
    <div
      className="flex min-h-screen flex-1 flex-col items-center justify-center bg-white px-5 py-10"
      style={{ fontFamily: FONT_STACK }}
    >
      <Image
        src="/characters/cut/penguin_N.png"
        alt=""
        width={224}
        height={224}
        priority
        className="mb-6 h-52 w-52 object-contain"
      />

      <p
        key={messageIndex}
        className="animate-fade-in mb-6 min-h-[1.75rem] text-center text-lg font-bold"
        style={{ color: NAVY }}
      >
        {MESSAGES[messageIndex]}
      </p>

      {/* Progress bar (淡ブルートラック + Sora ブルー塗り) */}
      <div
        className="mb-6 h-1.5 w-72 max-w-full overflow-hidden rounded-full"
        style={{ backgroundColor: TRACK }}
        aria-hidden
      >
        <div
          className="animate-progress-20s h-full rounded-full"
          style={{ backgroundColor: SORA }}
        />
      </div>

      {/* Checkmark steps */}
      <ul className="flex w-72 max-w-full flex-col gap-2.5">
        {STEPS.map((label, i) => {
          const isDone = completedSteps > i;
          const isCurrent = completedSteps === i;
          return (
            <li
              key={label}
              className="flex items-center gap-2 text-sm font-bold"
            >
              {isDone ? (
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: SORA }}
                >
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
                <span
                  className="inline-flex h-5 w-5 shrink-0 animate-pulse rounded-full border-2"
                  style={{
                    borderColor: SORA,
                    backgroundColor: "rgba(91,91,239,0.15)",
                  }}
                />
              ) : (
                <span
                  className="inline-flex h-5 w-5 shrink-0 rounded-full border-2 bg-white"
                  style={{ borderColor: TRACK }}
                />
              )}
              <span
                style={{
                  color: isDone || isCurrent ? NAVY : `${NAVY}66`,
                }}
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
