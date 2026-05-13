"use client";

import type { FacetGapItem } from "@/lib/gap-analysis";

interface FacetGapListProps {
  gaps: FacetGapItem[];
  highlightTop?: number;
  className?: string;
}

// 0-10 スケールで「目立つ」ギャップしきい値 (gap-analysis.ts と整合)
const HIGHLIGHT_THRESHOLD = 1.0;

export function FacetGapList({
  gaps,
  highlightTop = 3,
  className = "",
}: FacetGapListProps) {
  if (gaps.length === 0) return null;

  const sorted = [...gaps].sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
  );

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {sorted.map((item, idx) => {
        const absGap = Math.abs(item.gap);
        const isHighlight = idx < highlightTop && absGap >= HIGHLIGHT_THRESHOLD;
        const arrow =
          item.gap > 0.05 ? "↑" : item.gap < -0.05 ? "↓" : "≈";
        const arrowColor =
          item.gap > 0.05
            ? "text-blue-600"
            : item.gap < -0.05
              ? "text-pink-600"
              : "text-muted";
        return (
          <div
            key={item.facetId}
            className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
              isHighlight
                ? "bg-label-bg border-primary/30"
                : "bg-card-bg border-card-border"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-foreground truncate">
                {item.label}
              </span>
              {isHighlight && (
                <span className="text-[9px] font-bold text-primary bg-primary/10 rounded-full px-1.5 py-0.5 shrink-0">
                  TOP
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs tabular-nums shrink-0">
              <span className="text-muted">
                自 {item.selfScore.toFixed(1)}
              </span>
              <span className="text-card-border">/</span>
              <span className="text-muted">
                友 {item.friendScore.toFixed(1)}
              </span>
              <span className={`font-bold ${arrowColor} ml-1`}>
                {arrow} {item.gap > 0 ? "+" : ""}
                {item.gap.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
