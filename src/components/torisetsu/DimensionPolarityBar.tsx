"use client";

import type { BigFiveDimension } from "@/lib/types";

interface PolarityMeta {
  leftLetter: string;
  leftLabel: string;
  rightLetter: string;
  rightLabel: string;
  icon: string;
  title: string;
  markerClass: string;
  letterColorClass: string;
}

// 各 dim の極性メタ。score が 5.0 以上で右側 (high) の letter が選ばれる。
// この方向は diagnosis.ts の classifyType / TYPE_TO_BASE_CODE と整合:
//   E dim ≥ 5 → "E" (外向)、< 5 → "I" (内向)
//   A dim ≥ 5 → "A" (協調)、< 5 → "M" (Maverick/自分軸)
//   O dim ≥ 5 → "O" (開放)、< 5 → "T" (Traditional/安定)
//   C dim ≥ 5 → "C" (計画)、< 5 → "F" (自由)
//   N dim ≥ 5 → "N" (繊細)、< 5 → "R" (鉄壁)
const POLARITY_META: Record<BigFiveDimension, PolarityMeta> = {
  E: {
    leftLetter: "I",
    leftLabel: "内向",
    rightLetter: "E",
    rightLabel: "外向",
    icon: "🗣️",
    title: "社交性",
    markerClass: "bg-pink-500",
    letterColorClass: "text-pink-600",
  },
  A: {
    leftLetter: "M",
    leftLabel: "自分軸",
    rightLetter: "A",
    rightLabel: "協調",
    icon: "🤝",
    title: "協調性",
    markerClass: "bg-orange-500",
    letterColorClass: "text-orange-600",
  },
  O: {
    leftLetter: "T",
    leftLabel: "安定",
    rightLetter: "O",
    rightLabel: "開放",
    icon: "🌈",
    title: "好奇心",
    markerClass: "bg-amber-500",
    letterColorClass: "text-amber-600",
  },
  C: {
    leftLetter: "F",
    leftLabel: "自由",
    rightLetter: "C",
    rightLabel: "計画",
    icon: "📋",
    title: "計画性",
    markerClass: "bg-teal-500",
    letterColorClass: "text-teal-600",
  },
  N: {
    leftLetter: "R",
    leftLabel: "鉄壁",
    rightLetter: "N",
    rightLabel: "繊細",
    icon: "💧",
    title: "繊細さ",
    markerClass: "bg-purple-500",
    letterColorClass: "text-purple-600",
  },
};

interface DimensionPolarityBarProps {
  dimension: BigFiveDimension;
  score: number; // 0-10
  className?: string;
}

export function DimensionPolarityBar({
  dimension,
  score,
  className = "",
}: DimensionPolarityBarProps) {
  const meta = POLARITY_META[dimension];
  const clamped = Math.max(0, Math.min(10, score));
  const positionPercent = (clamped / 10) * 100;
  const isRightSide = clamped >= 5;

  return (
    <div className={`w-full ${className}`.trim()}>
      <div className="flex items-center gap-3">
        {/* 左ラベル */}
        <div className="flex flex-col items-center w-12 shrink-0 leading-tight">
          <span
            className={`text-xl font-extrabold ${
              !isRightSide ? meta.letterColorClass : "text-muted"
            }`}
          >
            {meta.leftLetter}
          </span>
          <span className="text-[10px] text-muted">{meta.leftLabel}</span>
        </div>

        {/* バー */}
        <div className="flex-1 relative h-2 bg-card-border rounded-full">
          {/* 中央 (5.0 境界) の点線 */}
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-4 border-l border-dashed border-muted/60"
          />
          {/* マーカー */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${meta.markerClass} shadow-md transition-all duration-500 -translate-x-1/2 border-2 border-white`}
            style={{ left: `${positionPercent}%` }}
            role="img"
            aria-label={`${meta.title} score ${clamped.toFixed(1)} / 10`}
          />
        </div>

        {/* 右ラベル */}
        <div className="flex flex-col items-center w-12 shrink-0 leading-tight">
          <span
            className={`text-xl font-extrabold ${
              isRightSide ? meta.letterColorClass : "text-muted"
            }`}
          >
            {meta.rightLetter}
          </span>
          <span className="text-[10px] text-muted">{meta.rightLabel}</span>
        </div>
      </div>
    </div>
  );
}
