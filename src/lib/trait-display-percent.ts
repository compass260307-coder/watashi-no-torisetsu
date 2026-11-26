// 自己診断の 5 つの特性を「表示用の %」にする (2026-11-26)。
//
// なぜ必要か:
//   1 つの特性は 10 問 × 7 段階の合計で決まるので、取りうる値は 61 通り (約 1.67% 刻み)。
//   その 3 つに 1 つが 5 の倍数に当たり、50%・60% のようなキリの良い数字が
//   全体の 35% を占めていた (偏りがなければ 20%)。
//
// やっていること:
//   特性を作る 2 つの小項目 (ファセット) を、半々ではなく 55:45 で混ぜて % にする。
//   合計が同じでも小項目の内訳が違う人は別の数字になり、0〜100 のすべての値を取りうる。
//
// 約束ごと:
//   - 変えるのは「表示する数字」だけ。タイプ判定 (diagnosis.ts) は保存済みの 5 因子スコアを
//     そのまま使う。重みに心理学的な根拠はなく、どちらを重くするかはここで決めたもの。
//   - 表示がタイプ判定の向きと食い違わないよう、判定が高い側 (>= 5.0) なら 50 以上、
//     低い側なら 49 以下に収める。
//   - 小項目のスコアが無い・5 因子スコアと合わない (古いデータ) ときは、これまでどおり
//     5 因子スコア × 10 を返す。
//   - 友達から見たスコアや、自分と友達の比較には使わない (両方を同じ物差しで比べるため)。

import type { BigFiveDimension, FacetId } from "./types";

/** 重くする小項目の割合 (もう一方は 1 - この値)。 */
const PRIMARY_FACET_WEIGHT = 0.55;

/** 特性ごとの小項目。先頭が重くする側。 */
const DISPLAY_FACETS: Record<BigFiveDimension, readonly [FacetId, FacetId]> = {
  E: ["E_assertiveness", "E_warmth"],
  A: ["A_cooperation", "A_sympathy"],
  O: ["O_adventurousness", "O_imagination"],
  C: ["C_achievement", "C_orderliness"],
  N: ["N_volatility", "N_anxiety"],
};

const SCALE_MIDPOINT = 5;

export type TraitDisplayScores = Partial<Record<BigFiveDimension, number>> & {
  facetScores?: unknown;
};

function clampPercent(value: number): number {
  // 1e-9: 0.55 などの掛け算で出る誤差で、ちょうど .5 の値が切り捨てられるのを防ぐ。
  return Math.max(0, Math.min(100, Math.round(value + 1e-9)));
}

function facetScore(facetScores: unknown, facetId: FacetId): number | null {
  if (!facetScores || typeof facetScores !== "object") return null;
  const value = (facetScores as Record<string, unknown>)[facetId];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * 自己診断の特性 1 つを 0-100 の表示用 % にする。
 * scores は users.scores (5 因子スコア + facetScores) をそのまま渡す。
 */
export function selfTraitPercent(
  scores: TraitDisplayScores | null | undefined,
  dim: BigFiveDimension,
): number {
  const raw = scores?.[dim];
  const base = typeof raw === "number" && Number.isFinite(raw) ? raw : SCALE_MIDPOINT;
  const plain = clampPercent(base * 10);

  const [primaryId, secondaryId] = DISPLAY_FACETS[dim];
  const primary = facetScore(scores?.facetScores, primaryId);
  const secondary = facetScore(scores?.facetScores, secondaryId);
  if (primary === null || secondary === null) return plain;
  // 小項目の平均が 5 因子スコアと合わないデータ (採点方法が違う古い結果など) には使わない。
  if (Math.abs((primary + secondary) / 2 - base) > 0.01) return plain;

  const weighted = clampPercent(
    (primary * PRIMARY_FACET_WEIGHT + secondary * (1 - PRIMARY_FACET_WEIGHT)) * 10,
  );
  return base >= SCALE_MIDPOINT ? Math.max(50, weighted) : Math.min(49, weighted);
}
