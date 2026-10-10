"use client";

// 診断結果作成ページ (解析待ち画面)。デザインはトップページ (feat/top-page) と統一:
//   - フォント: Noto Sans JP (トップと同じ FONT_STACK)
//   - 背景: 白 / テキスト: ブランドネイビー #2E2E5C
//   - 進捗バー: 淡ブルートラック + Sora ブルー #5B5BEF 塗り (CTA と同色)
//   - チェックリスト: 完了 = Sora ブルーのチェック、未完 = 淡ブルーの空円
//   - マスコット: 元の5秒ループ動画を透過化。Safari は HEVC、その他は VP9。
//     reduced-motion / 再生不可時は同じ動画の透過済み先頭フレームを表示。
//   - MESSAGES / STEPS の文言・タイマー進行は従来のまま
import { useEffect, useState, useSyncExternalStore } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";
const TRACK = "#E6E6FB"; // Sora ブルーの淡ティント (トラック / 空円)

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
function getServerReducedMotion() {
  return true;
}

function subscribeToVideoSource() {
  return () => {};
}
function getVideoSource() {
  // iOS browsers all use WebKit. WebM playback support does not guarantee
  // alpha support, so do not let source negotiation choose WebM on Apple WebKit.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(navigator.userAgent) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Android/.test(navigator.userAgent);
  return ios || safari
    ? "/mascot/analyzing-loop-cutout-v2.mp4"
    : "/mascot/analyzing-loop-cutout-v2.webm";
}
function getServerVideoSource() {
  return "/mascot/analyzing-loop-cutout-v2.webm";
}

const MESSAGES = [
  "あなたの回答を読み込んでいます...",
  "Big Five 心理学で解析中...",
  "開放性・誠実性・外向性を判定...",
  "協調性・神経症傾向を分析...",
  "あなたを表すタイプを探しています...",
  "32タイプから絞り込み中...",
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

// messages / steps は任意。省略時は自己診断の既定文言。
// (友達診断=friend の生成中でも同デザインを再利用し、文言だけ差し替える。)
export function DiagnosisAnalyzingLoader({
  messages = MESSAGES,
  steps = STEPS,
  fontFamily = FONT_STACK,
}: {
  messages?: string[];
  steps?: string[];
  fontFamily?: string;
} = {}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  const videoSource = useSyncExternalStore(
    subscribeToVideoSource,
    getVideoSource,
    getServerVideoSource,
  );

  const messageCount = messages.length;
  const stepCount = steps.length;
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => Math.min(prev + 1, messageCount - 1));
    }, 2000);

    const stepInterval = setInterval(() => {
      setCompletedSteps((prev) => Math.min(prev + 1, stepCount));
    }, 5000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(stepInterval);
    };
  }, [messageCount, stepCount]);

  return (
    <div
      className="flex min-h-screen flex-1 flex-col items-center justify-center bg-[#FCFCFC] px-5 py-10"
      style={{ fontFamily }}
    >
      {/* 動画と poster の両方がアルファ付き。元の表示サイズと余白を維持する。 */}
      <div className="-mb-4 h-72 overflow-hidden md:h-80" aria-hidden="true">
        {reducedMotion || videoFailed ? (
          <SmoothImage
            src="/mascot/analyzing-loop-cutout-v2-poster.webp"
            alt=""
            width={832}
            height={624}
            priority
            unoptimized
            className="h-full w-auto scale-[1.16] object-contain"
          />
        ) : (
          <video
            src={videoSource}
            width={832}
            height={624}
            autoPlay
            muted
            loop
            playsInline
            poster="/mascot/analyzing-loop-cutout-v2-poster.webp"
            onError={() => setVideoFailed(true)}
            className="h-full w-auto scale-[1.16] object-contain"
          />
        )}
      </div>

      <p
        key={messageIndex}
        className="animate-fade-in mb-6 min-h-[1.75rem] text-center text-lg font-bold"
        style={{ color: NAVY }}
      >
        {messages[messageIndex]}
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
        {steps.map((label, i) => {
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
