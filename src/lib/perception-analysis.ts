// Phase 1.5-α Day 12-C1: 友達評価結果ページの分析ロジック
//
// users.scores (自己診断) と friend_perceptions.perceived_scores (友達評価) は
// どちらも { E, A, O, C, N } 各 0-10 の Big Five 構造 (lib/diagnosis.ts のスケール準拠)。
// このファイルでは:
//   - 各次元の % 化 + 自己 vs 評価の差分計算 (DimensionGap[])
//   - 平均差分から相互理解度 % 算出
//   - ギャップが大きい上位 N 次元の抽出
// を提供する。
//
// users / friend_perceptions スキーマは Phase 3-β で既に Big Five JSONB を保持しており
// (perceived_scores jsonb NOT NULL、phase-3b-release-1-foundations.sql line 88)、
// 本 Day 12-C1 では DB 変更なしでこのロジックを乗せられる。

import type { BigFiveDimension } from "./types";

const DIMENSIONS: { key: BigFiveDimension; label: string }[] = [
  { key: "E", label: "外向性" },
  { key: "A", label: "協調性" },
  { key: "O", label: "開放性" },
  { key: "C", label: "誠実性" },
  { key: "N", label: "神経症傾向" },
];

export type BigFiveScores = Partial<Record<BigFiveDimension, number>>;

export interface DimensionGap {
  key: BigFiveDimension;
  label: string;
  selfPercent: number; // 0-100
  otherPercent: number; // 0-100
  diffPoints: number; // |self - other|、0-100
}

// 0-10 → 0-100 % 化、欠損は中央値 50 にフォールバック
function toPercent(raw: unknown): number {
  if (typeof raw !== "number") return 50;
  return Math.max(0, Math.min(100, Math.round(raw * 10)));
}

/** 5 次元それぞれの自己 % / 評価 % / 差分 pt を作る (順序: E, A, O, C, N) */
export function buildDimensionGaps(
  self: BigFiveScores,
  other: BigFiveScores,
): DimensionGap[] {
  return DIMENSIONS.map(({ key, label }) => {
    const selfPercent = toPercent(self[key]);
    const otherPercent = toPercent(other[key]);
    return {
      key,
      label,
      selfPercent,
      otherPercent,
      diffPoints: Math.abs(selfPercent - otherPercent),
    };
  });
}

/**
 * 相互理解度 % = 100 - 平均差分。
 * 平均差 0 (完全一致) → 100、平均差 100 → 0。
 * 値は clamp + 整数化。
 */
export function calcMutualUnderstanding(gaps: DimensionGap[]): number {
  if (gaps.length === 0) return 0;
  const avgDiff = gaps.reduce((s, g) => s + g.diffPoints, 0) / gaps.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgDiff)));
}

/** 差分が大きい順に上位 n 件 (同値時は元の DIMENSIONS 順) */
export function topGaps(gaps: DimensionGap[], n = 3): DimensionGap[] {
  return [...gaps].sort((a, b) => b.diffPoints - a.diffPoints).slice(0, n);
}
