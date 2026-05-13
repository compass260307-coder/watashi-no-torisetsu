import type {
  AnswerValue,
  BigFiveDimension,
  CModifier,
  DiagnosisResult,
  FacetId,
  NModifier,
  TorisetsuTypeId,
} from "./types";
import { FACET_TO_DIMENSION } from "./types";
import { questions } from "./questions";
import {
  generateFullCode as combineFullCode,
  getModifierLabel,
} from "./modifier-data";

// ── 定数 ──

/**
 * 0-10 スケールの中央値。High/Low 判定およびモディファイア判定のしきい値。
 */
const SCALE_MIDPOINT = 5.0;

/**
 * 8 タイプ → 3 文字ベースコードのマッピング。
 * E (Extraversion) / I (Introversion) × A (Agreeableness) / M (Maverick) × O (Openness) / T (Traditional)
 */
export const TYPE_TO_BASE_CODE: Record<TorisetsuTypeId, string> = {
  "festival-sun": "EAO",       // E高 × A高 × O高
  "everyones-home": "EAT",     // E高 × A高 × O低
  "wild-charisma": "EMO",      // E高 × A低 × O高
  "iron-mental": "EMT",        // E高 × A低 × O低
  "delicate-creator": "IAO",   // E低 × A高 × O高
  "healing-guardian": "IAT",   // E低 × A高 × O低
  "deep-dive-explorer": "IMO", // E低 × A低 × O高
  "cool-maverick": "IMT",      // E低 × A低 × O低
};

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

const ALL_DIMENSIONS: BigFiveDimension[] = ["E", "A", "O", "C", "N"];

// ── スコア計算 ──

/**
 * ファセット単位 (10 個) のスコアを 0-10 スケールで計算する。
 * - 各 facet に属する 5 問の 7 段階回答を平均
 * - 逆転項目は 8 - rawAnswer で反転 (1↔7, 2↔6, 3↔5, 4↔4)
 * - 平均値 (1〜7) を (avg - 1) / 6 * 10 で 0-10 にスケール
 * - 回答欠損時は 5.0 (中央) を fallback
 */
export function calculateFacetScores(
  answers: Record<number, AnswerValue>,
): Record<FacetId, number> {
  const buckets: Partial<Record<FacetId, number[]>> = {};

  for (const question of questions) {
    const rawAnswer = answers[question.id];
    if (rawAnswer === undefined) continue;
    const normalized = question.reversed ? 8 - rawAnswer : rawAnswer;
    (buckets[question.facetId] ??= []).push(normalized);
  }

  const scores = {} as Record<FacetId, number>;
  for (const facetId of ALL_FACETS) {
    const values = buckets[facetId];
    if (values && values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      scores[facetId] = ((avg - 1) / 6) * 10;
    } else {
      scores[facetId] = SCALE_MIDPOINT;
    }
  }

  return scores;
}

/**
 * Big Five ディメンション単位 (5 因子) のスコアを 0-10 スケールで計算する。
 * 各 dim は属する 2 ファセットスコアの単純平均で算出する
 * (質問の直接平均ではなく facet 経由)。
 */
export function calculateScores(
  answers: Record<number, AnswerValue>,
): Record<BigFiveDimension, number> {
  const facetScores = calculateFacetScores(answers);
  const buckets: Record<BigFiveDimension, number[]> = {
    E: [],
    A: [],
    O: [],
    C: [],
    N: [],
  };

  for (const facetId of ALL_FACETS) {
    const dim = FACET_TO_DIMENSION[facetId];
    buckets[dim].push(facetScores[facetId]);
  }

  const scores = {} as Record<BigFiveDimension, number>;
  for (const dim of ALL_DIMENSIONS) {
    const values = buckets[dim];
    scores[dim] =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : SCALE_MIDPOINT;
  }

  return scores;
}

// ── タイプ / モディファイア判定 ──

/**
 * 8 タイプの判定。E/A/O の High/Low (>= 5.0 / < 5.0) の組み合わせで決定。
 */
export function classifyType(
  scores: Record<BigFiveDimension, number>,
): TorisetsuTypeId {
  const isHighE = scores.E >= SCALE_MIDPOINT;
  const isHighA = scores.A >= SCALE_MIDPOINT;
  const isHighO = scores.O >= SCALE_MIDPOINT;

  if (isHighE && isHighA && isHighO) return "festival-sun";
  if (isHighE && isHighA && !isHighO) return "everyones-home";
  if (isHighE && !isHighA && isHighO) return "wild-charisma";
  if (isHighE && !isHighA && !isHighO) return "iron-mental";
  if (!isHighE && isHighA && isHighO) return "delicate-creator";
  if (!isHighE && isHighA && !isHighO) return "healing-guardian";
  if (!isHighE && !isHighA && isHighO) return "deep-dive-explorer";
  return "cool-maverick";
}

/**
 * モディファイア判定。
 * - 誠実性軸: C dim ≥ 5.0 → "C" (計画派) / それ未満 → "F" (自由派)
 * - 神経症傾向軸: N dim ≥ 5.0 → "N" (繊細派) / それ未満 → "R" (鉄壁派)
 */
export function classifyModifier(
  scores: Record<BigFiveDimension, number>,
): { cModifier: CModifier; nModifier: NModifier } {
  return {
    cModifier: scores.C >= SCALE_MIDPOINT ? "C" : "F",
    nModifier: scores.N >= SCALE_MIDPOINT ? "N" : "R",
  };
}

// ── コード生成 ──

/**
 * 5 文字フルコードを生成する (例: "EAO-C-N")。
 * - typeId からベース 3 文字を引き、モディファイアと結合
 */
export function buildFullCode(
  typeId: TorisetsuTypeId,
  cModifier: CModifier,
  nModifier: NModifier,
): string {
  const baseCode = TYPE_TO_BASE_CODE[typeId];
  return combineFullCode(baseCode, cModifier, nModifier);
}

// ── 説明文 ──

const REASON_HIGH: Record<BigFiveDimension, string> = {
  E: "人と関わることでエネルギーが湧くタイプ",
  A: "周りの気持ちに寄り添える共感力が高い",
  O: "新しいことへの好奇心が強く柔軟",
  C: "",
  N: "",
};

const REASON_LOW: Record<BigFiveDimension, string> = {
  E: "一人の時間を大事にする内省タイプ",
  A: "自分の考えをしっかり持っている芯の強さがある",
  O: "安定した環境で力を発揮するタイプ",
  C: "",
  N: "",
};

function generateReasons(
  scores: Record<BigFiveDimension, number>,
): string[] {
  const reasons: string[] = [];
  for (const dim of ["E", "A", "O"] as BigFiveDimension[]) {
    const isHigh = scores[dim] >= SCALE_MIDPOINT;
    const text = isHigh ? REASON_HIGH[dim] : REASON_LOW[dim];
    if (text) reasons.push(text);
  }
  return reasons;
}

// 役割は modifier-data.ts の getModifierParagraph に譲渡。
// 後方互換のため関数自体は残し、空文字を返す。
function generateSupplement(_scores: Record<BigFiveDimension, number>): string {
  return "";
}

// ── メイン ──

/**
 * 診断のメイン関数。50 問の回答から DiagnosisResult を返す。
 */
export function diagnose(
  answers: Record<number, AnswerValue>,
): DiagnosisResult {
  const facetScores = calculateFacetScores(answers);
  const scores = calculateScores(answers);
  const typeId = classifyType(scores);
  const { cModifier, nModifier } = classifyModifier(scores);
  const fullCode = buildFullCode(typeId, cModifier, nModifier);
  const modifierLabel = getModifierLabel(cModifier, nModifier);
  const reasons = generateReasons(scores);
  const supplement = generateSupplement(scores);

  return {
    scores,
    facetScores,
    typeId,
    cModifier,
    nModifier,
    fullCode,
    modifierLabel,
    reasons,
    supplement,
  };
}
