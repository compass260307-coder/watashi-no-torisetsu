import type {
  AnswerValue,
  BigFiveDimension,
  DiagnosisResult,
  TorisetsuTypeId,
} from "./types";
import { questions } from "./questions";

export function calculateScores(
  answers: Record<number, AnswerValue>,
): Record<BigFiveDimension, number> {
  const dimensionScores: Record<BigFiveDimension, number[]> = {
    E: [],
    A: [],
    O: [],
    C: [],
    N: [],
  };

  for (const question of questions) {
    const answer = answers[question.id];
    if (answer === undefined) continue;
    const score = question.reversed ? 5 - answer : answer;
    dimensionScores[question.dimension].push(score);
  }

  const scores = {} as Record<BigFiveDimension, number>;
  for (const dim of ["E", "A", "O", "C", "N"] as BigFiveDimension[]) {
    const values = dimensionScores[dim];
    scores[dim] =
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 2.5;
  }

  return scores;
}

export function classifyType(
  scores: Record<BigFiveDimension, number>,
): TorisetsuTypeId {
  const isHighE = scores.E >= 2.5;
  const isHighA = scores.A >= 2.5;
  const isHighO = scores.O >= 2.5;

  if (isHighE && isHighA && isHighO) return "festival-sun";
  if (isHighE && isHighA && !isHighO) return "everyones-home";
  if (isHighE && !isHighA && isHighO) return "wild-charisma";
  if (isHighE && !isHighA && !isHighO) return "iron-mental";
  if (!isHighE && isHighA && isHighO) return "delicate-creator";
  if (!isHighE && isHighA && !isHighO) return "healing-guardian";
  if (!isHighE && !isHighA && isHighO) return "deep-dive-explorer";
  return "cool-maverick";
}

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
    const isHigh = scores[dim] >= 2.5;
    const text = isHigh ? REASON_HIGH[dim] : REASON_LOW[dim];
    if (text) reasons.push(text);
  }

  return reasons;
}

function generateSupplement(
  scores: Record<BigFiveDimension, number>,
): string {
  const parts: string[] = [];

  if (scores.C >= 3) {
    parts.push("計画的に物事を進めるのが得意");
  } else if (scores.C < 2) {
    parts.push("ノリと直感で動ける柔軟さがある");
  }

  if (scores.N >= 3) {
    parts.push("繊細で感受性が豊か");
  } else if (scores.N < 2) {
    parts.push("メンタルが安定していてブレにくい");
  }

  if (parts.length === 0) return "";
  return parts.join("で、") + "なところも持ち合わせています。";
}

export function diagnose(
  answers: Record<number, AnswerValue>,
): DiagnosisResult {
  const scores = calculateScores(answers);
  const typeId = classifyType(scores);
  const reasons = generateReasons(scores);
  const supplement = generateSupplement(scores);
  return { scores, typeId, reasons, supplement };
}
