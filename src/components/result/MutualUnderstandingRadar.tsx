// Phase 1.5-α Day 12-C1: 相互理解度レーダーチャート (5 次元、A 自己 vs B 評価の重ね表示)
//
// Server Component (純粋 SVG、useState 等なし)。
// gaps は順序固定 (E, A, O, C, N) で 5 要素、12 時方向 = E、時計回りで 72° 刻み。
// 同心多角形 (5 段、20/40/60/80/100%) で目安グリッド、
// B 評価 polygon (logoBlue 22%) を後ろ、A 自己 polygon (vividPink 22%) を前面に重ねる。

import type { DimensionGap } from "@/lib/perception-analysis";

const SIZE = 280;
const CENTER = SIZE / 2;
const MAX_RADIUS = 100;
const LABEL_OFFSET = 22;

interface RadarProps {
  gaps: DimensionGap[];
  selfColor?: string;
  otherColor?: string;
  selfLabel: string;
  otherLabel: string;
}

function angleFor(i: number): number {
  return ((-90 + 72 * i) * Math.PI) / 180;
}
function pointFor(i: number, radius: number): { x: number; y: number } {
  return {
    x: CENTER + radius * Math.cos(angleFor(i)),
    y: CENTER + radius * Math.sin(angleFor(i)),
  };
}
function pointsToPolygon(
  gaps: DimensionGap[],
  pick: (g: DimensionGap) => number,
): string {
  return gaps
    .map((g, i) => pointFor(i, (pick(g) / 100) * MAX_RADIUS))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

export function MutualUnderstandingRadar({
  gaps,
  selfColor = "#5B5BEF",
  otherColor = "#0094D8",
  selfLabel,
  otherLabel,
}: RadarProps) {
  if (gaps.length !== 5) {
    // 5 次元固定の前提が崩れた場合は何も描画しない (本フェーズでは到達しない想定)
    return null;
  }

  const selfPoints = pointsToPolygon(gaps, (g) => g.selfPercent);
  const otherPoints = pointsToPolygon(gaps, (g) => g.otherPercent);

  const axes = gaps.map((g, i) => ({
    end: pointFor(i, MAX_RADIUS),
    labelPos: pointFor(i, MAX_RADIUS + LABEL_OFFSET),
    label: g.label,
  }));

  const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0].map((ratio) =>
    gaps
      .map((_, i) => pointFor(i, ratio * MAX_RADIUS))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" "),
  );

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[300px] h-auto"
        role="img"
        aria-label={`${selfLabel} と ${otherLabel} の Big Five 5 次元レーダーチャート`}
      >
        {/* グリッド (同心多角形 5 段) */}
        {gridRings.map((points, i) => (
          <polygon
            key={`ring-${i}`}
            points={points}
            fill="none"
            stroke="#2E2E5C"
            strokeOpacity="0.12"
            strokeWidth="1"
          />
        ))}
        {/* 軸線 (中心から各頂点へ) */}
        {axes.map((a, i) => (
          <line
            key={`axis-${i}`}
            x1={CENTER}
            y1={CENTER}
            x2={a.end.x}
            y2={a.end.y}
            stroke="#2E2E5C"
            strokeOpacity="0.18"
            strokeWidth="1"
          />
        ))}
        {/* B 評価 (背景) */}
        <polygon
          points={otherPoints}
          fill={otherColor}
          fillOpacity="0.22"
          stroke={otherColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* A 自己 (前面) */}
        <polygon
          points={selfPoints}
          fill={selfColor}
          fillOpacity="0.22"
          stroke={selfColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* 各頂点ラベル */}
        {axes.map((a, i) => (
          <text
            key={`label-${i}`}
            x={a.labelPos.x}
            y={a.labelPos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="700"
            fill="#2E2E5C"
          >
            {a.label}
          </text>
        ))}
      </svg>
      {/* 凡例 */}
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ backgroundColor: selfColor }}
            aria-hidden="true"
          />
          <span className="text-xs font-bold text-[#2E2E5C]">{selfLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ backgroundColor: otherColor }}
            aria-hidden="true"
          />
          <span className="text-xs font-bold text-[#2E2E5C]">{otherLabel}</span>
        </div>
      </div>
    </div>
  );
}
