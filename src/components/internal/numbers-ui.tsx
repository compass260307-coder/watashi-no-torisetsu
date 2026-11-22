// 社内向け数値画面の、見た目の共通部品。色はここで一度だけ決め、各部品は役割名で参照する。
import type { CSSProperties, ReactNode } from "react";

import type { NumbersDelta } from "@/lib/internal-numbers";

/** 画面全体の色。黒地に、白の文字・1 色のアクセント・増減の 2 色だけを使う。 */
export const NUMBERS_THEME = {
  "--nb-bg": "#000000",
  "--nb-surface": "#0b0c0e",
  "--nb-surface-2": "#121417",
  "--nb-border": "#1c1f23",
  "--nb-border-strong": "#2f3336",
  "--nb-text": "#e7e9ea",
  "--nb-text-2": "#8b98a5",
  "--nb-text-3": "#5c6670",
  "--nb-accent": "#1d9bf0",
  "--nb-compare": "#8b8b85",
  "--nb-up": "#00ba7c",
  "--nb-down": "#f4212e",
  colorScheme: "dark",
} as CSSProperties;

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
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 pt-4 sm:px-5">
          <div className="mr-auto min-w-0">
            <h2 className="text-sm font-bold text-[var(--nb-text)]">{title}</h2>
            {hint && (
              <p className="mt-0.5 text-xs text-[var(--nb-text-2)]">{hint}</p>
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
        size === "sm" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs"
      }`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <span aria-hidden className="text-[0.7em] leading-none">
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
          className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
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
