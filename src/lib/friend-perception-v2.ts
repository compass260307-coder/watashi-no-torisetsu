// Phase 3-β A-5: 新 30 問形式の友達評価から FriendPerception を派生計算する。
// 旧 13 問形式 (friend-perception.ts) は破壊せず並存。
// B-1 で確定する 30 問質問データ (Appendix A) に対応した固定マッピング。

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

// =====================================================================
// 質問マップ (設計書 Appendix A の最終確定版を反映)
// 各ファセット 3 問、計 30 問、逆転項目 10 個
// =====================================================================
type QuestionMeta = {
  facetId: FacetId;
  reversed: boolean;
};

export const FRIEND_QUESTIONS_V2_MAP: Record<number, QuestionMeta> = {
  // ページ 1 (Q1-10)
  1:  { facetId: "E_assertiveness",   reversed: false }, // +
  2:  { facetId: "O_adventurousness", reversed: false }, // +
  3:  { facetId: "C_orderliness",     reversed: false }, // +
  4:  { facetId: "A_cooperation",     reversed: true  }, // -
  5:  { facetId: "N_volatility",      reversed: false }, // +
  6:  { facetId: "A_sympathy",        reversed: false }, // +
  7:  { facetId: "O_imagination",     reversed: false }, // +
  8:  { facetId: "E_assertiveness",   reversed: false }, // +
  9:  { facetId: "C_orderliness",     reversed: true  }, // -
  10: { facetId: "N_anxiety",         reversed: false }, // +
  // ページ 2 (Q11-20)
  11: { facetId: "E_assertiveness",   reversed: true  }, // -
  12: { facetId: "E_warmth",          reversed: false }, // +
  13: { facetId: "O_adventurousness", reversed: false }, // +
  14: { facetId: "C_achievement",     reversed: false }, // +
  15: { facetId: "O_adventurousness", reversed: true  }, // -
  16: { facetId: "A_sympathy",        reversed: false }, // +
  17: { facetId: "O_imagination",     reversed: true  }, // -
  18: { facetId: "N_volatility",      reversed: true  }, // -
  19: { facetId: "A_cooperation",     reversed: false }, // +
  20: { facetId: "E_warmth",          reversed: false }, // +
  // ページ 3 (Q21-30)
  21: { facetId: "C_achievement",     reversed: false }, // +
  22: { facetId: "N_anxiety",         reversed: false }, // +
  23: { facetId: "N_anxiety",         reversed: true  }, // -
  24: { facetId: "A_sympathy",        reversed: true  }, // -
  25: { facetId: "C_orderliness",     reversed: false }, // +
  26: { facetId: "A_cooperation",     reversed: true  }, // -
  27: { facetId: "O_imagination",     reversed: false }, // +
  28: { facetId: "C_achievement",     reversed: true  }, // -
  29: { facetId: "E_warmth",          reversed: false }, // +
  30: { facetId: "N_volatility",      reversed: true  }, // -
};

export const FRIEND_QUESTIONS_V2_TOTAL = 30;
const REQUIRED_FACETS = 10;
const QUESTIONS_PER_FACET = 3;

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
 * 30 問の Likert 回答 (1-7) と任意 qualitative_data から FriendPerceptionV2 を計算する。
 *
 * - 各 facet に属する 3 問の回答を、逆転項目を考慮しつつ平均
 * - 平均値 (1-7 範囲) を 0-10 スケールに変換: ((avg - 1) / 6) * 10
 * - 5 軸スコアは各 dim の 2 facet 平均
 * - typeId / modifier は diagnosis.ts のロジックを再利用
 * - 必要な scale 質問 (30 問) が揃わない場合は null
 *
 * @param answers id (1-30) → AnswerValue (1-7) のマップ
 * @param qualitative おまけ choice 3 問 (好きなところ / 動物 / 印象シーン)、任意
 */
export function perceiveFromFriendAnswersV2(
  answers: Record<number, AnswerValue>,
  qualitative?: FriendQualitativeData,
): FriendPerceptionV2 | null {
  // === 1. facet ごとの集計 ===
  const buckets: Partial<Record<FacetId, number[]>> = {};
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
    (buckets[meta.facetId] ??= []).push(normalized);
    answeredCount++;

    if (raw === 1 || raw === 7) extremeValues.push(raw);
  }

  if (answeredCount < FRIEND_QUESTIONS_V2_TOTAL) {
    return null; // 1 問でも欠損があれば不確定として返却拒否
  }

  // === 2. facet → 0-10 スケール化 ===
  const facetScores = {} as Record<FacetId, number>;
  for (const facetId of ALL_FACETS) {
    const values = buckets[facetId];
    if (!values || values.length !== QUESTIONS_PER_FACET) {
      // 設計通りなら 3 問ずつ揃うはずだが、ガード
      facetScores[facetId] = SCALE_MIDPOINT;
      continue;
    }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    facetScores[facetId] = ((avg - 1) / 6) * 10;
  }

  // ガード: 全 10 facet 揃っていない場合は不確定
  if (
    Object.keys(facetScores).filter((f) => facetScores[f as FacetId] !== undefined)
      .length !== REQUIRED_FACETS
  ) {
    return null;
  }

  // === 3. dim スコア (各 dim の 2 facet 平均) ===
  const dimBuckets: Record<BigFiveDimension, number[]> = {
    E: [],
    A: [],
    O: [],
    C: [],
    N: [],
  };
  for (const facetId of ALL_FACETS) {
    dimBuckets[FACET_TO_DIMENSION[facetId]].push(facetScores[facetId]);
  }
  const scores = {} as Record<BigFiveDimension, number>;
  for (const dim of ["E", "A", "O", "C", "N"] as BigFiveDimension[]) {
    const v = dimBuckets[dim];
    scores[dim] =
      v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : SCALE_MIDPOINT;
  }

  // === 4. type / modifier / fullCode / modifier paragraph (自己診断と同一ロジック) ===
  const typeId = classifyType(scores);
  const { cModifier, nModifier } = classifyModifier(scores);
  const fullCode = buildFullCode(typeId, cModifier, nModifier);
  const modifierLabel = getModifierLabel(cModifier, nModifier);
  const modifierParagraph = getModifierParagraph(typeId, cModifier, nModifier);

  // === 5. 信頼度 (30 問版に閾値再調整) ===
  // 旧 10 問版は 5+/2-4/<2 → 新 30 問版は 3 倍に概算スケール
  let confidence: "low" | "medium" | "high";
  if (extremeValues.length >= 15) confidence = "high";
  else if (extremeValues.length >= 6) confidence = "medium";
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
