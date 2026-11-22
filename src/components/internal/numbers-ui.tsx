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
 * 黒地 (dark) と白地 (light) を選べる。各部品は役割名 (--nb-*) で参照する。
 */
export const NUMBERS_THEMES: Record<NumbersThemeName, CSSProperties> = {
  dark: {
    "--nb-bg": "#050607",
    "--nb-surface": "#121416",
    "--nb-surface-2": "#1c1f23",
    "--nb-border": "#262a2f",
    "--nb-border-strong": "#3d444b",
    "--nb-text": "#f4f6f7",
    "--nb-text-2": "#b8c1ca",
    "--nb-text-3": "#8b95a0",
    "--nb-accent": "#1d9bf0",
    "--nb-compare": "#8b8b85",
    "--nb-up": "#00c283",
    "--nb-down": "#ff5560",
    colorScheme: "dark",
    fontFamily: FONT_FAMILY,
  } as CSSProperties,
  light: {
    "--nb-bg": "#f2f4f6",
    "--nb-surface": "#ffffff",
    "--nb-surface-2": "#eef1f4",
    "--nb-border": "#e0e4e9",
    "--nb-border-strong": "#c3cad2",
    "--nb-text": "#0f1419",
    "--nb-text-2": "#45505b",
    "--nb-text-3": "#687480",
    "--nb-accent": "#1883d0",
    "--nb-compare": "#7a838c",
    "--nb-up": "#00845a",
    "--nb-down": "#d42a36",
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

export function Card({
  title,
  hint,
  action,
  className = "",
  children,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--nb-border)] bg-[var(--nb-surface)] ${className}`}
    >
      {title && (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-4 pt-5 sm:px-6">
          <div className="mr-auto min-w-0">
            <h2 className="text-lg font-bold leading-tight text-[var(--nb-text)]">
              {title}
            </h2>
            {hint && (
              <p className="mt-1 text-sm text-[var(--nb-text-2)]">{hint}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** 増減。色だけに頼らず、向きの記号も付ける。 */
export function DeltaBadge({
  delta,
  size = "md",
}: {
  delta: NumbersDelta | null;
  size?: "sm" | "md";
}) {
  if (!delta) return null;
  const color =
    delta.direction === "up"
      ? "var(--nb-up)"
      : delta.direction === "down"
        ? "var(--nb-down)"
        : "var(--nb-text-2)";
  const label =
    delta.direction === "up"
      ? "増加"
      : delta.direction === "down"
        ? "減少"
        : "変わらず";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold tabular-nums ${
        size === "sm" ? "px-1.5 py-px text-[13px]" : "px-2 py-0.5 text-sm"
      }`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <span aria-hidden className="text-[0.75em] leading-none">
        {delta.direction === "up"
          ? "▲"
          : delta.direction === "down"
            ? "▼"
            : "■"}
      </span>
      <span className="sr-only">{label}</span>
      {delta.text}
    </span>
  );
}

/**
 * 増減を、塗りつぶし無しの文字で出す。表や一覧のように数が並ぶ場所で使う
 * (塗りつぶしのバッジが並ぶと、肝心の数字より目立ってしまうため)。
 */
export function DeltaText({ delta }: { delta: NumbersDelta | null }) {
  if (!delta) return <span className="text-[var(--nb-text-3)]">–</span>;
  const color =
    delta.direction === "up"
      ? "var(--nb-up)"
      : delta.direction === "down"
        ? "var(--nb-down)"
        : "var(--nb-text-2)";
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap font-bold tabular-nums"
      style={{ color }}
    >
      <span aria-hidden className="text-[0.7em] leading-none">
        {delta.direction === "up"
          ? "▲"
          : delta.direction === "down"
            ? "▼"
            : "■"}
      </span>
      <span className="sr-only">
        {delta.direction === "up"
          ? "増加"
          : delta.direction === "down"
            ? "減少"
            : "変わらず"}
      </span>
      {delta.text}
    </span>
  );
}

/** 2 択・3 択の切り替え。 */
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
      className="inline-flex rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1 text-sm font-bold transition-colors ${
            option.value === value
              ? "bg-[var(--nb-surface-2)] text-[var(--nb-text)] shadow-[inset_0_0_0_1px_var(--nb-border-strong)]"
              : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** 表のセルの背景に引く、長さで量を見せる棒。 */
export function DataBar({
  share,
  children,
}: {
  share: number;
  children: ReactNode;
}) {
  return (
    <span className="relative block">
      <span
        aria-hidden
        className="absolute inset-y-[-3px] right-[-6px] rounded-[3px] bg-[var(--nb-accent)] opacity-[0.16]"
        style={{
          width: `calc(${Math.max(0, Math.min(1, share)) * 100}% + 6px)`,
        }}
      />
      <span className="relative">{children}</span>
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

/** ヘッダーに置く、四角い小さなボタンの形。 */
export const NAV_BUTTON =
  "h-9 w-9 items-center justify-center rounded-lg border border-[var(--nb-border)] text-[var(--nb-text)] transition-colors hover:border-[var(--nb-border-strong)] hover:bg-[var(--nb-surface-2)] disabled:pointer-events-none disabled:opacity-30";

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
      <div className="px-4 pt-6 sm:hidden">
        <button
          type="button"
          onClick={onToggle}
          className="h-11 w-full rounded-xl border border-[var(--nb-border-strong)] text-sm font-bold text-[var(--nb-text)]"
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

/** 「1日の数字」と「月の推移」の行き来。 */
export function NumbersNav({ current }: { current: "day" | "month" }) {
  const items = [
    { key: "day", label: "1日の数字", href: "/internal/numbers" },
    { key: "month", label: "月の推移", href: "/internal/numbers/daily" },
  ] as const;
  return (
    <nav
      aria-label="数値の見方"
      className="inline-flex rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] p-0.5"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? "page" : undefined}
          className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors ${
            item.key === current
              ? "bg-[var(--nb-surface-2)] text-[var(--nb-text)] shadow-[inset_0_0_0_1px_var(--nb-border-strong)]"
              : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
