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
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import type { AnalyzingSlide } from "@/i18n/diagnosis";

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
  slidesLabel,
  fontFamily = FONT_STACK,
}: {
  messages?: string[];
  steps?: string[];
  // messages[i] の表示時間 (ms)。省略時や不足分は一律 DEFAULT_MESSAGE_DURATION_MS。
  messageDurationsMs?: number[];
  // 画面全体の想定表示時間 (ms)。進捗バーとチェックリストの進行に使う。
  totalMs?: number;
  // 指定時はマスコットの代わりに紹介スライドを流す (totalMs を枚数で等分)。
  slides?: AnalyzingSlide[];
  // 各スライド左上の見出し (後ろに ①②③ が付く)。
  slidesLabel?: string;
  fontFamily?: string;
} = {}) {
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
    const stepInterval = setInterval(() => {
      setCompletedSteps((prev) => Math.min(prev + 1, stepCount));
    }, totalMs / Math.max(stepCount, 1));
    return () => clearInterval(stepInterval);
  }, [stepCount, totalMs]);

  const slideCount = slides?.length ?? 0;
  const slideDurationMs = slideCount > 0 ? totalMs / slideCount : 0;
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
      className="flex min-h-screen flex-1 flex-col items-center justify-center overflow-x-hidden bg-[#FCFCFC] px-5 py-10"
      style={{ fontFamily }}
    >
      {/* 動画と poster の両方がアルファ付き。元の表示サイズと余白を維持する。 */}
      {slides ? (
        <AnalyzingSlideDeck slides={slides} index={slideIndex} label={slidesLabel} />
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

      {/* Progress bar (淡ブルートラック + Sora ブルー塗り) */}
      <div
        className="mb-6 h-1.5 w-72 max-w-full overflow-hidden rounded-full"
        style={{ backgroundColor: TRACK }}
        aria-hidden
      >
        <div
          className="animate-progress-20s h-full rounded-full"
          style={{ backgroundColor: SORA, animationDuration: `${totalMs}ms` }}
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
      className="mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-black leading-none text-white"
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

// ④ 分かること: 自己診断 vs 友達の目 のギャップ図 (/tako の「自分とのギャップ」の簡略版)。
// 「友達」の印が「自分」の位置から動いて差が開き、最後にスタンプが出る。
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
  // マウント直後は「友達 = 自分」の位置。次のフレームで本来の位置へ動かす。
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpened(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  // 白い台紙そのものを帯の上下中央に置く (余白は台紙基準で揃える)。
  // スタンプは台紙の右上に重ねるが、台紙を小さくしてあるので帯からはみ出さない。
  return (
    <div className="relative">
      <Pop className="flex w-[236px] max-w-full flex-col gap-2.5 rounded-2xl bg-white px-4 pb-3.5 pt-3 shadow-[0_3px_12px_rgba(46,46,92,0.08)]">
        <div className="flex items-center justify-end gap-3 text-[11px] font-bold" style={{ color: NAVY }}>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rotate-45" style={{ backgroundColor: NAVY }} />
            {visual.selfLabel ?? "自分"}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: SORA }} />
            {visual.friendLabel ?? "友達"}
          </span>
        </div>
        {GAP_ROWS.map((row, i) => {
          const friend = opened ? row.friend : row.self;
          const transition = `all 900ms cubic-bezier(0.34, 1.4, 0.64, 1) ${700 + i * 200}ms`;
          return (
            <div key={row.label} className="flex items-center gap-2.5">
              <span className="w-10 shrink-0 text-left text-[11px] font-bold" style={{ color: NAVY }}>
                {visual.rowLabels?.[i] ?? row.label}
              </span>
              <div className="relative h-2.5 flex-1 rounded-full" style={{ backgroundColor: `${row.color}2E` }}>
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    backgroundColor: row.color,
                    left: `${Math.min(row.self, friend)}%`,
                    width: `${Math.abs(friend - row.self)}%`,
                    transition,
                  }}
                />
                <span
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white"
                  style={{ left: `${friend}%`, borderColor: row.color, transition }}
                />
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45"
                  style={{ left: `${row.self}%`, backgroundColor: NAVY }}
                />
              </div>
            </div>
          );
        })}
      </Pop>
      <div className="absolute -right-3 -top-3.5">
        <Stamp label={visual.badge} delay={2100} />
      </div>
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
  if (v.kind === "send") return [v.selfFace, v.friendFace];
  if (v.kind === "answer") return [v.friendFace];
  return [];
}

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤"];
// カード1枚の基準寸法 (px)。中の絵はこの寸法を前提に座標で配置している。
const DECK_WIDTH = 340;
const DECK_HEIGHT = 270;

// 紹介スライド。1枚 = 白いカード1枚。3枚が輪になって回る。
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
      style={{ height: DECK_HEIGHT * scale }}
    >
    <div
      className="relative h-[270px] w-[340px] origin-top-left"
      style={{ perspective: "800px", transform: `scale(${scale})` }}
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
            {label ? (
              <p className="mb-3.5 px-1.5 pt-0.5 text-[15px] font-black leading-none" style={{ color: NAVY }}>
                {label}
                {CIRCLED_NUMBERS[i] ?? ""}
              </p>
            ) : null}
            {/* 正面に来るたびに作り直して、絵の中の動きを最初から再生する。 */}
            <div
              key={front ? "front" : "back"}
              className={`relative flex h-[164px] items-center justify-center overflow-hidden rounded-[20px] ${front ? "" : "slide-still"}`}
              style={{ backgroundColor: slide.tint }}
            >
              {slide.visual.kind === "voices" ? (
                <VoicesVisual visual={slide.visual} />
              ) : slide.visual.kind === "send" ? (
                <SendVisual visual={slide.visual} />
              ) : slide.visual.kind === "answer" ? (
                <AnswerVisual visual={slide.visual} />
              ) : (
                <GapVisual visual={slide.visual} />
              )}
            </div>
            <p
              className="mt-3.5 whitespace-pre-line text-center text-[18px] font-black leading-[1.75]"
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
