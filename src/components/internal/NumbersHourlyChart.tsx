"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  formatNumbersValue,
  headlineSeries,
  numbersDelta,
  type HeadlineDefinition,
  type HeadlineSeriesMode,
  type NumbersHour,
} from "@/lib/internal-numbers";

import { DeltaBadge } from "./numbers-ui";

// 表示日はアクセント色 (時間別は棒、累計は線と面)、比較日は細い灰色の線。
// 2 系列は形と凡例でも見分けられる。色は numbers-ui の NUMBERS_THEME を参照する。
const ACCENT = "var(--nb-accent)";
const COMPARE = "var(--nb-compare)";

/** 目盛りの上限を、4 等分してもきりのよい数に切り上げる (上に余白が空きすぎないよう細かく刻む)。 */
const NICE_STEPS = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10];
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = NICE_STEPS.find((candidate) => scaled <= candidate + 1e-9) ?? 10;
  return step * magnitude;
}

function axisLabel(value: number, kind: HeadlineDefinition["kind"]): string {
  if (kind === "rate") {
    const pct = value * 100;
    return `${pct.toFixed(pct < 1 && pct > 0 ? 2 : pct < 10 ? 1 : 0)}%`;
  }
  if (kind === "yen_decimal") return `¥${value.toFixed(value < 10 ? 1 : 0)}`;
  const text =
    value >= 10000
      ? `${Number((value / 10000).toFixed(1))}万`
      : new Intl.NumberFormat("ja-JP").format(value);
  return kind === "yen" ? `¥${text}` : text;
}

/** 要素の実際の幅。SVG を縮めずに実寸で描くために使う (全画面でも文字の大きさが変わらない)。 */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface Props {
  metric: HeadlineDefinition;
  mode: HeadlineSeriesMode;
  hours: NumbersHour[];
  compareHours: NumbersHour[];
  dayLabel: string;
  compareLabel: string;
  /** 途中の時間帯 (今日の現在の時)。それより先の時間帯は描かない。過去日は null。 */
  currentHour: number | null;
  /** 0 時からの経過時間 (時間単位、小数)。「現在」の位置。過去日は null。 */
  nowHours: number | null;
}

export function NumbersHourlyChart({
  metric,
  mode,
  hours,
  compareHours,
  dayLabel,
  compareLabel,
  currentHour,
  nowHours,
}: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();

  const narrow = width > 0 && width < 560;
  const height = narrow ? 230 : 340;
  const pad = {
    top: 22,
    right: narrow ? 6 : 16,
    bottom: 30,
    left: narrow ? 40 : 54,
  };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / 24;
  const barW = Math.max(3, Math.min(30, slot * 0.58));
  const bottom = pad.top + plotH;

  const lastHour = currentHour ?? 23;
  const values = headlineSeries(metric, hours, mode, lastHour);
  const compareValues = headlineSeries(metric, compareHours, mode, 23);
  const max = niceCeil(
    Math.max(
      0,
      ...values.map((v) => v ?? 0),
      ...compareValues.map((v) => v ?? 0),
    ),
  );
  const y = (value: number) => bottom - (value / max) * plotH;
  const cumulative = mode === "cumulative";
  // 時間別は時間帯の真ん中、累計は時間帯の終わり (途中の時間帯は現在の位置) に点を打つ。
  const x = (h: number, forDay: boolean) => {
    if (!cumulative) return pad.left + slot * (h + 0.5);
    const end =
      forDay && h === currentHour && nowHours !== null ? nowHours : h + 1;
    return pad.left + slot * end;
  };

  const linePoints = (series: (number | null)[], forDay: boolean) => {
    const segments: string[][] = [];
    let current: string[] = [];
    // 件数や金額の累計は 0 時の 0 から始める。率は始点を持たない。
    if (cumulative && !metric.denominator && series[0] !== null) {
      current.push(`${pad.left.toFixed(1)},${bottom.toFixed(1)}`);
    }
    series.forEach((value, h) => {
      if (value === null) {
        if (current.length) segments.push(current);
        current = [];
        return;
      }
      current.push(`${x(h, forDay).toFixed(1)},${y(value).toFixed(1)}`);
    });
    if (current.length) segments.push(current);
    return segments;
  };

  const compareSegments = linePoints(compareValues, false);
  const daySegments = cumulative ? linePoints(values, true) : [];
  const lastIndex = values.reduce<number | null>(
    (found, value, h) => (value !== null ? h : found),
    null,
  );
  const hasData =
    values.some((v) => v !== null && v > 0) ||
    compareValues.some((v) => v !== null && v > 0);

  const activeValue = active === null ? null : values[active];
  const activeCompare = active === null ? null : compareValues[active];
  const activeX = active === null ? 0 : x(active, true);
  const hourLabels = narrow ? [0, 6, 12, 18] : [0, 3, 6, 9, 12, 15, 18, 21];
  const pick = (clientX: number, target: SVGElement) => {
    const box = target.getBoundingClientRect();
    const h = Math.floor((clientX - box.left) / (box.width / 24));
    setActive(Math.max(0, Math.min(23, h)));
  };

  return (
    <div className="relative">
      <div className="mb-1 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-[var(--nb-text-2)]">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={
              cumulative
                ? "inline-block h-0.5 w-4 rounded-full"
                : "inline-block h-2.5 w-2.5 rounded-[3px]"
            }
            style={{ background: ACCENT }}
          />
          {dayLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ background: COMPARE }}
          />
          {compareLabel}
        </span>
      </div>

      <div ref={ref} style={{ height }} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${metric.label}の${cumulative ? "累計" : "時間別"}グラフ。${dayLabel}と${compareLabel}の比較。数値は「時間別」の表にあります。`}
            className="block select-none"
          >
            <defs>
              <linearGradient
                id={`${gradientId}-bar`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor={ACCENT} stopOpacity="1" />
                <stop offset="1" stopColor={ACCENT} stopOpacity="0.55" />
              </linearGradient>
              <linearGradient
                id={`${gradientId}-area`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor={ACCENT} stopOpacity="0.28" />
                <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(max * t)}
                  y2={y(max * t)}
                  stroke="var(--nb-border)"
                  strokeWidth={1}
                />
                {(t === 0 || t === 0.5 || t === 1 || !narrow) && (
                  <text
                    x={pad.left - 8}
                    y={y(max * t) + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill="var(--nb-text-2)"
                  >
                    {axisLabel(max * t, metric.kind)}
                  </text>
                )}
              </g>
            ))}

            {active !== null &&
              (cumulative ? (
                <line
                  x1={activeX}
                  x2={activeX}
                  y1={pad.top}
                  y2={bottom}
                  stroke="var(--nb-border-strong)"
                  strokeWidth={1}
                />
              ) : (
                <rect
                  x={pad.left + slot * active}
                  y={pad.top}
                  width={slot}
                  height={plotH}
                  fill="var(--nb-text)"
                  opacity={0.05}
                />
              ))}

            {!cumulative &&
              values.map((value, h) => {
                if (value === null || value <= 0) return null;
                const top = y(value);
                const radius = Math.min(4, bottom - top, barW / 2);
                const left = x(h, true) - barW / 2;
                return (
                  <path
                    key={h}
                    d={`M${left},${bottom} V${top + radius} Q${left},${top} ${left + radius},${top} H${left + barW - radius} Q${left + barW},${top} ${left + barW},${top + radius} V${bottom} Z`}
                    fill={`url(#${gradientId}-bar)`}
                    // 途中の時間帯は薄くして、まだ増える数字だと分かるようにする。
                    opacity={
                      h === currentHour
                        ? 0.45
                        : active === null || active === h
                          ? 1
                          : 0.55
                    }
                  />
                );
              })}

            {compareSegments.map((points, index) => (
              <polyline
                key={index}
                points={points.join(" ")}
                fill="none"
                stroke={COMPARE}
                strokeWidth={1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {daySegments.map((points, index) => (
              <g key={index}>
                <polygon
                  points={`${points[0].split(",")[0]},${bottom} ${points.join(" ")} ${points[points.length - 1].split(",")[0]},${bottom}`}
                  fill={`url(#${gradientId}-area)`}
                />
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            ))}

            {/* 今の位置。今日の表示のときだけ。 */}
            {nowHours !== null && (
              <g>
                <line
                  x1={pad.left + slot * nowHours}
                  x2={pad.left + slot * nowHours}
                  y1={pad.top - 4}
                  y2={bottom}
                  stroke="var(--nb-text-2)"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  opacity={0.7}
                />
                <text
                  x={pad.left + slot * nowHours}
                  y={pad.top - 9}
                  textAnchor={
                    nowHours > 21 ? "end" : nowHours < 2 ? "start" : "middle"
                  }
                  fontSize={10}
                  fill="var(--nb-text-2)"
                >
                  現在
                </text>
              </g>
            )}

            {cumulative && lastIndex !== null && values[lastIndex] !== null && (
              <g>
                <circle
                  cx={x(lastIndex, true)}
                  cy={y(values[lastIndex] ?? 0)}
                  r={9}
                  fill={ACCENT}
                  opacity={0.22}
                />
                <circle
                  cx={x(lastIndex, true)}
                  cy={y(values[lastIndex] ?? 0)}
                  r={4}
                  fill={ACCENT}
                  stroke="var(--nb-surface)"
                  strokeWidth={2}
                />
              </g>
            )}

            {active !== null && activeCompare !== null && (
              <circle
                cx={x(active, false)}
                cy={y(activeCompare)}
                r={4}
                fill={COMPARE}
                stroke="var(--nb-surface)"
                strokeWidth={2}
              />
            )}
            {cumulative && active !== null && activeValue !== null && (
              <circle
                cx={activeX}
                cy={y(activeValue)}
                r={4}
                fill={ACCENT}
                stroke="var(--nb-surface)"
                strokeWidth={2}
              />
            )}

            {hourLabels.map((h) => (
              <text
                key={h}
                x={pad.left + slot * (cumulative ? h : h + 0.5)}
                y={height - 9}
                textAnchor={cumulative && h === 0 ? "start" : "middle"}
                fontSize={11}
                fill="var(--nb-text-2)"
              >
                {h}時
              </text>
            ))}

            {/* 当たり判定は描画領域いっぱいに取り、指やマウスの位置から時間帯を決める。 */}
            <rect
              x={pad.left}
              y={pad.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              style={{ touchAction: "pan-y" }}
              onPointerMove={(event) =>
                pick(event.clientX, event.currentTarget)
              }
              onPointerDown={(event) =>
                pick(event.clientX, event.currentTarget)
              }
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setActive(null);
              }}
            />
          </svg>
        )}

        {width > 0 && !hasData && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--nb-text-2)]">
            この日のデータはまだありません
          </p>
        )}

        {active !== null && width > 0 && (
          <div
            role="status"
            className="pointer-events-none absolute top-3 z-10 min-w-[11rem] rounded-xl border border-[var(--nb-border-strong)] bg-[var(--nb-surface-2)] px-3 py-2.5 text-xs shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
            style={
              active < 12
                ? {
                    left: Math.min(
                      width - 190,
                      pad.left + slot * (active + 1) + 8,
                    ),
                  }
                : {
                    right: Math.min(
                      width - 190,
                      width - (pad.left + slot * active) + 8,
                    ),
                  }
            }
          >
            <p className="mb-1.5 flex items-center justify-between gap-3 text-[var(--nb-text-2)]">
              <span>
                {cumulative ? `${active}時台までの累計` : `${active}時台`}
                {active === currentHour ? "（途中）" : ""}
              </span>
              {active <= lastHour && (
                <DeltaBadge
                  delta={numbersDelta(activeValue, activeCompare, metric.kind)}
                  size="sm"
                />
              )}
            </p>
            <p className="flex items-center justify-between gap-4 text-[var(--nb-text)]">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: ACCENT }}
                />
                {dayLabel}
              </span>
              <span className="text-sm font-bold tabular-nums">
                {active > lastHour
                  ? "–"
                  : formatNumbersValue(activeValue, metric.kind)}
              </span>
            </p>
            <p className="mt-0.5 flex items-center justify-between gap-4 text-[var(--nb-text-2)]">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-0.5 w-2 rounded-full"
                  style={{ background: COMPARE }}
                />
                {compareLabel}
              </span>
              <span className="tabular-nums">
                {formatNumbersValue(activeCompare, metric.kind)}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** 指標カードの中に置く、軸のない小さな線グラフ (累計の推移)。 */
export function NumbersSparkline({
  metric,
  hours,
  compareHours,
  currentHour,
  nowHours,
}: Pick<
  Props,
  "metric" | "hours" | "compareHours" | "currentHour" | "nowHours"
>) {
  const lastHour = currentHour ?? 23;
  const values = headlineSeries(metric, hours, "cumulative", lastHour);
  const compareValues = headlineSeries(metric, compareHours, "cumulative", 23);
  const max = Math.max(
    1e-9,
    ...values.map((v) => v ?? 0),
    ...compareValues.map((v) => v ?? 0),
  );
  const W = 100;
  const H = 30;
  const path = (series: (number | null)[], forDay: boolean) => {
    const points: string[] = [];
    if (!metric.denominator && series[0] !== null) points.push(`0,${H}`);
    series.forEach((value, h) => {
      if (value === null) return;
      const end =
        forDay && h === currentHour && nowHours !== null ? nowHours : h + 1;
      points.push(
        `${((end / 24) * W).toFixed(2)},${(H - (value / max) * (H - 3)).toFixed(2)}`,
      );
    });
    return points.join(" ");
  };
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-8 w-full"
    >
      <polyline
        points={path(compareValues, false)}
        fill="none"
        stroke={COMPARE}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
        opacity={0.7}
      />
      <polyline
        points={path(values, true)}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
