// Phase 3-β A-5: 新 30 問形式の友達評価から FriendPerception を派生計算する。
// 旧 13 問形式 (friend-perception.ts) は破壊せず並存。
//
// Phase 3-β B-1 で質問データを friend-questions-v2.ts に集約 (single source of truth)。
// 本ファイルは FRIEND_QUESTIONS_V2_MAP をそこから派生生成して計算に利用する。

import type {
  AnswerValue,
  BigFiveDimension,
  CModifier,
  FacetId,
  NModifier,
  TorisetsuTypeId,
} from "./types";
import { FACET_TO_DIMENSION } from "./types";
import {
  buildFullCode,
  classifyModifier,
  classifyType,
} from "./diagnosis";
import { getModifierLabel, getModifierParagraph } from "./modifier-data";
import {
  FRIEND_QUESTIONS_V2,
  FRIEND_QUESTIONS_V2_TOTAL as TOTAL_FROM_DATA,
} from "./friend-questions-v2";

// =====================================================================
// 質問マップ (B-1 の質問データから派生生成)
// 各ファセット 3 問、計 30 問、逆転項目 11 個 (Appendix A 非対称配分)
// =====================================================================
type QuestionMeta = {
  facetId: FacetId;
  reversed: boolean;
};

export const FRIEND_QUESTIONS_V2_MAP: Record<number, QuestionMeta> =
  Object.fromEntries(
    FRIEND_QUESTIONS_V2.map((q) => [
      q.id,
      { facetId: q.facetId, reversed: q.reversed },
    ]),
  );

export const FRIEND_QUESTIONS_V2_TOTAL = TOTAL_FROM_DATA;

// =====================================================================
// qualitative_data (おまけ choice 3 問、各 optional)
// 論点 2 (c) 採用: 「30 問 + おまけ 3 問、スキップ可」
// jsonb 上のキー名は B-1 で確定するが、現状は設計書通り Japanese を採用。
// =====================================================================
export type FriendQualitativeData = Record<string, string>;

// =====================================================================
// 戻り値型 (旧 FriendPerception を継承しつつ modifierParagraph と
// qualitativeData を追加。friend_perceptions テーブルへの書き込みで使用)
// =====================================================================
export interface FriendPerceptionV2 {
  facetScores: Record<FacetId, number>; // 0-10
  scores: Record<BigFiveDimension, number>; // 0-10
  typeId: TorisetsuTypeId;
  cModifier: CModifier;
  nModifier: NModifier;
  fullCode: string; // 例 "EAO-C-N"
  modifierLabel: string; // 例 "計画 × 繊細"
  modifierParagraph: string; // ~150 字、スナップショット保存用
  confidence: "low" | "medium" | "high";
  qualitativeData?: FriendQualitativeData;
}

const ALL_FACETS: FacetId[] = [
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

const SCALE_MIDPOINT = 5.0;

/**
 * 10 問の Likert 回答 (1-7) と任意 qualitative_data から FriendPerceptionV2 を計算する。
 *
 * 改修 (10 問 = 5 軸 × 2 問):
 * - 各軸 (dim) に属する 2 問を直接平均 (逆転項目を考慮)。
 * - 平均値 (1-7 範囲) を 0-10 スケールに変換: ((avg - 1) / 6) * 10。
 * - perceived_facet_scores は 10 問では精度が出ないため、各ファセットに親軸スコアを
 *   埋める (DB の NOT NULL 制約と既存 consumer 向けのフォールバック)。
 * - typeId / modifier は diagnosis.ts のロジックを再利用。
 * - 必要な scale 質問 (10 問) が揃わない場合は null。
 *
 * @param answers id (1-10) → AnswerValue (1-7) のマップ
 * @param qualitative おまけ choice 3 問 (好きなところ / 動物 / 印象シーン)、任意
 */
export function perceiveFromFriendAnswersV2(
  answers: Record<number, AnswerValue>,
  qualitative?: FriendQualitativeData,
): FriendPerceptionV2 | null {
  // === 1. 軸 (dim) ごとに集計 ===
  const dimBuckets: Record<BigFiveDimension, number[]> = {
    E: [],
    A: [],
    O: [],
    C: [],
    N: [],
  };
  const extremeValues: number[] = []; // 信頼度判定用 (極端な 1 / 7 のカウント)
  let answeredCount = 0;

  for (let qId = 1; qId <= FRIEND_QUESTIONS_V2_TOTAL; qId++) {
    const meta = FRIEND_QUESTIONS_V2_MAP[qId];
    if (!meta) continue;

    const raw = answers[qId];
    if (typeof raw !== "number") continue;
    if (raw < 1 || raw > 7) continue;

    // 逆転項目: 7 段階の中央 (4) を軸に反転
    const normalized = meta.reversed ? 8 - raw : raw;
    dimBuckets[FACET_TO_DIMENSION[meta.facetId]].push(normalized);
    answeredCount++;

    if (raw === 1 || raw === 7) extremeValues.push(raw);
  }

  if (answeredCount < FRIEND_QUESTIONS_V2_TOTAL) {
    return null; // 1 問でも欠損があれば不確定として返却拒否
  }

  // === 2. 軸 → 0-10 スケール化 ===
  const scores = {} as Record<BigFiveDimension, number>;
  for (const dim of ["E", "A", "O", "C", "N"] as BigFiveDimension[]) {
    const v = dimBuckets[dim];
    const avg = v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 4;
    scores[dim] = v.length > 0 ? ((avg - 1) / 6) * 10 : SCALE_MIDPOINT;
  }

  // === 2'. facet フォールバック: 各ファセットに親軸スコアを埋める ===
  // 10 問ではファセット粒度の精度が出ないため、表示・DB NOT NULL 用に軸値を流用。
  const facetScores = {} as Record<FacetId, number>;
  for (const facetId of ALL_FACETS) {
    facetScores[facetId] = scores[FACET_TO_DIMENSION[facetId]];
  }

  // === 4. type / modifier / fullCode / modifier paragraph (自己診断と同一ロジック) ===
  const typeId = classifyType(scores);
  const { cModifier, nModifier } = classifyModifier(scores);
  const fullCode = buildFullCode(typeId, cModifier, nModifier);
  const modifierLabel = getModifierLabel(cModifier, nModifier);
  const modifierParagraph = getModifierParagraph(typeId, cModifier, nModifier);

  // === 5. 信頼度 (10 問版に閾値調整) ===
  let confidence: "low" | "medium" | "high";
  if (extremeValues.length >= 5) confidence = "high";
  else if (extremeValues.length >= 2) confidence = "medium";
  else confidence = "low";

  return {
    facetScores,
    scores,
    typeId,
    cModifier,
    nModifier,
    fullCode,
    modifierLabel,
    modifierParagraph,
    confidence,
    qualitativeData: qualitative,
  };
}
