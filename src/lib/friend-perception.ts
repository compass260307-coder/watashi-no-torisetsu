import type {
  AnswerValue,
  BigFiveDimension,
  CModifier,
  FacetId,
  NModifier,
  TorisetsuTypeId,
} from "./types";
import { FACET_TO_DIMENSION } from "./types";
import { friendQuestions } from "./friend-questions";
import {
  buildFullCode,
  classifyModifier,
  classifyType,
} from "./diagnosis";
import { getModifierLabel } from "./modifier-data";

export type FriendPerception = {
  facetScores: Record<FacetId, number>;       // 10 ファセット (0-10)
  scores: Record<BigFiveDimension, number>;   // 5 因子 (0-10)
  typeId: TorisetsuTypeId;
  cModifier: CModifier;
  nModifier: NModifier;
  fullCode: string;                            // 例: "EAO-C-N"
  modifierLabel: string;                       // 例: "計画 × 繊細"
  confidence: "low" | "medium" | "high";
} | null;

/**
 * 友達の回答から、その人がどう見られているかを推定する。
 * - 友達スケール 10 問 (id 1-10、各 facet 1 問) を 1-7 → 0-10 スケールに変換
 * - 各 facet から dim を facet 平均で算出
 * - 自己診断と同じ classify ロジック (diagnosis.ts) を流用
 * - 必要な scale 回答が 10 問揃わない場合は null
 */
export function perceiveFromFriendAnswers(
  answers: Record<number, AnswerValue | string>,
): FriendPerception {
  // ── 1. 10 ファセットのスコア算出 ──
  const facetScores: Partial<Record<FacetId, number>> = {};
  const extremeValues: number[] = []; // 信頼度判定用

  for (const question of friendQuestions) {
    if (question.type !== "scale" || !question.facetId) continue;

    const raw = answers[question.id];
    if (typeof raw !== "number") continue;

    // 1-7 → 0-10 スケール
    facetScores[question.facetId] = ((raw - 1) / 6) * 10;

    if (raw === 1 || raw === 7) extremeValues.push(raw);
  }

  if (Object.keys(facetScores).length < 10) {
    return null;
  }

  // ── 2. dim スコア (各 dim の 2 facet 平均) ──
  const buckets: Record<BigFiveDimension, number[]> = {
    E: [],
    A: [],
    O: [],
    C: [],
    N: [],
  };
  for (const facetId of Object.keys(facetScores) as FacetId[]) {
    const score = facetScores[facetId];
    if (score === undefined) continue;
    buckets[FACET_TO_DIMENSION[facetId]].push(score);
  }

  const scores = {} as Record<BigFiveDimension, number>;
  for (const dim of ["E", "A", "O", "C", "N"] as BigFiveDimension[]) {
    const values = buckets[dim];
    scores[dim] =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 5.0;
  }

  // ── 3. タイプ + モディファイア + フルコード (自己診断と同ロジック) ──
  const typeId = classifyType(scores);
  const { cModifier, nModifier } = classifyModifier(scores);
  const fullCode = buildFullCode(typeId, cModifier, nModifier);
  const modifierLabel = getModifierLabel(cModifier, nModifier);

  // ── 4. 信頼度 (極端な回答が多いほど high) ──
  let confidence: "low" | "medium" | "high";
  if (extremeValues.length >= 5) confidence = "high";
  else if (extremeValues.length >= 2) confidence = "medium";
  else confidence = "low";

  return {
    facetScores: facetScores as Record<FacetId, number>,
    scores,
    typeId,
    cModifier,
    nModifier,
    fullCode,
    modifierLabel,
    confidence,
  };
}
