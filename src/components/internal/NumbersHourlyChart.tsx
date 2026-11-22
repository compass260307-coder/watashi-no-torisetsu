"use client";

import { useState } from "react";

import {
  formatNumbersValue,
  type HeadlineDefinition,
  type NumbersHour,
} from "@/lib/internal-numbers";

// 表示日は棒、比較日は細い線。2 系列は形 (棒と線) と凡例でも見分けられる。
const SERIES_COLOR = "#3987e5";
const COMPARE_COLOR = "#8b8b85";
const GRID_COLOR = "#1f2226";
const AXIS_TEXT = "#6e767d";

// SVG は幅に合わせて縮むので、スマホで同じ図を使うと文字まで小さくなる。
// 幅の狭い画面用に、別の寸法で描いたものを用意して出し分ける。
interface Layout {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
  hourLabels: number[];
}
const WIDE: Layout = {
  width: 720,
  height: 240,
  pad: { top: 12, right: 8, bottom: 26, left: 44 },
  hourLabels: [0, 3, 6, 9, 12, 15, 18, 21],
};
const NARROW: Layout = {
  width: 360,
  height: 210,
  pad: { top: 10, right: 4, bottom: 24, left: 38 },
  hourLabels: [0, 6, 12, 18],
};

/** 目盛りの上限を、読みやすい数 (1・2・5 の倍数) に切り上げる。 */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

function axisLabel(value: number, kind: HeadlineDefinition["kind"]): string {
  if (kind === "rate") return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
  if (kind === "yen_decimal") return `¥${value.toFixed(value < 10 ? 1 : 0)}`;
  const text =
    value >= 10000
      ? `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`
      : new Intl.NumberFormat("ja-JP").format(value);
  return kind === "yen" ? `¥${text}` : text;
}

interface Props {
  metric: HeadlineDefinition;
  hours: NumbersHour[];
  compareHours: NumbersHour[];
  dayLabel: string;
  compareLabel: string;
  /** 途中の時間帯 (今日の現在の時)。それより先の時間帯は描かない。過去日は null。 */
  currentHour: number | null;
}

export function NumbersHourlyChart(props: Props) {
  const { metric, hours, compareHours, dayLabel, compareLabel, currentHour } = props;
  const lastHour = currentHour ?? 23;
  const hasData =
    hours.some((hour) => hour.h <= lastHour && (metric.fromHour(hour) ?? 0) > 0) ||
    compareHours.some((hour) => (metric.fromHour(hour) ?? 0) > 0);

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-end gap-4 text-xs text-[#8b8f94]">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: SERIES_COLOR }}
          />
          {dayLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4"
            style={{ background: COMPARE_COLOR }}
          />
          {compareLabel}
        </span>
      </div>

      <div className="relative sm:hidden">
        <Plot {...props} layout={NARROW} />
      </div>
      <div className="relative hidden sm:block">
        <Plot {...props} layout={WIDE} />
      </div>

      {!hasData && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#6e767d]">
          この日のデータはまだありません
        </p>
      )}
    </div>
  );
}

function Plot({
  metric,
  hours,
  compareHours,
  dayLabel,
  compareLabel,
  currentHour,
  layout,
}: Props & { layout: Layout }) {
  const [active, setActive] = useState<number | null>(null);

  const { width, height, pad } = layout;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / 24;
  const barW = Math.min(24, slot * 0.56);

  const lastHour = currentHour ?? 23;
  const values = hours.map((hour) =>
    hour.h <= lastHour ? metric.fromHour(hour) : null,
  );
  const compareValues = compareHours.map((hour) => metric.fromHour(hour));
  const max = niceCeil(
    Math.max(0, ...values.map((v) => v ?? 0), ...compareValues.map((v) => v ?? 0)),
  );
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const cx = (h: number) => pad.left + slot * h + slot / 2;

  // 比較日の線。値が無い時間帯 (分母 0 の率) では線を切る。
  const segments: string[] = [];
  let current: string[] = [];
  compareValues.forEach((value, h) => {
    if (value === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${cx(h).toFixed(1)},${y(value).toFixed(1)}`);
  });
  if (current.length) segments.push(current.join(" "));

  const activeValue = active === null ? null : values[active];
  const activeCompare = active === null ? null : compareValues[active];

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${metric.label}の時間別グラフ。${dayLabel}と${compareLabel}の比較。数値は下の「時間別」の表にあります。`}
        className="block h-auto w-full select-none"
        onMouseLeave={() => setActive(null)}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(max * t)}
              y2={y(max * t)}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y(max * t) + 4}
              textAnchor="end"
              fontSize={11}
              fill={AXIS_TEXT}
            >
              {axisLabel(max * t, metric.kind)}
            </text>
          </g>
        ))}

        {values.map((value, h) => {
          if (value === null || value <= 0) return null;
          const top = y(value);
          const bottom = pad.top + plotH;
          const radius = Math.min(4, bottom - top, barW / 2);
          const left = cx(h) - barW / 2;
          return (
            <path
              key={h}
              d={`M${left},${bottom} V${top + radius} Q${left},${top} ${left + radius},${top} H${left + barW - radius} Q${left + barW},${top} ${left + barW},${top + radius} V${bottom} Z`}
              fill={SERIES_COLOR}
              // 途中の時間帯は薄くして、まだ増える数字だと分かるようにする。
              opacity={h === currentHour ? 0.5 : active === null || active === h ? 1 : 0.6}
            />
          );
        })}

        {segments.map((points, index) => (
          <polyline
            key={index}
            points={points}
            fill="none"
            stroke={COMPARE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {active !== null && activeCompare !== null && (
          <circle
            cx={cx(active)}
            cy={y(activeCompare)}
            r={4}
            fill={COMPARE_COLOR}
            stroke="#0a0a0b"
            strokeWidth={2}
          />
        )}

        {layout.hourLabels.map((h) => (
          <text
            key={h}
            x={cx(h)}
            y={height - 7}
            textAnchor="middle"
            fontSize={11}
            fill={AXIS_TEXT}
          >
            {h}時
          </text>
        ))}

        {/* 当たり判定は棒より広く、時間帯の幅いっぱいに取る。 */}
        {hours.map((hour) => (
          <rect
            key={hour.h}
            x={pad.left + slot * hour.h}
            y={pad.top}
            width={slot}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setActive(hour.h)}
            onClick={() => setActive((prev) => (prev === hour.h ? null : hour.h))}
          />
        ))}
      </svg>

      {active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-[9.5rem] rounded-lg border border-[#2a2d31] bg-[#16181a] px-3 py-2 text-xs shadow-lg"
          style={
            active < 12
              ? { left: `${((cx(active) + slot / 2) / width) * 100}%` }
              : { right: `${((width - cx(active) + slot / 2) / width) * 100}%` }
          }
        >
          <p className="mb-1 text-[#8b8f94]">
            {active}時台{active === currentHour ? "（途中）" : ""}
          </p>
          <p className="flex justify-between gap-4 text-[#e7e9ea]">
            <span>{dayLabel}</span>
            <span className="font-bold tabular-nums">
              {active > lastHour ? "–" : formatNumbersValue(activeValue, metric.kind)}
            </span>
          </p>
          <p className="flex justify-between gap-4 text-[#8b8f94]">
            <span>{compareLabel}</span>
            <span className="tabular-nums">
              {formatNumbersValue(activeCompare, metric.kind)}
            </span>
          </p>
        </div>
      )}
    </>
  );
}
