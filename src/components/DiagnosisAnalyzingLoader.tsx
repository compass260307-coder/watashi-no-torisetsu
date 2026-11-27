"use client";

// 診断結果作成ページ (解析待ち画面)。デザインはトップページ (feat/top-page) と統一:
//   - フォント: Noto Sans JP (トップと同じ FONT_STACK)
//   - 背景: 白 / テキスト: ブランドネイビー #2E2E5C
//   - 進捗バー: 淡ブルートラック + Sora ブルー #5B5BEF 塗り (CTA と同色)
//   - チェックリスト: 完了 = Sora ブルーのチェック、未完 = 淡ブルーの空円
//   - マスコット: 元の5秒ループ動画を透過化。Safari は HEVC、その他は VP9。
//     reduced-motion / 再生不可時は同じ動画の透過済み先頭フレームを表示。
//   - MESSAGES / STEPS の文言は i18n 側 (copy.analyzing) が正本。メッセージは
//     messageDurationsMs で個別の表示時間を指定でき、省略時は一律2秒。
import { isMotionReduced, subscribeA11yStyle } from "@/lib/a11y-style";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import type { AnalyzingSlide } from "@/i18n/diagnosis";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";
const TRACK = "#E6E6FB"; // Sora ブルーの淡ティント (トラック / 空円)
// 完全版の購入後の準備画面 (theme="premium") の金色。宝箱の絵の金に合わせる。
const GOLD = "#D9A43A";
const GOLD_TRACK = "#F6E7C1";
const GOLD_FILL = "linear-gradient(90deg, #E8B84A, #F6D57A, #E8B84A)";
// 相性診断の診断中の画面 (theme="aisho") のピンク。結果ページのピンクの帯 (#FAD3E3) と同じ色味。
const PINK = "#EC6C9C";
const PINK_TRACK = "#FBDCE8";
const PINK_FILL = "linear-gradient(90deg, #EC6C9C, #F7A3C2, #EC6C9C)";

const THEMES = {
  default: {
    accent: SORA,
    track: TRACK,
    fill: SORA,
    currentTint: "rgba(91,91,239,0.15)",
    background: "#FCFCFC",
  },
  premium: {
    accent: GOLD,
    track: GOLD_TRACK,
    fill: GOLD_FILL,
    currentTint: "rgba(217,164,58,0.15)",
    background: "radial-gradient(120% 70% at 50% 0%, #FFF1CC 0%, #FFF9EC 45%, #FFFDF8 100%)",
  },
  aisho: {
    accent: PINK,
    track: PINK_TRACK,
    fill: PINK_FILL,
    currentTint: "rgba(236,108,156,0.15)",
    background: "linear-gradient(180deg, #FBDCE8 0%, #FDEDF3 55%, #FFF8FA 100%)",
  },
} as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  // サイト内の「動きを抑える」(アクセシビリティスタイル) の切り替えにも追従する。
  const unsubscribeA11yStyle = subscribeA11yStyle(onChange);
  return () => {
    query.removeEventListener("change", onChange);
    unsubscribeA11yStyle();
  };
}
function getReducedMotion() {
  return isMotionReduced();
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
  "友達から見た性格を予測中...",
  "あなたの診断結果をまとめています...",
  "もうすぐ確認できます...",
];

const STEPS = [
  "回答データを取得",
  "Big Fiveで解析",
  "友達から見た性格を予測",
  "診断結果を生成",
];

const DEFAULT_MESSAGE_DURATION_MS = 2000;
const DEFAULT_TOTAL_MS = 20000;

// messages / steps は任意。省略時は自己診断の既定文言。
// (友達診断=friend の生成中でも同デザインを再利用し、文言だけ差し替える。)
export function DiagnosisAnalyzingLoader({
  messages = MESSAGES,
  steps = STEPS,
  messageDurationsMs,
  totalMs = DEFAULT_TOTAL_MS,
  slides,
  slideDurationsMs,
  slidesLabel,
  startDelayMs = 0,
  fontFamily = FONT_STACK,
  theme = "default",
  header,
  visual,
}: {
  messages?: string[];
  steps?: string[];
  // messages[i] の表示時間 (ms)。省略時や不足分は一律 DEFAULT_MESSAGE_DURATION_MS。
  messageDurationsMs?: number[];
  // 画面全体の想定表示時間 (ms)。進捗バーとチェックリストの進行に使う。
  totalMs?: number;
  // 指定時はマスコットの代わりに紹介スライドを流す (totalMs を枚数で等分)。
  slides?: AnalyzingSlide[];
  // slides[i] の表示時間 (ms)。省略時や不足分は等分した長さ。
  slideDurationsMs?: number[];
  // 各スライド左上の見出し。全カード共通で、番号は付けない。
  slidesLabel?: string;
  // 進行バーとチェックリストを出し始めるまでの待ち時間 (ms)。画面の登場の演出が終わってから
  // 読み込みを始めたいときに指定する。totalMs は、この待ち時間を除いた読み込みの長さ。
  startDelayMs?: number;
  fontFamily?: string;
  // "premium": 完全版の購入後の準備画面。背景・進行バー・チェックを金色にする。
  // "aisho": 相性診断の診断中の画面。同じものをピンクにする。
  theme?: "default" | "premium" | "aisho";
  // 指定時はマスコットの代わりにこの絵を出す (相性診断の2キャラなど)。メッセージは出したまま。
  visual?: React.ReactNode;
  // スライドの上に出す見出し (準備画面の「完全版を準備しています」など)。
  header?: React.ReactNode;
} = {}) {
  const { accent, track, fill, currentTint, background } = THEMES[theme];
  const [messageIndex, setMessageIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
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
    if (messageIndex >= messageCount - 1) return;
    const duration =
      messageDurationsMs?.[messageIndex] ?? DEFAULT_MESSAGE_DURATION_MS;
    const timeout = setTimeout(() => {
      setMessageIndex((prev) => Math.min(prev + 1, messageCount - 1));
    }, duration);
    return () => clearTimeout(timeout);
  }, [messageIndex, messageCount, messageDurationsMs]);

  useEffect(() => {
    let stepInterval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      stepInterval = setInterval(() => {
        setCompletedSteps((prev) => Math.min(prev + 1, stepCount));
      }, totalMs / Math.max(stepCount, 1));
    }, startDelayMs);
    return () => {
      clearTimeout(start);
      clearInterval(stepInterval);
    };
  }, [stepCount, totalMs, startDelayMs]);

  const slideCount = slides?.length ?? 0;
  const slideDurationMs =
    slideDurationsMs?.[slideIndex] ?? (slideCount > 0 ? totalMs / slideCount : 0);
  useEffect(() => {
    if (slideCount === 0 || slideIndex >= slideCount - 1) return;
    const timeout = setTimeout(
      () => setSlideIndex((prev) => Math.min(prev + 1, slideCount - 1)),
      slideDurationMs,
    );
    return () => clearTimeout(timeout);
  }, [slideIndex, slideCount, slideDurationMs]);

  const message = (
    <p
      key={messageIndex}
      className="animate-fade-in mb-6 min-h-[1.75rem] text-center text-lg font-bold"
      style={{ color: NAVY }}
    >
      {messages[messageIndex]}
    </p>
  );

  return (
    <div
      className="flex min-h-screen flex-1 flex-col items-center justify-center overflow-x-hidden px-5 py-10"
      style={{
        fontFamily,
        background,
      }}
    >
      {header}
      {/* 動画と poster の両方がアルファ付き。元の表示サイズと余白を維持する。 */}
      {slides ? (
        <AnalyzingSlideDeck slides={slides} index={slideIndex} label={slidesLabel} />
      ) : visual ? (
        visual
      ) : (
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
      )}

      {/* スライド表示時はスライドの文が主役なので、切り替わる解析メッセージは出さない。 */}
      {slides ? null : message}

      {/* 進行バーとチェックリスト。startDelayMs があるときは、その時間がたってからふわっと出て進み始める。 */}
      <div
        className={`flex w-full flex-col items-center ${startDelayMs > 0 ? "animate-fade-in" : ""}`}
        style={startDelayMs > 0 ? { animationDelay: `${startDelayMs}ms` } : undefined}
      >
      {/* Progress bar (淡ブルートラック + Sora ブルー塗り) */}
      <div
        className="mb-6 h-1.5 w-72 max-w-full overflow-hidden rounded-full"
        style={{ backgroundColor: track }}
        aria-hidden
      >
        <div
          className="animate-progress-20s h-full rounded-full"
          style={{
            background: fill,
            animationDuration: `${totalMs}ms`,
            animationDelay: `${startDelayMs}ms`,
            animationFillMode: "both",
          }}
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
                  style={{ backgroundColor: accent }}
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
                    borderColor: accent,
                    backgroundColor: currentTint,
                  }}
                />
              ) : (
                <span
                  className="inline-flex h-5 w-5 shrink-0 rounded-full border-2 bg-white"
                  style={{ borderColor: track }}
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
    </div>
  );
}


// 紹介スライドの絵は、表示された瞬間に要素が順に「ポンッ」と出る (animate-slide-pop)。
// 全スライドを重ねて置いているため、非表示の間は描かず、表示時に key を変えて再生し直す。
function Pop({
  delay = 0,
  className = "",
  style,
  children,
}: {
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`animate-slide-pop ${className}`}
      style={{ animationDelay: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  );
}

// リンクのアイコン (②で自分から友達へ飛ぶ)。
function LinkIcon({ size, color = SORA }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.43" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.33-1.33" />
    </svg>
  );
}

// 帯 (316×164) の中で x を中心に置く。Pop は transform を使うため、位置決めは外側で行う。
function At({
  x,
  top,
  children,
}: {
  x: number;
  top: number;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute -translate-x-1/2" style={{ left: x, top }}>
      {children}
    </div>
  );
}

const DOTTED = { stroke: `${NAVY}40`, strokeWidth: 2, strokeDasharray: "1 6", strokeLinecap: "round" as const };
// キャラクターの顔を丸く切り抜いたアイコン。
function Face({ src, size, ring }: { src: string; size: number; ring: string }) {
  return (
    <span
      className="block overflow-hidden rounded-full bg-white"
      style={{ width: size, height: size, boxShadow: `0 0 0 3px ${ring}` }}
      aria-hidden
    >
      <SmoothImage
        src={src}
        alt=""
        width={size * 2}
        height={size * 2}
        unoptimized
        fadeIn={false}
        className="h-full w-full scale-110 object-cover"
      />
    </span>
  );
}

function NameChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="mt-2 inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black leading-none text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

// ① 何か: 左に「あなた」、右に友達3人の一言が1つずつ届く。
const VOICE_TOPS = [16, 64, 112];

function VoicesVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "voices" }>;
}) {
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      <svg className="animate-fade-in absolute inset-0" width="316" height="164" viewBox="0 0 316 164" fill="none" aria-hidden style={{ animationDelay: "600ms" }}>
        {VOICE_TOPS.map((top) => (
          <path key={top} d={`M122 68 L151 ${top + 18}`} {...DOTTED} />
        ))}
      </svg>
      <At x={74} top={26}>
        <Pop delay={100} className="flex flex-col items-center">
          <Face src={visual.selfFace} size={84} ring={SORA} />
          <NameChip label={visual.selfLabel} color={SORA} />
        </Pop>
      </At>
      {visual.voices.map((voice, i) => (
        <div key={voice.text} className="absolute" style={{ left: 155, top: VOICE_TOPS[i] }}>
          <Pop delay={700 + i * 550} className="flex origin-left items-center gap-1.5">
            <Face src={voice.face} size={36} ring={voice.color} />
            <span
              className="whitespace-nowrap rounded-full bg-white px-3 py-2 text-[12px] font-black leading-none shadow-[0_3px_10px_rgba(46,46,92,0.10)]"
              style={{ color: NAVY }}
            >
              {voice.text}
            </span>
          </Pop>
        </div>
      ))}
    </div>
  );
}

// スタンプ (「回答完了！」「ギャップ発見！」)。出る瞬間に、きらめきが周りへ弾ける。
const SPARKS = [
  { dx: -58, dy: -24, size: 16, color: "#F6C544" },
  { dx: -38, dy: 26, size: 11, color: "#FF8FB1" },
  { dx: 0, dy: -36, size: 12, color: "#8E8EF5" },
  { dx: 42, dy: -30, size: 16, color: "#FF8FB1" },
  { dx: 62, dy: 6, size: 12, color: "#F6C544" },
  { dx: 32, dy: 32, size: 14, color: "#8E8EF5" },
];

function Stamp({ label, delay }: { label: string; delay: number }) {
  return (
    <span className="relative inline-block">
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="slide-sparkle pointer-events-none absolute left-1/2 top-1/2"
          style={
            {
              "--dx": `${spark.dx}px`,
              "--dy": `${spark.dy}px`,
              animationDelay: `${delay + 180 + i * 35}ms`,
            } as React.CSSProperties
          }
          aria-hidden
        >
          <svg width={spark.size} height={spark.size} viewBox="0 0 24 24" fill={spark.color} className="block">
            <path d="M12 0c1.2 6.6 5.4 10.8 12 12-6.6 1.2-10.8 5.4-12 12-1.2-6.6-5.4-10.8-12-12 6.6-1.2 10.8-5.4 12-12z" />
          </svg>
        </span>
      ))}
      <Pop delay={delay}>
        <span
          className="inline-block rotate-[6deg] whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-black leading-none text-white shadow-[0_3px_10px_rgba(91,91,239,0.35)]"
          style={{ backgroundColor: SORA }}
        >
          {label}
        </span>
      </Pop>
    </span>
  );
}

// ① (日本語) 何か: 中央の結果カード1枚がめくれる。表 = 自分から見たあなた、裏 = 友達から見たあなた (別のキャラと一言)。
// 実際の結果も「◯◯から見たあなた」として友達視点のキャラが出るので、その体験をそのまま見せる。
const FLIP_SPARKS = [
  { dx: -128, dy: -50, size: 22, color: "#F6C544" },
  { dx: -136, dy: 26, size: 14, color: "#FF8FB1" },
  { dx: -112, dy: 70, size: 17, color: "#8E8EF5" },
  { dx: 122, dy: -58, size: 20, color: "#FF8FB1" },
  { dx: 138, dy: 8, size: 15, color: "#F6C544" },
  { dx: 116, dy: 66, size: 19, color: "#8E8EF5" },
];
const FLIP_AT_MS = 1900;

function FlipSide({
  title,
  face,
  word,
  back,
}: {
  title: string;
  face: { src: string; ring: string };
  // キャラの下に出す性格の一言。表と裏で違う言葉にして、見え方の差を言葉でも伝える。
  word: string;
  back?: boolean;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
        border: `2.5px solid ${back ? SORA : "transparent"}`,
        boxShadow: back ? "0 8px 22px rgba(91,91,239,0.30)" : "0 4px 14px rgba(46,46,92,0.10)",
      }}
    >
      <span
        className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-black leading-none"
        style={back ? { backgroundColor: SORA, color: "#FFFFFF" } : { backgroundColor: `${NAVY}1A`, color: NAVY }}
      >
        {title}
      </span>
      <Face src={face.src} size={68} ring={face.ring} />
      <span
        className="whitespace-nowrap text-[17px] font-black leading-none"
        style={{ color: back ? SORA : NAVY }}
      >
        {word}
      </span>
    </div>
  );
}

function FlipVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "flip" }>;
}) {
  // マウント直後は表 (自己診断)。次のフレームで裏返す指示を出し、時間差でめくれる (CSS transition)。
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFlipped(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      {/* カード1枚だけを中央に大きく置く。めくれる直前に少し沈み、浮き上がりながら裏返る。 */}
      <div className="absolute left-[63px] top-[8px]">
        <Pop delay={100}>
          <div
            className="slide-flip-lift"
            style={{ perspective: "640px", animationDelay: `${FLIP_AT_MS - 260}ms` }}
          >
            <div
              className="relative h-[148px] w-[190px]"
              style={{
                transformStyle: "preserve-3d",
                transform: `rotateY(${flipped ? 180 : 0}deg)`,
                transition: `transform 900ms cubic-bezier(0.3, 1.35, 0.6, 1) ${FLIP_AT_MS}ms`,
              }}
            >
              <FlipSide title={visual.selfTitle} word={visual.selfWord} face={{ src: visual.selfFace, ring: `${NAVY}40` }} />
              <FlipSide title={visual.friendTitle} word={visual.perceivedWord} face={{ src: visual.perceivedFace, ring: visual.perceivedColor }} back />
            </div>
          </div>
        </Pop>
        {/* めくれきった瞬間に、きらめきが弾ける。 */}
        {FLIP_SPARKS.map((spark, i) => (
          <span
            key={i}
            className="slide-sparkle pointer-events-none absolute left-1/2 top-1/2"
            style={
              {
                "--dx": `${spark.dx}px`,
                "--dy": `${spark.dy}px`,
                animationDelay: `${FLIP_AT_MS + 560 + i * 40}ms`,
              } as React.CSSProperties
            }
            aria-hidden
          >
            <svg width={spark.size} height={spark.size} viewBox="0 0 24 24" fill={spark.color} className="block">
              <path d="M12 0c1.2 6.6 5.4 10.8 12 12-6.6 1.2-10.8 5.4-12 12-1.2-6.6-5.4-10.8-12-12 6.6-1.2 10.8-5.4 12-12z" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}

// ② やり方その1: 自分から友達へ「リンク」が届く。
const FRIEND_GREEN = "#6FBF73";

function SendVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "send" }>;
}) {
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      <svg className="animate-fade-in absolute inset-0" width="316" height="164" viewBox="0 0 316 164" fill="none" aria-hidden style={{ animationDelay: "500ms" }}>
        <path d="M106 69 L204 69" {...DOTTED} />
        <path d="M200 62 L209 69 L200 76" stroke={`${NAVY}66`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <At x={62} top={30}>
        <Pop delay={100} className="flex flex-col items-center">
          <Face src={visual.selfFace} size={78} ring={SORA} />
          <NameChip label={visual.selfLabel} color={SORA} />
        </Pop>
      </At>
      <At x={254} top={30}>
        <Pop delay={300} className="flex flex-col items-center">
          <Face src={visual.friendFace} size={78} ring={FRIEND_GREEN} />
          <NameChip label={visual.friendLabel} color={FRIEND_GREEN} />
        </Pop>
      </At>
      <At x={156} top={52}>
        <div
          className="animate-slide-send flex items-center gap-1.5 whitespace-nowrap rounded-full py-2.5 pl-3 pr-3.5 text-[13px] font-black leading-none text-white shadow-[0_3px_10px_rgba(91,91,239,0.35)]"
          style={{ backgroundColor: SORA, animationDelay: "900ms" }}
        >
          <LinkIcon size={16} color="#FFFFFF" />
          {visual.linkLabel}
        </div>
      </At>
    </div>
  );
}

// ③ やり方その2: 友達が30問に答える。バーが伸びきったら完了スタンプ。
function AnswerVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "answer" }>;
}) {
  // マウント直後は空のバー。次のフレームで満タンへ伸ばす (CSS transition)。
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      <At x={64} top={30}>
        <Pop delay={100} className="flex flex-col items-center">
          <Face src={visual.friendFace} size={78} ring={FRIEND_GREEN} />
          <NameChip label={visual.friendLabel} color={FRIEND_GREEN} />
        </Pop>
      </At>
      <div className="absolute left-[126px] top-[49px] w-[168px]">
        <Pop delay={400} className="origin-left rounded-2xl bg-white px-4 pb-4 pt-3.5 shadow-[0_3px_12px_rgba(46,46,92,0.08)]">
          <p className="mb-2.5 text-left text-[15px] font-black leading-none" style={{ color: NAVY }}>
            {visual.countLabel}
          </p>
          <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: `${FRIEND_GREEN}33` }}>
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: FRIEND_GREEN,
                width: filled ? "100%" : "0%",
                transition: "width 1600ms cubic-bezier(0.3, 0, 0.2, 1) 1000ms",
              }}
            />
          </div>
        </Pop>
      </div>
      <At x={250} top={31}>
        <Stamp label={visual.badge} delay={2700} />
      </At>
    </div>
  );
}

// ③ (日本語) やり方その2: 友達が質問に答えていく。選択肢をタップ → 30問まで数が進む → 完了スタンプ。
const QUIZ_DOT_SIZES = [22, 18, 14, 18, 22];
const QUIZ_PICK_INDEX = 1;

function QuizVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "quiz" }>;
}) {
  // picked: 選択肢に印が付く。count: 回答数 (1 → total)。バーの長さも count に合わせる。
  const [picked, setPicked] = useState(false);
  const [count, setCount] = useState(1);
  const total = visual.total;
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const pick = setTimeout(() => setPicked(true), 1300);
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setCount((prev) => {
          if (prev >= total) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 1500 / Math.max(total - 1, 1));
    }, 1900);
    return () => {
      clearTimeout(pick);
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [total]);
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      <At x={56} top={40}>
        <Pop delay={100} className="flex flex-col items-center">
          <Face src={visual.friendFace} size={68} ring={FRIEND_GREEN} />
          <NameChip label={visual.friendLabel} color={FRIEND_GREEN} />
        </Pop>
      </At>
      <div className="absolute left-[106px] top-[30px] w-[196px]">
        <Pop delay={400} className="origin-left rounded-2xl bg-white px-3.5 pb-3 pt-3 shadow-[0_3px_12px_rgba(46,46,92,0.08)]">
          <p className="whitespace-pre-line text-left text-[12px] font-black leading-[1.5]" style={{ color: NAVY }}>
            {visual.question}
          </p>
          <div className="mt-2 flex items-center justify-between px-1">
            {QUIZ_DOT_SIZES.map((size, i) => {
              const on = picked && i === QUIZ_PICK_INDEX;
              return (
                <span
                  key={i}
                  className="flex items-center justify-center rounded-full border-2"
                  style={{
                    width: size,
                    height: size,
                    borderColor: on ? FRIEND_GREEN : `${NAVY}33`,
                    backgroundColor: on ? FRIEND_GREEN : "#FFFFFF",
                    transform: `scale(${on ? 1.18 : 1})`,
                    transition:
                      "background-color 160ms ease, border-color 160ms ease, transform 380ms cubic-bezier(0.34, 1.7, 0.64, 1)",
                  }}
                >
                  {on ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: `${FRIEND_GREEN}33` }}>
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: FRIEND_GREEN,
                  width: `${(count / total) * 100}%`,
                  transition: "width 90ms linear",
                }}
              />
            </div>
            <span className="w-[46px] shrink-0 text-right text-[12px] font-black leading-none tabular-nums" style={{ color: NAVY }}>
              {count}/{total}
              {visual.unit}
            </span>
          </div>
        </Pop>
      </div>
      <At x={252} top={9}>
        <Stamp label={visual.badge} delay={3600} />
      </At>
    </div>
  );
}

// ④ 分かること: 自己診断 vs 友達の目 のギャップ図 (/tako の「自分とのギャップ」の簡略版)。
// 行が順に出たあと、「友達」の印が1行ずつ「自分」の位置に現れて動き、差が開く。最後にスタンプ。
const GAP_ROWS = [
  { label: "外向性", color: "#3FA7C9", self: 58, friend: 90 },
  { label: "協調性", color: "#3BA776", self: 80, friend: 66 },
  { label: "開放性", color: "#E0A93B", self: 40, friend: 74 },
];

function GapVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "gap" }>;
}) {
  // マウント直後は「友達」の印を出さない。次のフレームから1行ずつ順に、
  // 「自分」の位置にポンと現れ、そこから本来の位置へ動いて差が開く。
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpened(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  // 白い台紙は帯いっぱいに近い大きさ。凡例は左、スタンプは右上に置いて重ねない。
  return (
    <div className="relative">
      <Pop className="flex w-[284px] max-w-full flex-col gap-3 rounded-2xl bg-white px-4 pb-4 pt-3.5 shadow-[0_3px_12px_rgba(46,46,92,0.08)]">
        <div className="flex items-center gap-3.5 text-[12px] font-bold leading-none" style={{ color: NAVY }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45" style={{ backgroundColor: NAVY }} />
            {visual.selfLabel ?? "自分"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-full border-[3px] bg-white" style={{ borderColor: SORA }} />
            {visual.friendLabel ?? "友達"}
          </span>
        </div>
        {GAP_ROWS.map((row, i) => {
          const friend = opened ? row.friend : row.self;
          // 行ごとに: 印が現れる → 少し溜めてから動く。
          const appearAt = 1100 + i * 480;
          const moveAt = appearAt + 260;
          const move = `900ms cubic-bezier(0.34, 1.4, 0.64, 1) ${moveAt}ms`;
          return (
            <Pop key={row.label} delay={250 + i * 150} className="flex origin-left items-center gap-3">
              <span className="w-11 shrink-0 text-left text-[13px] font-black leading-none" style={{ color: NAVY }}>
                {visual.rowLabels?.[i] ?? row.label}
              </span>
              <div className="relative h-3 flex-1 rounded-full" style={{ backgroundColor: `${row.color}2E` }}>
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    backgroundColor: row.color,
                    left: `${Math.min(row.self, friend)}%`,
                    width: `${Math.abs(friend - row.self)}%`,
                    transition: `left ${move}, width ${move}`,
                  }}
                />
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45"
                  style={{ left: `${row.self}%`, backgroundColor: NAVY }}
                />
                <span
                  className="absolute top-1/2 h-5 w-5 rounded-full border-[4px] bg-white shadow-[0_2px_6px_rgba(46,46,92,0.18)]"
                  style={{
                    left: `${friend}%`,
                    borderColor: row.color,
                    opacity: opened ? 1 : 0,
                    transform: `translate(-50%, -50%) scale(${opened ? 1 : 0})`,
                    transition: `left ${move}, opacity 200ms ease ${appearAt}ms, transform 420ms cubic-bezier(0.34, 1.7, 0.64, 1) ${appearAt}ms`,
                  }}
                />
              </div>
            </Pop>
          );
        })}
      </Pop>
      <div className="absolute -right-2 -top-3.5">
        <Stamp label={visual.badge} delay={3400} />
      </div>
    </div>
  );
}

// ② (日本語) やり方その1: トーク画面風。お願いとリンクを送ると、友達から返事が届く。
const CHAT_GREEN = "#A6E58A";

function ChatVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "chat" }>;
}) {
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      {/* 自分: お願いの一言 */}
      <div className="absolute right-[18px] top-[13px]">
        <Pop delay={150} className="origin-right">
          <span
            className="block whitespace-nowrap rounded-[16px] rounded-tr-[5px] px-3.5 py-2.5 text-[13px] font-black leading-none shadow-[0_2px_6px_rgba(46,46,92,0.08)]"
            style={{ backgroundColor: CHAT_GREEN, color: NAVY }}
          >
            {visual.message}
          </span>
        </Pop>
      </div>
      {/* 自分: 招待リンクのカード */}
      <div className="absolute right-[18px] top-[55px] flex items-end gap-1.5">
        <span
          className="animate-fade-in pb-0.5 text-[10px] font-bold leading-none"
          style={{ color: `${NAVY}80`, animationDelay: "1900ms" }}
        >
          {visual.readLabel}
        </span>
        <Pop delay={800} className="origin-right">
          <span className="flex items-center gap-2 rounded-[14px] bg-white py-2 pl-2 pr-3.5 shadow-[0_3px_10px_rgba(46,46,92,0.12)]">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]"
              style={{ backgroundColor: SORA }}
            >
              <LinkIcon size={15} color="#FFFFFF" />
            </span>
            <span className="whitespace-nowrap text-[12px] font-black leading-none" style={{ color: NAVY }}>
              {visual.linkLabel}
            </span>
          </span>
        </Pop>
      </div>
      {/* 友達: 返事 */}
      <div className="absolute left-[18px] top-[108px]">
        <Pop delay={2500} className="flex origin-left items-center gap-2">
          <Face src={visual.friendFace} size={40} ring={FRIEND_GREEN} />
          <span
            className="whitespace-nowrap rounded-[16px] rounded-tl-[5px] bg-white px-3.5 py-2.5 text-[13px] font-black leading-none shadow-[0_2px_6px_rgba(46,46,92,0.10)]"
            style={{ color: NAVY }}
          >
            {visual.reply}
          </span>
        </Pop>
      </div>
    </div>
  );
}

// (友達側) 最初のあいさつ: フェルトの絵 (地色が白) を帯の色になじませて出し、紙吹雪を降らせる。
// 要素の両端 (percent %) を透明へぼかす指定。絵の地色は真っ白ではないので、枠の線が見えないようにする。
function fadeEdges(direction: "to right" | "to bottom", percent: number): React.CSSProperties {
  const mask = `linear-gradient(${direction}, transparent 0, #000 ${percent}%, #000 ${100 - percent}%, transparent 100%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

// 紙吹雪。帯の上から下へ、ゆっくり回りながら降り続ける (帯の外は切れて見えない)。
const CONFETTI_COLORS = ["#F6C544", "#FF8FB1", "#8E8EF5", "#6FBF73", "#7CC8E0"];
const CONFETTI = [
  { left: 4, size: 7, delay: 0, duration: 3200, round: false },
  { left: 11, size: 5, delay: 1400, duration: 3800, round: true },
  { left: 18, size: 6, delay: 700, duration: 3000, round: false },
  { left: 27, size: 5, delay: 2100, duration: 3600, round: true },
  { left: 36, size: 6, delay: 300, duration: 4000, round: false },
  { left: 47, size: 5, delay: 1700, duration: 3300, round: true },
  { left: 58, size: 6, delay: 900, duration: 3700, round: false },
  { left: 66, size: 5, delay: 2500, duration: 3100, round: true },
  { left: 74, size: 7, delay: 500, duration: 3500, round: false },
  { left: 82, size: 5, delay: 1900, duration: 3900, round: true },
  { left: 89, size: 6, delay: 1100, duration: 3200, round: false },
  { left: 95, size: 5, delay: 2800, duration: 3600, round: true },
];

function Confetti() {
  return (
    <>
      {CONFETTI.map((piece, i) => (
        <span
          key={i}
          className="slide-confetti pointer-events-none absolute -top-3"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 1.6,
            borderRadius: piece.round ? "50%" : 2,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${piece.delay}ms`,
            animationDuration: `${piece.duration}ms`,
          }}
          aria-hidden
        />
      ))}
    </>
  );
}

// フェルトの絵 (地色が白)。帯の中央に置き、乗算で帯の色になじませる。
function FeltArt({ src }: { src: string }) {
  return (
    // 乗算は一番外側に付ける (動きを付けた要素の内側に置くと、帯の色と混ざらず白い四角が残る)。
    <div
      className="absolute left-[35px] top-0 h-[164px] w-[246px]"
      style={{ mixBlendMode: "multiply", ...fadeEdges("to right", 5) }}
    >
      <div className="h-full w-full" style={fadeEdges("to bottom", 4)}>
        <Pop delay={100} className="h-full w-full">
          <SmoothImage
            src={src}
            alt=""
            width={492}
            height={328}
            unoptimized
            fadeIn={false}
            className="h-full w-full object-contain"
          />
        </Pop>
      </div>
    </div>
  );
}

function WelcomeVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "welcome" }>;
}) {
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      <FeltArt src={visual.image} />
      <Confetti />
    </div>
  );
}

// (友達側) やること: 質問カード1枚だけの図。丸の1つが選ばれ、回答数が total まで進んで
// 完了スタンプが出る。要素は「質問・丸・回答数」の3つに絞る。
// 丸の色は実物 (src/components/diagnosis/LikertScale.tsx) と同じ並び:
//   左 = そう思う側 (Sora ブルー) / 中央 = グレー / 右 = そう思わない側 (ピンク)。
const SCALE_DOTS = [
  { size: 27, color: "#5B5BEF" },
  { size: 22, color: "#C6C6F5" },
  { size: 17, color: "#A9A9BC" },
  { size: 22, color: "#F3C4DA" },
  { size: 27, color: "#E86AA6" },
];
const SCALE_PICK_INDEX = 0;
const QUESTION_PICK_MS = 1000; // 丸が選ばれるまで
const COUNT_START_MS = 1600; // 回答数が進み始めるまで
const COUNT_RUN_MS = 1400; // 回答数が total まで進む時間

function QuestionsVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "questions" }>;
}) {
  const [picked, setPicked] = useState(false);
  const [count, setCount] = useState(1);
  const total = visual.total;
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const pick = setTimeout(() => setPicked(true), QUESTION_PICK_MS);
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setCount((prev) => {
          if (prev >= total) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, COUNT_RUN_MS / Math.max(total - 1, 1));
    }, COUNT_START_MS);
    return () => {
      clearTimeout(pick);
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [total]);
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      {/* カードは帯の上下中央に置く (上下の余白をそろえる)。 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Pop delay={100} className="w-[236px] rounded-[18px] bg-white px-4 pb-3.5 pt-3 shadow-[0_6px_18px_rgba(46,46,92,0.10)]">
          {/* 見出しは回答数の札だけ (いま何問目か)。 */}
          <div className="flex">
            <span
              className="rounded-full px-2.5 py-[5px] text-[12px] font-black leading-none text-white tabular-nums"
              style={{ backgroundColor: SORA }}
            >
              {count}/{total}
              {visual.unit}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line text-left text-[14px] font-black leading-[1.45]" style={{ color: NAVY }}>
            {visual.question}
          </p>
          <div className="mt-2.5 flex items-center justify-between px-2">
            {SCALE_DOTS.map((dot, i) => {
              const on = picked && i === SCALE_PICK_INDEX;
              return (
                <span
                  key={i}
                  className="flex items-center justify-center rounded-full border-[2.5px]"
                  style={{
                    width: dot.size,
                    height: dot.size,
                    borderColor: dot.color,
                    backgroundColor: on ? dot.color : "#FFFFFF",
                    transform: `scale(${on ? 1.15 : 1})`,
                    transition:
                      "background-color 160ms ease, transform 380ms cubic-bezier(0.34, 1.7, 0.64, 1)",
                  }}
                >
                  {on ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
              );
            })}
          </div>
        </Pop>
      </div>
      <At x={264} top={3}>
        <Stamp label={visual.badge} delay={COUNT_START_MS + COUNT_RUN_MS + 250} />
      </At>
    </div>
  );
}

// (友達側) 回答の行き先: 左の回答用紙 (チェックが3つ付く) から紙ひこうきが飛び、右の本人に届く。
// 届くと、本人の顔に赤い「1」の印が付く (スタンプは出さない)。
const SHEET_ROW_WIDTHS = [52, 40, 46];
const FLY_AT_MS = 1300; // 紙ひこうきが飛び立つ
const ARRIVE_AT_MS = FLY_AT_MS + 1000; // 本人に届く

function DeliverVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "deliver" }>;
}) {
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      {/* 飛んでいく道すじ。 */}
      <svg className="animate-fade-in absolute inset-0" width="316" height="164" viewBox="0 0 316 164" fill="none" aria-hidden style={{ animationDelay: "900ms" }}>
        <path d="M136 92 Q 172 44 208 74" {...DOTTED} />
      </svg>
      {/* 回答用紙。 */}
      <div className="absolute left-[24px] top-[27px]">
        <Pop delay={100}>
          <div className="w-[108px] -rotate-[5deg] rounded-[14px] bg-white px-3 pb-3.5 pt-3 shadow-[0_6px_18px_rgba(46,46,92,0.12)]">
            <p className="whitespace-nowrap text-left text-[11px] font-black leading-none" style={{ color: NAVY }}>
              {visual.sheetLabel}
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              {SHEET_ROW_WIDTHS.map((width, i) => (
                <Pop key={i} delay={350 + i * 220} className="flex origin-left items-center gap-2">
                  <span
                    className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: SORA }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span className="h-2 rounded-full" style={{ width, backgroundColor: TRACK }} />
                </Pop>
              ))}
            </div>
          </div>
        </Pop>
      </div>
      {/* 紙ひこうき。回答用紙のそばから弧を描いて飛び、本人の手前で消える。 */}
      <div
        className="slide-fly absolute left-[190px] top-[56px] flex h-[34px] w-[34px] items-center justify-center rounded-full shadow-[0_4px_12px_rgba(91,91,239,0.40)]"
        style={{ backgroundColor: SORA, animationDelay: `${FLY_AT_MS}ms` }}
        aria-hidden
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
        </svg>
      </div>
      {/* 本人。届いた瞬間に赤い印が付く。 */}
      <At x={250} top={36}>
        <Pop delay={250} className="flex flex-col items-center">
          <span className="relative">
            <Face src={visual.recipientFace} size={74} ring={SORA} />
            <span className="absolute -right-1 -top-1">
              <Pop delay={ARRIVE_AT_MS}>
                <span
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-black leading-none text-white"
                  style={{ backgroundColor: "#EF4444", boxShadow: "0 0 0 2.5px #fff" }}
                >
                  1
                </span>
              </Pop>
            </span>
          </span>
          <NameChip label={visual.recipientName} color={SORA} />
        </Pop>
      </At>
    </div>
  );
}

// (友達側) 本人が得るもの: 結果のカードが3枚 (キャラ / 理解度 / ギャップ) 順にポンと出て、
// 最後に「ほかにもある」の札が出る。カードは左右を少し傾け、中央を一段高くして扇形に見せる。
const RESULT_CARD_AT_MS = [200, 750, 1300];
const RESULT_MORE_AT_MS = 2100;
const RESULT_BARS = [
  { color: "#3FA7C9", left: 28, width: 46 },
  { color: "#3BA776", left: 44, width: 24 },
  { color: "#E0A93B", left: 18, width: 40 },
];

function ResultCard({
  label,
  index,
  children,
}: {
  label: string;
  index: number;
  children: React.ReactNode;
}) {
  const tilt = index === 0 ? -5 : index === 2 ? 5 : 0;
  return (
    <div className="absolute" style={{ left: 14 + index * 98, top: index === 1 ? 10 : 18 }}>
      <Pop delay={RESULT_CARD_AT_MS[index]}>
        <div
          className="flex h-[104px] w-[92px] flex-col items-center rounded-[14px] bg-white px-2 pb-2 pt-2.5 shadow-[0_6px_18px_rgba(46,46,92,0.12)]"
          style={{ transform: `rotate(${tilt}deg)` }}
        >
          <span
            className="whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-black leading-none text-white"
            style={{ backgroundColor: SORA }}
          >
            {label}
          </span>
          <div className="flex w-full flex-1 flex-col items-center justify-center">{children}</div>
        </div>
      </Pop>
    </div>
  );
}

function ResultsVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "results" }>;
}) {
  // 理解度の数字は、2枚目のカードが出たところで 0 から数え上がる。棒はそのあと伸びる。
  const [score, setScore] = useState(0);
  const [grown, setGrown] = useState(false);
  const target = visual.score;
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setScore((prev) => {
          const next = Math.min(prev + 3, target);
          if (next >= target) clearInterval(interval);
          return next;
        });
      }, 24);
    }, RESULT_CARD_AT_MS[1] + 250);
    const grow = setTimeout(() => setGrown(true), RESULT_CARD_AT_MS[2] + 250);
    return () => {
      clearTimeout(start);
      clearTimeout(grow);
      clearInterval(interval);
    };
  }, [target]);
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      <ResultCard label={visual.labels[0]} index={0}>
        <Face src={visual.face} size={44} ring={visual.faceColor} />
        <span className="mt-1.5 whitespace-nowrap text-[10px] font-black leading-none" style={{ color: NAVY }}>
          {visual.word}
        </span>
      </ResultCard>
      <ResultCard label={visual.labels[1]} index={1}>
        <span className="font-black leading-none tabular-nums" style={{ color: SORA }}>
          <span className="text-[32px]">{score}</span>
          <span className="text-[15px]">%</span>
        </span>
      </ResultCard>
      <ResultCard label={visual.labels[2]} index={2}>
        <div className="flex w-full flex-col gap-[7px] px-1">
          {RESULT_BARS.map((bar) => (
            <div key={bar.color} className="relative h-[7px] rounded-full" style={{ backgroundColor: `${bar.color}2E` }}>
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  backgroundColor: bar.color,
                  left: `${bar.left}%`,
                  width: grown ? `${bar.width}%` : "0%",
                  transition: "width 700ms cubic-bezier(0.34, 1.4, 0.64, 1)",
                }}
              />
            </div>
          ))}
        </div>
      </ResultCard>
      <div className="absolute inset-x-0 top-[133px] flex justify-center">
        <Pop delay={RESULT_MORE_AT_MS}>
          <span
            className="block whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[11px] font-black leading-none shadow-[0_3px_10px_rgba(46,46,92,0.10)]"
            style={{ color: NAVY }}
          >
            <span style={{ color: SORA }}>＋</span> {visual.more}
          </span>
        </Pop>
      </div>
    </div>
  );
}

// ⑤ どこから: 結果ページの下部ナビを模し、「友達診断」タブを吹き出しと輪で指す。
// アイコンは実物 (src/components/BottomNav.tsx) と同じ形・同じ並び。実物を変えたらここも揃える。
const NAV_ACTIVE = "#2A3A5C";
const NAV_INACTIVE = "#9BA3B4";
const NAV_ICON_PATHS: React.ReactNode[] = [
  <>
    <rect x="5" y="4" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="2" />
    <path d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M8.5 11h7M8.5 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </>,
  <>
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
    <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14.6c2 .6 3.5 2.4 3.5 4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </>,
  <>
    <path d="M5 5.5h10.5A3.5 3.5 0 0 1 19 9v4a3.5 3.5 0 0 1-3.5 3.5H10l-4.5 3v-3.35A3.5 3.5 0 0 1 2.5 13V9A3.5 3.5 0 0 1 5 5.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="m10.75 7.75.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55.55-1.45Z" fill="currentColor" />
    <path d="M17.5 2.5v2M16.5 3.5h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </>,
  <>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
    <path d="M12 3.5 19.36 16.25H4.64L12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="12" cy="3.5" r="1.5" fill="currentColor" />
    <circle cx="19.36" cy="16.25" r="1.5" fill="currentColor" />
    <circle cx="4.64" cy="16.25" r="1.5" fill="currentColor" />
  </>,
  <>
    <rect x="4.5" y="5" width="11.5" height="15.5" rx="2.2" transform="rotate(-7 4.5 5)" stroke="currentColor" strokeWidth="1.8" />
    <rect x="8" y="3.5" width="11.5" height="16.5" rx="2.2" fill="white" stroke="currentColor" strokeWidth="2" />
    <path d="m13.75 8 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" fill="currentColor" />
  </>,
];
// 友達診断は左から2番目。ナビは帯の左右12pxを空けた292px幅を5等分している。
const ENTRY_TAB_INDEX = 1;
const ENTRY_TAB_CENTER_X = 12 + (292 / 5) * (ENTRY_TAB_INDEX + 0.5);

function EntryVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "entry" }>;
}) {
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      {/* 結果ページの見立て。下はナビに隠れる。 */}
      <div
        className="animate-fade-in absolute left-[30px] top-[12px] h-[120px] w-[256px] rounded-t-2xl bg-white/85 px-4 pt-3"
        style={{ animationDelay: "100ms" }}
      >
        <div className="flex items-center gap-2.5">
          <Face src={visual.selfFace} size={30} ring={SORA} />
          <div className="min-w-0 flex-1">
            <p className="text-left text-[12px] font-black leading-none" style={{ color: NAVY }}>
              {visual.pageLabel}
            </p>
            <span className="mt-2 block h-1.5 w-28 rounded-full" style={{ backgroundColor: TRACK }} />
          </div>
        </div>
      </div>
      {/* 下部ナビ */}
      <div className="absolute inset-x-[12px] bottom-0">
        <Pop
          delay={350}
          className="grid origin-bottom grid-cols-5 rounded-t-[18px] bg-white pb-2 pt-2.5 shadow-[0_-3px_12px_rgba(46,46,92,0.12)]"
        >
          {visual.tabs.map((tab, i) => {
            const target = i === ENTRY_TAB_INDEX;
            return (
              <div
                key={tab}
                className="relative flex flex-col items-center gap-1"
                style={{ color: i === 0 || target ? NAV_ACTIVE : NAV_INACTIVE }}
              >
                {i === 0 ? (
                  <span className="absolute -top-2.5 h-[3px] w-6 rounded-full" style={{ backgroundColor: NAV_ACTIVE }} />
                ) : null}
                <span className="relative">
                  {target ? (
                    <span
                      className="slide-tap-ring absolute -left-[7px] -top-[7px] h-[38px] w-[38px] rounded-full"
                      style={{ backgroundColor: `${SORA}66`, animationDelay: "1700ms" }}
                    />
                  ) : null}
                  <svg className="relative" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                    {NAV_ICON_PATHS[i]}
                  </svg>
                  {target ? (
                    <span className="absolute -right-2 -top-1.5">
                      <Pop delay={900}>
                        <span
                          className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[10px] font-black leading-none text-white"
                          style={{ backgroundColor: "#EF4444", boxShadow: "0 0 0 2px #fff" }}
                        >
                          !
                        </span>
                      </Pop>
                    </span>
                  ) : null}
                </span>
                <span className="whitespace-nowrap text-[9px] font-bold leading-none">{tab}</span>
              </div>
            );
          })}
        </Pop>
      </div>
      {/* 吹き出し: 友達診断タブの真上。出たあとは小さく弾み続ける。 */}
      <At x={ENTRY_TAB_CENTER_X} top={60}>
        <Pop delay={1200} className="origin-bottom">
          <div
            className="animate-slide-bob relative whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-black leading-none text-white shadow-[0_3px_10px_rgba(91,91,239,0.35)]"
            style={{ backgroundColor: SORA, animationDelay: "1900ms" }}
          >
            {visual.bubble}
            <span
              className="absolute left-1/2 top-full -ml-[5px] -mt-[6px] h-2.5 w-2.5 rotate-45"
              style={{ backgroundColor: SORA }}
            />
          </div>
        </Pop>
      </At>
    </div>
  );
}

function Sparkle({ size, color = "#F2C14E" }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 1.5 14.2 9.8 22.5 12 14.2 14.2 12 22.5 9.8 14.2 1.5 12 9.8 9.8Z" fill={color} />
    </svg>
  );
}

// 結果アップグレードの手順1: 本人の結果ページの上の端を模した図で、右上のボタンを指す。
//   実物の画面 (上の固定バー: 丸いボタン2つ + 「結果をアップグレード」/ その下にタイプの色のヒーロー) と
//   同じ並び・同じ色にして、準備画面が終わった直後に見える画面とつながるようにする。
// 配置は帯 316×164 の中の座標。ページの見立ては左右 14px を空けて置く。
const UPGRADE_PAGE_LEFT = 14;
const UPGRADE_PAGE_TOP = 14;
const UPGRADE_PAGE_W = 288;
const UPGRADE_BAR_H = 46;
// 「結果をアップグレード」のボタンの幅と、右の端・左の丸とのすき間。
const UPGRADE_BUTTON_W = 144;
const UPGRADE_BUTTON_RIGHT = 10;
const UPGRADE_BAR_GAP = 6;

function UpgradeButtonVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "upgradeButton" }>;
}) {
  // 名前が長いタイプは、吹き出しに重ならないよう文字を小さくする。
  const nameSize = visual.typeName.length > 7 ? 15 : visual.typeName.length > 5 ? 18 : 21;
  const circle = (children: React.ReactNode) => (
    <span
      className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-white"
      style={{ boxShadow: `0 0 0 1.5px ${visual.buttonColor}40` }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={visual.buttonColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </span>
  );
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      {/* 結果ページの見立て (上の端)。下は帯の外へ続く。 */}
      <div
        className="animate-fade-in-up absolute overflow-hidden rounded-t-[18px] bg-white shadow-[0_6px_20px_rgba(46,46,92,0.12)]"
        style={{
          left: UPGRADE_PAGE_LEFT,
          top: UPGRADE_PAGE_TOP,
          width: UPGRADE_PAGE_W,
          height: 164 - UPGRADE_PAGE_TOP,
          animationDelay: "100ms",
        }}
      >
        {/* 上の固定バー: 丸いボタン2つ。「結果をアップグレード」は光の輪が切れないよう、この枠の外に重ねる。 */}
        <div
          className="flex items-center justify-end"
          style={{
            height: UPGRADE_BAR_H,
            gap: UPGRADE_BAR_GAP,
            paddingRight: UPGRADE_BUTTON_RIGHT + UPGRADE_BUTTON_W + UPGRADE_BAR_GAP,
            borderBottom: `1px solid ${NAVY}14`,
          }}
        >
          {circle(
            <>
              <path d="M12 15V4" />
              <path d="m7 8 5-5 5 5" />
              <path d="M5 13v6h14v-6" />
            </>,
          )}
          {circle(
            <>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c.6-3.4 3.2-5.2 6.5-5.2s5.9 1.8 6.5 5.2" />
              <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 15.2c1.7.8 2.7 2.4 3 4.8" />
            </>,
          )}
        </div>
        {/* ヒーロー: タイプの色の帯に、見出し・名前・本人のキャラ。 */}
        <div
          className="relative overflow-hidden"
          style={{
            height: 164 - UPGRADE_PAGE_TOP - UPGRADE_BAR_H,
            background: `radial-gradient(circle at 50% 8%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 62%), ${visual.heroColor}`,
          }}
        >
          <p className="pt-[12px] text-center text-[9px] font-black leading-none text-white/90">
            {visual.heroLabel}
          </p>
          <p
            className="mt-[7px] whitespace-nowrap text-center font-black leading-none text-white"
            style={{ fontSize: nameSize }}
          >
            {visual.typeName}
          </p>
          <div className="absolute left-1/2 top-[54px] h-[78px] w-[78px] -translate-x-1/2">
            <SmoothImage
              src={visual.selfFace}
              alt=""
              width={156}
              height={156}
              unoptimized
              fadeIn={false}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>
      {/* 「結果をアップグレード」。実物と同じ色・同じ縁で、まわりに光の輪が広がり続ける。 */}
      <div
        className="absolute"
        style={{
          right: 316 - (UPGRADE_PAGE_LEFT + UPGRADE_PAGE_W) + UPGRADE_BUTTON_RIGHT,
          top: UPGRADE_PAGE_TOP + (UPGRADE_BAR_H - 30) / 2 - 1,
        }}
      >
        <Pop delay={500}>
          <span
            className="slide-upgrade-halo flex h-[30px] items-center justify-center gap-[5px] whitespace-nowrap rounded-full text-[10.5px] font-black leading-none text-white"
            style={
              {
                width: UPGRADE_BUTTON_W,
                backgroundColor: visual.buttonColor,
                "--edge": `0 3px 0 ${visual.buttonShadow}`,
                boxShadow: `0 3px 0 ${visual.buttonShadow}`,
                animationDelay: "1400ms",
              } as React.CSSProperties
            }
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 20V6" />
              <path d="m7 11 5-5 5 5" />
              <path d="M19 2v4M17 4h4" />
              <path d="M5 16v4M3 18h4" />
            </svg>
            {visual.buttonLabel}
          </span>
        </Pop>
      </div>
      {/* ボタンを下から指す吹き出し。 */}
      {/* ヒーローの見出しと名前 (中央) に重ならないよう、ボタンの右寄りの下に置く。 */}
      <At x={262} top={UPGRADE_PAGE_TOP + UPGRADE_BAR_H + 4}>
        <Pop delay={1000} className="origin-top">
          <div
            className="animate-slide-bob relative whitespace-nowrap rounded-full px-3 py-[7px] text-[12px] font-black leading-none text-white shadow-[0_3px_10px_rgba(154,106,36,0.4)]"
            style={{ background: "linear-gradient(135deg, #E8B84A, #C98F2A)", animationDelay: "1800ms" }}
          >
            <span
              className="absolute bottom-full left-1/2 -mb-[5px] -ml-[4px] h-2 w-2 rotate-45"
              style={{ backgroundColor: "#DDA83E" }}
            />
            <span className="relative">{visual.bubble}</span>
          </div>
        </Pop>
      </At>
    </div>
  );
}

// 結果アップグレードの手順2: Aliceとの会話画面を模した図 (実物は ResultUpgradeChat)。
//   1. Alice が質問する → 2. 答えの吹き出しが出る → 3. 上の目盛りと「n / 7」が最後まで進み、札が金色になる
// 動きはすべて CSS。奥のカード (slide-still) と reduced-motion では、進みきった完成形で止まる。
const QA_ANSWER_AT_MS = 1400;
const QA_RUN_AT_MS = 2000;
const QA_RUN_MS = 1300;
const QA_DONE_AT_MS = QA_RUN_AT_MS + QA_RUN_MS + 120;
// 「n / 7」の数字1つ分の高さ (px)。数字を縦に並べ、1つずつ上へ送る。
const QA_DIGIT_H = 14;
const QA_INDIGO = "#5B5BEF";

function AliceQaVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "aliceQa" }>;
}) {
  const total = visual.total;
  const stepMs = QA_RUN_MS / Math.max(total - 1, 1);
  const avatar = (size: number) => (
    <span
      className="block shrink-0 overflow-hidden rounded-full bg-[#F3EEFF]"
      style={{ width: size, height: size, boxShadow: "0 0 0 1.5px #FFFFFF, 0 1px 4px rgba(46,46,92,0.14)" }}
      aria-hidden
    >
      <SmoothImage
        src={visual.aliceAvatar}
        alt=""
        width={size * 2}
        height={size * 2}
        unoptimized
        fadeIn={false}
        className="h-full w-full object-cover"
      />
    </span>
  );
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      {/* 会話画面の見立て。2枚目のページの見立てと同じ位置・同じ大きさで置く。 */}
      <div
        className="animate-fade-in-up absolute overflow-hidden rounded-t-[18px] shadow-[0_6px_20px_rgba(46,46,92,0.12)]"
        style={{
          left: UPGRADE_PAGE_LEFT,
          top: UPGRADE_PAGE_TOP,
          width: UPGRADE_PAGE_W,
          height: 164 - UPGRADE_PAGE_TOP,
          backgroundColor: "#FAF8F3",
          animationDelay: "100ms",
        }}
      >
        {/* 上の帯: Alice と「n / 7」、その下に7つの目盛り。 */}
        <div className="bg-white px-[10px] pb-[6px] pt-[7px]" style={{ borderBottom: `1px solid ${NAVY}12` }}>
          <div className="flex items-center gap-[7px]">
            {avatar(22)}
            <span className="text-[12px] font-black leading-none" style={{ color: NAVY }}>
              {visual.aliceName}
            </span>
            <span
              className="slide-qa-done ml-auto flex items-center gap-[3px] rounded-full px-[9px] text-[11px] font-black tabular-nums text-white"
              style={{
                height: 20,
                lineHeight: `${QA_DIGIT_H}px`,
                background: "linear-gradient(135deg, #E8B84A, #C98F2A)",
                animationDelay: `${QA_DONE_AT_MS}ms`,
              }}
            >
              <span className="block overflow-hidden" style={{ height: QA_DIGIT_H }}>
                <span
                  className="slide-qa-count flex flex-col"
                  style={
                    {
                      "--to": `${-(total - 1) * QA_DIGIT_H}px`,
                      transform: `translateY(${-(total - 1) * QA_DIGIT_H}px)`,
                      animationDelay: `${QA_RUN_AT_MS}ms`,
                      animationDuration: `${QA_RUN_MS}ms`,
                      animationTimingFunction: `steps(${Math.max(total - 1, 1)}, end)`,
                    } as React.CSSProperties
                  }
                >
                  {Array.from({ length: total }, (_, i) => (
                    <span key={i} className="block text-center" style={{ height: QA_DIGIT_H }}>
                      {i + 1}
                    </span>
                  ))}
                </span>
              </span>
              <span className="opacity-70">/ {total}</span>
            </span>
          </div>
          <div className="mt-[6px] flex gap-[3px]">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className="block h-[4px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "#ECE9E1" }}>
                <span
                  className="slide-qa-fill block h-full w-full rounded-full"
                  style={{
                    backgroundColor: QA_INDIGO,
                    // 1つ目は答えた瞬間、残りは数字と一緒に進み、最後の1つは数え終わりで埋まる。
                    animationDelay: `${
                      i === 0 ? QA_ANSWER_AT_MS + 150 : i === total - 1 ? QA_DONE_AT_MS - 80 : QA_RUN_AT_MS + i * stepMs
                    }ms`,
                  }}
                />
              </span>
            ))}
          </div>
        </div>
        {/* Alice の質問。 */}
        <div className="absolute left-[10px] top-[53px] flex items-start gap-[7px]">
          <Pop delay={400}>{avatar(28)}</Pop>
          <Pop delay={500} className="origin-top-left">
            <div
              className="rounded-[14px] rounded-tl-[4px] bg-white px-[11px] pb-[9px] pt-[7px] text-left"
              style={{ boxShadow: `0 0 0 1.5px ${QA_INDIGO}40, 0 2px 6px rgba(46,46,92,0.08)` }}
            >
              <span
                className="block w-fit rounded-full px-[7px] py-[3px] text-[9px] font-black leading-none text-white"
                style={{ backgroundColor: QA_INDIGO }}
              >
                {visual.questionLabel}
              </span>
              <p className="mt-[5px] whitespace-nowrap text-[12.5px] font-black leading-none" style={{ color: NAVY }}>
                {visual.question}
              </p>
            </div>
          </Pop>
        </div>
        {/* 自分の答え。 */}
        <div className="absolute bottom-[9px] right-[10px]">
          <Pop delay={QA_ANSWER_AT_MS} className="origin-bottom-right">
            <p
              className="whitespace-nowrap rounded-[14px] rounded-tr-[4px] px-[12px] py-[9px] text-left text-[12.5px] font-black leading-none text-white shadow-[0_2px_6px_rgba(67,67,214,0.22)]"
              style={{ background: `linear-gradient(180deg, ${QA_INDIGO} 0%, #4343D6 100%)` }}
            >
              {visual.answer}
            </p>
          </Pop>
        </div>
      </div>
    </div>
  );
}

// 結果アップグレードの手順3: できあがるもの (専用キャラと鑑定書)。
//   星空の書斎で Alice が2つを見せている1枚絵を、帯いっぱいに出す (札の文字は絵の中の刺しゅう)。
//   1. 暗い書斎に明かりが灯り、絵が少し寄った所からゆっくり引いていく
//   2. 専用キャラ → 鑑定書の順に、光ときらめきがはじける
//   3. そのあとは、2つのまわりできらめきがまたたき続ける
// 動きはすべて CSS。奥のカード (slide-still) と reduced-motion では、明かりが灯った絵のまま止まる。
// 座標は帯 316×164 の中 (絵の中のうさぎと本の位置)。
const FINALE_SPOTS = [
  { x: 70, y: 78, at: 1000 },
  { x: 255, y: 82, at: 1600 },
];
const FINALE_BURST = [
  { dx: -44, dy: -34, size: 12 },
  { dx: -50, dy: 12, size: 8 },
  { dx: 0, dy: -50, size: 10 },
  { dx: 44, dy: -34, size: 12 },
  { dx: 50, dy: 12, size: 8 },
];
const FINALE_TWINKLES = [
  { left: 22, top: 26, size: 11, delay: 0 },
  { left: 104, top: 44, size: 9, delay: 600 },
  { left: 196, top: 30, size: 9, delay: 300 },
  { left: 286, top: 40, size: 11, delay: 900 },
  { left: 150, top: 8, size: 8, delay: 1200 },
];

function UpgradeResultVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "upgradeResult" }>;
}) {
  return (
    <div className="relative h-[164px] w-[316px] shrink-0 overflow-hidden">
      <div className="slide-finale-zoom absolute inset-0">
        <SmoothImage
          src={visual.art}
          alt=""
          width={948}
          height={492}
          unoptimized
          fadeIn={false}
          className="h-full w-full object-cover"
        />
      </div>
      {/* はじめは暗く、すぐに明かりが灯る。 */}
      <div className="slide-finale-veil absolute inset-0" style={{ backgroundColor: "#0B0E2C" }} aria-hidden />
      {FINALE_SPOTS.map((spot) => (
        <div key={spot.x} aria-hidden>
          {/* 光。 */}
          <div
            className="slide-upgrade-flash absolute h-[120px] w-[120px] rounded-full"
            style={{
              left: spot.x - 60,
              top: spot.y - 60,
              background:
                "radial-gradient(circle, rgba(255,246,214,0.95) 0%, rgba(255,222,140,0.6) 38%, rgba(255,214,110,0) 70%)",
              mixBlendMode: "screen",
              animationDelay: `${spot.at}ms`,
            }}
          />
          {/* はじけるきらめき。 */}
          {FINALE_BURST.map((spark, i) => (
            <span
              key={i}
              className="slide-sparkle absolute"
              style={
                {
                  left: spot.x,
                  top: spot.y,
                  "--dx": `${spark.dx}px`,
                  "--dy": `${spark.dy}px`,
                  animationDelay: `${spot.at + 40}ms`,
                  animationDuration: "900ms",
                  filter: "drop-shadow(0 0 4px rgba(255,205,90,0.9))",
                } as React.CSSProperties
              }
            >
              <Sparkle size={spark.size} color="#FFD76A" />
            </span>
          ))}
        </div>
      ))}
      {/* またたき続けるきらめき。 */}
      {FINALE_TWINKLES.map((spark, i) => (
        <div key={i} className="absolute" style={{ left: spark.left, top: spark.top }} aria-hidden>
          <Pop delay={1900 + i * 120}>
            <span
              className="slide-upgrade-twinkle block"
              style={{ animationDelay: `${spark.delay}ms`, filter: "drop-shadow(0 0 4px rgba(255,205,90,0.9))" }}
            >
              <Sparkle size={spark.size} color="#FFD76A" />
            </span>
          </Pop>
        </div>
      ))}
    </div>
  );
}

// 完全版の購入後の準備画面: いつものキャラが「あなた専用」のキャラに変身する。
//   1. 左にいつものキャラ、右には変身後のキャラが影のまま待っている
//   2. 金色のきらめきが、左から右へ弧を描いて飛ぶ
//   3. 届いた瞬間に光がはじけ、影が本物のキャラになって、うしろで光の筋が回り始める
// 奥のカード (slide-still) と reduced-motion では動きが止まるので、止まった姿 = 変身後の完成形にしてある。
const UPGRADE_FLY_AT_MS = 900;
const UPGRADE_ARRIVE_AT_MS = 1750;
// 配置 (帯 316×164 の中の座標)。左右の2つを帯の中心 (158) から同じ距離に置く。
// 2つは同じ地面に立たせる (下端をそろえる) 。札はそれぞれの絵のすぐ下に付け、左右で同じ高さ・大きさにする。
const UPGRADE_BEFORE_X = 78;
const UPGRADE_AFTER_X = 238;
const UPGRADE_CENTER_Y = 68;
// 左は「いつもの」姿なので、右の専用キャラより小さくする (主役は右)。
const UPGRADE_FACE_SIZE = 72;
// 丸と札のすき間。
const UPGRADE_FACE_GAP = 8;
const UPGRADE_ART_W = 111;
const UPGRADE_ART_H = 126;
const UPGRADE_LABEL_TOP = 131;
const UPGRADE_LABEL_CLASS =
  "block whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-black leading-none";
// 届いた瞬間に周りへはじけるきらめき (飛ぶ向きと大きさ)。
const UPGRADE_BURST = [
  { dx: -62, dy: -44, size: 13 },
  { dx: -74, dy: 6, size: 9 },
  { dx: -54, dy: 50, size: 11 },
  { dx: 0, dy: -64, size: 10 },
  { dx: 58, dy: -46, size: 13 },
  { dx: 72, dy: 4, size: 9 },
  { dx: 56, dy: 48, size: 11 },
  { dx: 4, dy: 62, size: 8 },
];
// 変身のあと、キャラのまわりでまたたき続けるきらめき。
const UPGRADE_TWINKLES = [
  { left: 174, top: 14, size: 14, delay: 0 },
  { left: 292, top: 56, size: 11, delay: 500 },
  { left: 178, top: 98, size: 9, delay: 950 },
];

function UpgradeVisual({
  visual,
}: {
  visual: Extract<AnalyzingSlide["visual"], { kind: "upgrade" }>;
}) {
  const art = (
    <SmoothImage
      src={visual.afterArt}
      alt=""
      width={240}
      height={272}
      fadeIn={false}
      className="h-full w-full object-contain"
    />
  );
  return (
    <div className="relative h-[164px] w-[316px] shrink-0">
      {/* 変身したあと、右側が金色の光に染まる。 */}
      <div
        className="animate-fade-in absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 75% 41%, rgba(255,224,140,0.95) 0%, rgba(255,233,178,0.6) 30%, rgba(255,240,205,0) 60%)",
          animationDelay: `${UPGRADE_ARRIVE_AT_MS}ms`,
          animationDuration: "700ms",
        }}
        aria-hidden
      />
      {/* うしろでゆっくり回る光の筋。 */}
      <div
        className="animate-fade-in absolute h-[230px] w-[230px]"
        style={{
          left: UPGRADE_AFTER_X - 115,
          top: UPGRADE_CENTER_Y - 115,
          animationDelay: `${UPGRADE_ARRIVE_AT_MS + 100}ms`,
          animationDuration: "700ms",
        }}
        aria-hidden
      >
        <div
          className="slide-upgrade-rays h-full w-full rounded-full"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.78) 0deg 8deg, rgba(255,255,255,0) 8deg 30deg)",
            WebkitMaskImage: "radial-gradient(circle, #000 18%, rgba(0,0,0,0) 66%)",
            maskImage: "radial-gradient(circle, #000 18%, rgba(0,0,0,0) 66%)",
          }}
        />
      </div>
      {/* きらめきが飛んだ道すじ。 */}
      <svg
        className="animate-fade-in absolute inset-0"
        width="316"
        height="164"
        viewBox="0 0 316 164"
        fill="none"
        aria-hidden
        style={{ animationDelay: `${UPGRADE_FLY_AT_MS + 350}ms` }}
      >
        <path d="M106 53 Q 140 0 187 44" stroke={GOLD} strokeWidth="2.6" strokeDasharray="1 7" strokeLinecap="round" />
      </svg>
      {/* いつものキャラ。 */}
      <At x={UPGRADE_BEFORE_X} top={UPGRADE_LABEL_TOP - UPGRADE_FACE_GAP - UPGRADE_FACE_SIZE}>
        <Pop delay={100}>
          <Face src={visual.beforeFace} size={UPGRADE_FACE_SIZE} ring="#FFFFFF" />
        </Pop>
      </At>
      <At x={UPGRADE_BEFORE_X} top={UPGRADE_LABEL_TOP}>
        <Pop delay={250}>
          <span className={`${UPGRADE_LABEL_CLASS} bg-white`} style={{ color: `${NAVY}99` }}>
            {visual.beforeLabel}
          </span>
        </Pop>
      </At>
      {/* 変身前は、影のまま待っている。届いた瞬間に消える。 */}
      <div
        className="slide-upgrade-shadow absolute"
        style={{
          width: UPGRADE_ART_W,
          height: UPGRADE_ART_H,
          left: UPGRADE_AFTER_X - UPGRADE_ART_W / 2,
          top: UPGRADE_CENTER_Y - UPGRADE_ART_H / 2,
          animationDuration: `${UPGRADE_ARRIVE_AT_MS + 200}ms`,
        }}
        aria-hidden
      >
        <div className="h-full w-full" style={{ filter: "brightness(0)", opacity: 0.2 }}>
          {art}
        </div>
      </div>
      {/* 届いた瞬間の光。 */}
      <div
        className="slide-upgrade-flash absolute h-[150px] w-[150px] rounded-full"
        style={{
          left: UPGRADE_AFTER_X - 75,
          top: UPGRADE_CENTER_Y - 75,
          background:
            "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,236,170,0.9) 36%, rgba(255,214,110,0) 70%)",
          animationDelay: `${UPGRADE_ARRIVE_AT_MS}ms`,
        }}
        aria-hidden
      />
      {/* あなた専用のキャラ。弾んで出たあと、ゆっくり浮かぶ。 */}
      <div
        className="slide-upgrade-float absolute"
        style={{
          width: UPGRADE_ART_W,
          height: UPGRADE_ART_H,
          left: UPGRADE_AFTER_X - UPGRADE_ART_W / 2,
          top: UPGRADE_CENTER_Y - UPGRADE_ART_H / 2,
          animationDelay: `${UPGRADE_ARRIVE_AT_MS + 700}ms`,
        }}
      >
        <div
          className="slide-upgrade-reveal h-full w-full"
          style={{
            animationDelay: `${UPGRADE_ARRIVE_AT_MS}ms`,
            filter: "drop-shadow(0 6px 10px rgba(154,106,36,0.22))",
          }}
        >
          {art}
        </div>
      </div>
      {/* 届いた瞬間に、きらめきが周りへはじける。 */}
      {UPGRADE_BURST.map((spark, i) => (
        <span
          key={i}
          className="slide-sparkle absolute"
          style={
            {
              left: UPGRADE_AFTER_X,
              top: UPGRADE_CENTER_Y,
              "--dx": `${spark.dx}px`,
              "--dy": `${spark.dy}px`,
              animationDelay: `${UPGRADE_ARRIVE_AT_MS + 40}ms`,
              animationDuration: "900ms",
            } as React.CSSProperties
          }
          aria-hidden
        >
          <Sparkle size={spark.size} />
        </span>
      ))}
      {/* まわりでまたたき続けるきらめき。 */}
      {UPGRADE_TWINKLES.map((spark, i) => (
        <div key={i} className="absolute" style={{ left: spark.left, top: spark.top }} aria-hidden>
          <Pop delay={UPGRADE_ARRIVE_AT_MS + 350 + i * 140}>
            <span className="slide-upgrade-twinkle block" style={{ animationDelay: `${spark.delay}ms` }}>
              <Sparkle size={spark.size} />
            </span>
          </Pop>
        </div>
      ))}
      {/* 左から右へ飛ぶきらめき。うしろに小さいのが2つ続いて、尾に見える。 */}
      {[
        { size: 22, lag: 0, opacity: 1 },
        { size: 13, lag: 90, opacity: 0.85 },
        { size: 8, lag: 170, opacity: 0.7 },
      ].map((comet, i) => (
        <span
          key={i}
          className="slide-upgrade-comet absolute"
          style={{
            left: 187 - comet.size / 2,
            top: 44 - comet.size / 2,
            animationDelay: `${UPGRADE_FLY_AT_MS + comet.lag}ms`,
            filter: "drop-shadow(0 0 5px rgba(255,205,90,0.95))",
          }}
          aria-hidden
        >
          <span className="block" style={{ opacity: comet.opacity }}>
            <Sparkle size={comet.size} color="#F6C445" />
          </span>
        </span>
      ))}
      <At x={UPGRADE_AFTER_X} top={UPGRADE_LABEL_TOP}>
        <Pop delay={UPGRADE_ARRIVE_AT_MS + 500}>
          <span
            className={`${UPGRADE_LABEL_CLASS} text-white shadow-[0_3px_10px_rgba(154,106,36,0.35)]`}
            style={{ background: "linear-gradient(135deg, #E8B84A, #C98F2A)" }}
          >
            {visual.afterLabel}
          </span>
        </Pop>
      </At>
    </div>
  );
}

// 文は1スライド1つ・1スタイル。highlight に一致する部分だけ色を変える。
function SlideText({ text, highlight }: { text: string; highlight?: string }) {
  const at = highlight ? text.indexOf(highlight) : -1;
  if (!highlight || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span style={{ color: SORA }}>{highlight}</span>
      {text.slice(at + highlight.length)}
    </>
  );
}

function slideFaces(slide: AnalyzingSlide): string[] {
  const v = slide.visual;
  if (v.kind === "voices") return [v.selfFace, ...v.voices.map((voice) => voice.face)];
  if (v.kind === "flip") return [v.selfFace, v.perceivedFace];
  if (v.kind === "send") return [v.selfFace, v.friendFace];
  if (v.kind === "answer") return [v.friendFace];
  if (v.kind === "entry") return [v.selfFace];
  if (v.kind === "chat") return [v.friendFace];
  if (v.kind === "quiz") return [v.friendFace];
  if (v.kind === "results") return [v.face];
  if (v.kind === "deliver") return [v.recipientFace];
  if (v.kind === "upgrade") return [v.beforeFace];
  if (v.kind === "upgradeButton") return [v.selfFace];
  if (v.kind === "upgradeResult") return [v.art];
  return [];
}

// カード1枚の基準寸法 (px)。中の絵はこの寸法を前提に座標で配置している。
const DECK_WIDTH = 340;
const DECK_HEIGHT = 270;

// 紹介スライド。1枚 = 白いカード1枚。正面と左右の3枚が見え、輪になって回る。
function AnalyzingSlideDeck({
  slides,
  index,
  label,
}: {
  slides: AnalyzingSlide[];
  index: number;
  label?: string;
}) {
  // カードを輪のように並べ、切り替えのたびに1つずつ回す。
  //   正面 / 右奥 (次の1枚) / 左奥 (前の1枚) / それ以外は真後ろに隠す
  // 正面のカードが左奥へ下がり、右奥のカードが正面へ出てくる。
  const count = slides.length;
  // 文が2行のスライドがあるときは、その分だけカードを置く枠を高くする。
  const deckHeight = DECK_HEIGHT + (slides.some((slide) => slide.text.includes("\n")) ? 18 : 0);
  // 絵は 340×270 の固定寸法で組んでいる。画面が狭いときは枠の幅を測り、
  // カード全体 (絵・文字・余白) を同じ比率で縮めて、右端が切れないようにする。
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / DECK_WIDTH));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={frameRef}
      className="mb-7 w-[340px] max-w-full"
      style={{ height: deckHeight * scale }}
    >
    <div
      className="relative w-[340px] origin-top-left"
      style={{ height: deckHeight, perspective: "800px", transform: `scale(${scale})` }}
    >
      {/* 顔画像を先に読み込み、回ってきたときに欠けて見えないようにする。 */}
      {[...new Set(slides.flatMap(slideFaces))].map((src) => (
        <link key={src} rel="preload" as="image" href={src} />
      ))}
      {slides.map((slide, i) => {
        const position = (i - index + count) % count;
        const front = position === 0;
        const right = position === 1;
        const left = position === count - 1 && !right;
        const hidden = !front && !right && !left;
        return (
          <div
            key={slide.text}
            className="absolute inset-x-0 top-0 rounded-[28px] border bg-white px-3.5 pb-3 pt-3.5 shadow-[0_10px_34px_rgba(46,46,92,0.10)]"
            style={{
              borderColor: front ? "transparent" : TRACK,
              transform: front
                ? "translateX(0) translateZ(0) rotateY(0deg) scale(1)"
                : hidden
                  ? "translateX(0) translateZ(-420px) rotateY(0deg) scale(0.8)"
                  : `translateX(${right ? 150 : -150}px) translateZ(-220px) rotateY(${right ? -42 : 42}deg) scale(0.88)`,
              // 奥のカードは白背景に溶けないよう、暗くして輪郭を残す (奥行きも出る)。
              filter: front ? "none" : "brightness(0.88) saturate(0.8)",
              opacity: hidden ? 0 : 1,
              zIndex: front ? 3 : right ? 2 : left ? 1 : 0,
              transition:
                "transform 850ms cubic-bezier(0.34, 1.25, 0.64, 1), filter 600ms ease, border-color 600ms ease, opacity 450ms ease",
            }}
            aria-hidden={front ? undefined : "true"}
          >
            {/* 見出しは全カード共通・同じ位置 (番号やカードごとの言い換えはしない)。 */}
            {/* step を持つスライドは、見出しの前に「STEP 1」などの札を出す。 */}
            {label || slide.step ? (
              <p
                className={`mb-3.5 px-1.5 pt-0.5 text-[15px] font-black leading-none ${slide.step ? "flex h-[15px] items-center gap-2" : ""}`}
                style={{ color: NAVY }}
              >
                {slide.step ? (
                  <span
                    className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-[5px] text-[11px] font-black leading-none tracking-wider text-white"
                    style={{ backgroundColor: SORA }}
                  >
                    {slide.step}
                  </span>
                ) : null}
                {label}
              </p>
            ) : null}
            {/* 正面に来るたびに作り直して、絵の中の動きを最初から再生する。 */}
            <div
              key={front ? "front" : "back"}
              className={`relative flex h-[164px] items-center justify-center overflow-hidden rounded-[20px] ${front ? "" : "slide-still"}`}
              style={{ backgroundColor: slide.tint }}
            >
              {slide.visual.kind === "flip" ? (
                <FlipVisual visual={slide.visual} />
              ) : slide.visual.kind === "voices" ? (
                <VoicesVisual visual={slide.visual} />
              ) : slide.visual.kind === "send" ? (
                <SendVisual visual={slide.visual} />
              ) : slide.visual.kind === "answer" ? (
                <AnswerVisual visual={slide.visual} />
              ) : slide.visual.kind === "quiz" ? (
                <QuizVisual visual={slide.visual} />
              ) : slide.visual.kind === "chat" ? (
                <ChatVisual visual={slide.visual} />
              ) : slide.visual.kind === "entry" ? (
                <EntryVisual visual={slide.visual} />
              ) : slide.visual.kind === "deliver" ? (
                <DeliverVisual visual={slide.visual} />
              ) : slide.visual.kind === "results" ? (
                <ResultsVisual visual={slide.visual} />
              ) : slide.visual.kind === "questions" ? (
                <QuestionsVisual visual={slide.visual} />
              ) : slide.visual.kind === "welcome" ? (
                <WelcomeVisual visual={slide.visual} />
              ) : slide.visual.kind === "upgradeResult" ? (
                <UpgradeResultVisual visual={slide.visual} />
              ) : slide.visual.kind === "upgradeButton" ? (
                <UpgradeButtonVisual visual={slide.visual} />
              ) : slide.visual.kind === "aliceQa" ? (
                <AliceQaVisual visual={slide.visual} />
              ) : slide.visual.kind === "upgrade" ? (
                <UpgradeVisual visual={slide.visual} />
              ) : (
                <GapVisual visual={slide.visual} />
              )}
            </div>
            {/* 2行の文は行間と上の余白を詰める (1行のときと同じ行間だと、文の上下と行の間が空きすぎる)。 */}
            <p
              className={`whitespace-pre-line text-center text-[18px] font-black ${slide.text.includes("\n") ? "mt-2.5 leading-[1.45]" : "mt-3.5 leading-[1.75]"}`}
              style={{ color: NAVY }}
            >
              <SlideText text={slide.text} highlight={slide.highlight} />
            </p>
          </div>
        );
      })}
    </div>
    </div>
  );
}
