"use client";

// 社内向け数値画面の、見た目の共通部品。色はここで一度だけ決め、各部品は役割名で参照する。
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import Link from "next/link";

import type { NumbersDelta } from "@/lib/internal-numbers";

// 文字は、太さを細かく選べる端末のフォントを先に使う (Mac・iPhone ではヒラギノ)。
// サイト共通の Noto Sans JP は太さが 2 種類しか無く、黒地では細い字になって読みにくい。
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif';

export type NumbersThemeName = "dark" | "light";

/**
 * 画面全体の色。文字・面・1 色のアクセント・増減の 2 色だけを使う。
 * 白地 (light) と黒地 (dark) を選べる。各部品は役割名 (--nb-*) で参照する。
 * 枠で囲まず余白と細い線で区切るので、面 (surface) は地 (bg) と同じ色。
 * surface-2 は、押せるものの下地や、なぞったときの色に使う。
 */
export const NUMBERS_THEMES: Record<NumbersThemeName, CSSProperties> = {
  dark: {
    "--nb-bg": "#0b0d10",
    "--nb-surface": "#0b0d10",
    "--nb-surface-2": "#171a1f",
    "--nb-thumb": "#2b3038",
    "--nb-border": "#1f2329",
    "--nb-border-strong": "#343a42",
    "--nb-text": "#f2f4f6",
    "--nb-text-2": "#aab3bd",
    "--nb-text-3": "#7e8892",
    "--nb-faint": "#4b535c",
    "--nb-accent": "#5b8cff",
    "--nb-compare": "#8b8b85",
    "--nb-up": "#2fc98f",
    "--nb-down": "#ff6b74",
    "--nb-header": "rgba(11, 13, 16, 0.82)",
    "--nb-shadow": "0 12px 36px rgba(0, 0, 0, 0.55)",
    colorScheme: "dark",
    fontFamily: FONT_FAMILY,
  } as CSSProperties,
  light: {
    "--nb-bg": "#ffffff",
    "--nb-surface": "#ffffff",
    "--nb-surface-2": "#f5f7f9",
    "--nb-thumb": "#ffffff",
    "--nb-border": "#eceff2",
    "--nb-border-strong": "#dde2e7",
    "--nb-text": "#0b0f14",
    "--nb-text-2": "#56606b",
    "--nb-text-3": "#8a94a0",
    "--nb-faint": "#c3cad2",
    "--nb-accent": "#2f6bff",
    "--nb-compare": "#9aa3ad",
    "--nb-up": "#0b7d54",
    "--nb-down": "#d1242f",
    "--nb-header": "rgba(255, 255, 255, 0.86)",
    "--nb-shadow": "0 12px 36px rgba(11, 15, 20, 0.12)",
    colorScheme: "light",
    fontFamily: FONT_FAMILY,
  } as CSSProperties,
};

/** 既定の配色 (黒地)。 */
export const NUMBERS_THEME = NUMBERS_THEMES.dark;

export const numberFormat = new Intl.NumberFormat("ja-JP");
export const yen = (value: number) =>
  `¥${numberFormat.format(Math.round(value))}`;
export const percent = (value: number | null, digits = 1) =>
  value === null ? "–" : `${(value * 100).toFixed(digits)}%`;

/** 画面いっぱいの本体。余白と文字の基本をここで決める (2 つのページで同じ)。 */
export const NUMBERS_MAIN =
  "min-h-dvh flex-1 touch-manipulation bg-[var(--nb-bg)] pb-16 text-[var(--nb-text)] antialiased data-[theme=dark]:font-medium";
/** ページの左右の余白。ヘッダーと本文でそろえる。 */
export const NUMBERS_GUTTER = "px-4 sm:px-8 2xl:px-11";

// ボタンの形。余白 (px) を後から上書きすると、Tailwind では書いた順に関係なく
// どちらが効くか決まらないので、余白なしの土台 (…_BASE) と、余白つきの完成形を分ける。
/** 文字だけの控えめなボタンの土台 (なぞると下地が出る)。余白は使う側で足す。 */
export const GHOST_BASE =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg text-sm text-[var(--nb-text-2)] transition-colors hover:bg-[var(--nb-surface-2)] hover:text-[var(--nb-text)] disabled:pointer-events-none disabled:opacity-40";
export const GHOST_BUTTON = `${GHOST_BASE} px-3`;
/** 細い枠のボタンの土台。余白は使う側で足す。 */
export const OUTLINE_BASE =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--nb-border-strong)] text-sm font-semibold text-[var(--nb-text)] transition-colors hover:bg-[var(--nb-surface-2)] disabled:pointer-events-none";
export const OUTLINE_BUTTON = `${OUTLINE_BASE} px-3.5 disabled:opacity-40`;

/**
 * 1 つのまとまり。枠では囲まず、見出しとその下の細い線、前後の余白で区切る。
 * plain は見出しの下の線を引かない (すぐ下に表の見出し行が来るとき)。
 */
export function Section({
  title,
  hint,
  note,
  action,
  plain = false,
  className = "",
  children,
}: {
  title?: string;
  hint?: string;
  /** 見出しの横に小さく添える補足。 */
  note?: ReactNode;
  action?: ReactNode;
  plain?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col ${className}`}>
      {title && (
        <header
          className={`flex min-h-9 flex-wrap items-center gap-x-3.5 gap-y-1.5 ${
            plain ? "pb-1" : "border-b border-[var(--nb-border)] pb-3"
          }`}
        >
          <h2 className="flex min-w-0 items-center gap-2 text-[17px] font-bold leading-tight tracking-[0.01em] text-[var(--nb-text)]">
            {title}
            {hint && <InfoTip text={hint} />}
          </h2>
          {note && (
            <div className="min-w-0 text-[13px] leading-snug text-[var(--nb-text-3)]">
              {note}
            </div>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * 見出しの横の小さな「i」。説明は常に出さず、指を置いたとき・押したときだけ出す
 * (説明文が画面中に並ぶと、数字より文字が目に入るため)。
 */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[var(--nb-surface-2)] text-[11px] font-semibold leading-none text-[var(--nb-text-3)] transition-colors hover:text-[var(--nb-text)] focus:text-[var(--nb-text)]"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-7 z-20 hidden w-max max-w-[18rem] -translate-x-1/2 rounded-lg bg-[var(--nb-text)] px-3 py-2 text-[13px] font-normal leading-snug tracking-normal text-[var(--nb-bg)] group-focus-within/tip:block group-hover/tip:block"
      >
        {text}
      </span>
    </span>
  );
}

/** 増減の色。 */
export function deltaColor(delta: NumbersDelta): string {
  return delta.direction === "up"
    ? "var(--nb-up)"
    : delta.direction === "down"
      ? "var(--nb-down)"
      : "var(--nb-text-2)";
}

/** 増減。符号つきの数字を色で出す (塗りつぶしの札にはしない)。 */
export function DeltaBadge({
  delta,
  size = "md",
}: {
  delta: NumbersDelta | null;
  size?: "sm" | "md";
}) {
  if (!delta) return null;
  return (
    <span
      className={`whitespace-nowrap font-semibold tabular-nums ${size === "sm" ? "text-[13px]" : "text-sm"}`}
      style={{ color: deltaColor(delta) }}
    >
      <span className="sr-only">
        {delta.direction === "up"
          ? "増加 "
          : delta.direction === "down"
            ? "減少 "
            : "変わらず "}
      </span>
      {signed(delta)}
    </span>
  );
}

/** "37.3%" → "+37.3%"、減少は "−3.3%" (表示の文字は、向きに合わせて符号を付ける)。 */
function signed(delta: NumbersDelta): string {
  const text = delta.text.replace(/^[+\-−]/, "");
  if (delta.direction === "up") return `+${text}`;
  if (delta.direction === "down") return `−${text}`;
  return text;
}

/**
 * 増減を、塗りつぶし無しの文字で出す。表や一覧のように数が並ぶ場所で使う
 * (塗りつぶしのバッジが並ぶと、肝心の数字より目立ってしまうため)。
 */
export function DeltaText({ delta }: { delta: NumbersDelta | null }) {
  if (!delta) return <span className="text-[var(--nb-text-3)]">–</span>;
  return <DeltaBadge delta={delta} size="sm" />;
}

/** 2 択・3 択の切り替え。薄い下地の上で、選んでいるものだけ白く浮かせる。 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-[10px] bg-[var(--nb-surface-2)] p-[3px]"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`h-7 whitespace-nowrap rounded-[7px] px-3 text-[13px] transition-colors ${
            option.value === value
              ? "bg-[var(--nb-thumb)] font-semibold text-[var(--nb-text)] shadow-[0_0_0_1px_var(--nb-border-strong),0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 表の数字の左に添える、長さで量を見せる短い棒。数字は右端でそろえる。
 * 表が横に収まらなくなる狭い画面では、棒を出さない。
 */
export function MiniBar({
  share,
  children,
}: {
  share: number;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center justify-end gap-2.5">
      <span
        aria-hidden
        className="hidden h-1.5 rounded-full bg-[var(--nb-accent)] opacity-25 min-[1340px]:block"
        style={{ width: `${Math.max(0, Math.min(1, share)) * 2.5}rem` }}
      />
      <span className="min-w-[3.2em]">{children}</span>
    </span>
  );
}

/**
 * 数字が変わったとき、前の値から新しい値まで短く数え上げる。
 * 「動きを減らす」設定の端末では、数え上げずにすぐ切り替える。
 */
export function AnimatedNumber({
  value,
  format,
}: {
  value: number | null;
  format: (value: number | null) => string;
}) {
  const [shown, setShown] = useState<number | null>(value);
  const shownRef = useRef<number | null>(value);

  useEffect(() => {
    const from = shownRef.current;
    const apply = (next: number | null) => {
      shownRef.current = next;
      setShown(next);
    };
    const instant =
      value === null ||
      from === null ||
      from === value ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    const DURATION_MS = 550;
    let frame = window.requestAnimationFrame(function step(now) {
      if (instant) return apply(value);
      const t = Math.min(1, (now - started) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      apply(t >= 1 ? value : from + (value - from) * eased);
      if (t < 1) frame = window.requestAnimationFrame(step);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{format(shown)}</>;
}

/** 割合を輪の長さで見せる。中の文字は呼び出し側が置く。 */
export function RingGauge({
  share,
  size = 76,
  children,
}: {
  share: number | null;
  size?: number;
  children?: ReactNode;
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, share ?? 0)) * circumference;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg aria-hidden width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--nb-surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--nb-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 500ms ease-out" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {children}
      </span>
    </span>
  );
}

/** ヘッダーに置く、小さな四角いボタンの形 (枠は無く、なぞると下地が出る)。 */
export const NAV_BUTTON =
  "h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--nb-text-2)] transition-colors hover:bg-[var(--nb-surface-2)] hover:text-[var(--nb-text)] disabled:pointer-events-none disabled:opacity-30";

/**
 * 配色の切り替え。icon はヘッダー用 (PC)、wide はページのいちばん下に置く横長のボタン
 * (スマホではヘッダーに収まらないため)。
 */
export function ThemeToggle({
  theme,
  onToggle,
  variant,
}: {
  theme: NumbersThemeName;
  onToggle: () => void;
  variant: "icon" | "wide";
}) {
  if (variant === "wide") {
    return (
      <div className="px-4 pt-10 sm:hidden">
        <button
          type="button"
          onClick={onToggle}
          className="h-11 w-full rounded-lg border border-[var(--nb-border-strong)] text-sm font-semibold text-[var(--nb-text)]"
        >
          {theme === "dark" ? "明るい配色にする" : "暗い配色にする"}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        theme === "dark" ? "明るい配色に切り替える" : "暗い配色に切り替える"
      }
      title={theme === "dark" ? "明るい配色にする" : "暗い配色にする"}
      className={`hidden sm:flex ${NAV_BUTTON}`}
    >
      <svg
        aria-hidden
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
          </>
        ) : (
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
        )}
      </svg>
    </button>
  );
}

/** 「1日の数字」と「月の推移」の行き来。選んでいるほうに下線を引く。 */
export function NumbersNav({ current }: { current: "day" | "month" }) {
  const items = [
    { key: "day", label: "1日の数字", href: "/internal/numbers" },
    { key: "month", label: "月の推移", href: "/internal/numbers/daily" },
  ] as const;
  return (
    <nav aria-label="数値の見方" className="flex items-stretch gap-6">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? "page" : undefined}
          className={`-mb-px flex items-center whitespace-nowrap border-b-2 py-2.5 text-[15px] transition-colors ${
            item.key === current
              ? "border-[var(--nb-text)] font-semibold text-[var(--nb-text)]"
              : "border-transparent text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * 日付を選ぶボタン。見た目は文字だけにして、上に透明な日付入力を重ねる
 * (端末ごとに形が違う入力欄を、そのまま見せないため)。押すと端末の日付選びが開く。
 */
export function DateButton({
  label,
  ariaLabel,
  value,
  min,
  max,
  onPick,
  className = "",
}: {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  min?: string;
  max?: string;
  onPick: (day: string) => void;
  className?: string;
}) {
  return (
    <label
      className={`relative inline-flex cursor-pointer items-center whitespace-nowrap focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--nb-accent)] ${className}`}
    >
      <span aria-hidden>{label}</span>
      <input
        type="date"
        aria-label={ariaLabel}
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          if (event.target.value) onPick(event.target.value);
        }}
        onClick={(event) => {
          // PC では入力欄を押しただけでは開かないので、こちらから開く。
          try {
            event.currentTarget.showPicker?.();
          } catch {
            // 開けない端末では、入力欄にそのまま打ち込める。
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}

const CHEVRON_LEFT = "M10 3 5 8l5 5";
const CHEVRON_RIGHT = "m6 3 5 5-5 5";

/** 前へ・次へ。日付や月を 1 つ送るボタン。 */
export function StepButton({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex ${NAV_BUTTON}`}
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d={direction === "previous" ? CHEVRON_LEFT : CHEVRON_RIGHT}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * 画面の上に固定するヘッダー。左に見出しとページの行き来、右に日付などの操作 (children)・
 * 配色の切り替え・更新。地は少し透かして、下の内容がぼけて見えるようにする。
 * スマホでは行き来のタブが入りきらないので、ヘッダーのすぐ下に置く (固定しない)。
 */
export function NumbersHeader({
  current,
  status,
  children,
  theme,
  onToggleTheme,
  onRefresh,
  busy,
}: {
  current: "day" | "month";
  /** 見出しの横 (スマホでは下) に出す、いつの数字かの表示。 */
  status?: ReactNode;
  children: ReactNode;
  theme: NumbersThemeName;
  onToggleTheme: () => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--nb-border)] bg-[var(--nb-header)] backdrop-blur-xl backdrop-saturate-150">
        <div
          className={`flex items-center gap-x-1.5 py-2 sm:h-[58px] sm:gap-x-2 sm:py-0 ${NUMBERS_GUTTER}`}
        >
          <div className="mr-auto flex min-w-0 flex-col gap-0.5 sm:flex-1 sm:flex-row sm:items-stretch sm:gap-7 sm:self-stretch">
            <h1 className="flex items-center text-base font-bold leading-tight tracking-[0.02em]">
              数値
            </h1>
            <div className="hidden sm:flex">
              <NumbersNav current={current} />
            </div>
            {status && (
              <div className="flex min-w-0 items-center sm:ml-auto sm:pr-2">
                {status}
              </div>
            )}
          </div>
          {children}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} variant="icon" />
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            aria-busy={busy}
            className={`${OUTLINE_BASE} ml-1 w-9 shrink-0 sm:w-auto sm:px-3.5`}
          >
            <svg
              aria-hidden
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              className={`shrink-0 ${busy ? "animate-spin" : ""}`}
            >
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {/* スマホでは日付の操作と 1 行に収めるため、文字は読み上げ用にだけ残す。 */}
            <span className="sr-only sm:not-sr-only">
              {busy ? "更新中..." : "更新"}
            </span>
          </button>
        </div>
      </header>
      <div className="border-b border-[var(--nb-border)] px-4 sm:hidden">
        <NumbersNav current={current} />
      </div>
    </>
  );
}
