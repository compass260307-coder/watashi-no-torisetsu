"use client";

import type { BigFiveDimension, FacetId } from "@/lib/types";
import { FACET_LABELS, FACET_TO_DIMENSION } from "@/lib/types";

interface FacetBarChartProps {
  facetScores: Record<FacetId, number>;
  variant?: "self" | "friend" | "comparison";
  friendScores?: Partial<Record<FacetId, number>>;
  className?: string;
}

// 各 dim の色 (背景の塗りクラス + マーカー色)
const DIMENSION_BAR_CLASS: Record<BigFiveDimension, string> = {
  E: "bg-pink-500",
  A: "bg-orange-500",
  O: "bg-amber-500",
  C: "bg-teal-500",
  N: "bg-purple-500",
};

const FACET_ORDER: FacetId[] = [
  "E_assertiveness",
  "E_warmth",
  "A_cooperation",
  "A_sympathy",
  "O_adventurousness",
  "O_imagination",
  "C_achievement",
  "C_orderliness",
  "N_volatility",
  "N_anxiety",
];

function pct(score: number): number {
  return Math.max(0, Math.min(100, (score / 10) * 100));
}

export function FacetBarChart({
  facetScores,
  variant = "self",
  friendScores,
  className = "",
}: FacetBarChartProps) {
  return (
    <div className={`w-full space-y-2.5 ${className}`.trim()}>
      {variant === "comparison" && (
        <div className="flex items-center justify-end gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 rounded-sm bg-primary" />
            自分
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-1 h-3 bg-gray-800" />
            友達
          </span>
        </div>
      )}
      {FACET_ORDER.map((facetId) => {
        const score = facetScores[facetId] ?? 0;
        const friendScore = friendScores?.[facetId];
        const dim = FACET_TO_DIMENSION[facetId];
        const barClass = DIMENSION_BAR_CLASS[dim];
        return (
          <div key={facetId} className="flex items-center gap-3">
            <div className="w-16 sm:w-20 text-xs sm:text-sm font-bold text-foreground shrink-0">
              {FACET_LABELS[facetId]}
            </div>
            <div className="flex-1 relative h-5 sm:h-6 bg-card-border rounded-full overflow-hidden">
              <div
                className={`absolute top-0 left-0 h-full ${barClass} transition-all duration-500 rounded-full`}
                style={{ width: `${pct(score)}%` }}
              />
              {variant === "comparison" && friendScore !== undefined && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-gray-800"
                  style={{ left: `${pct(friendScore)}%` }}
                  aria-label={`友達評価 ${friendScore.toFixed(1)}`}
                  title={`友達評価: ${friendScore.toFixed(1)}`}
                />
              )}
            </div>
            <div className="w-10 sm:w-12 text-right text-xs sm:text-sm font-bold tabular-nums text-foreground">
              {score.toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
