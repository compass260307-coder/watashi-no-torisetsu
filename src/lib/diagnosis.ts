import type {
  AnswerValue,
  BigFiveDimension,
  DiagnosisResult,
  TorisetsuTypeId,
} from "./types";
import { questions } from "./questions";

export function calculateScores(
  answers: Record<number, AnswerValue>
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
  scores: Record<BigFiveDimension, number>
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

export function diagnose(
  answers: Record<number, AnswerValue>
): DiagnosisResult {
  const scores = calculateScores(answers);
  const typeId = classifyType(scores);
  return { scores, typeId };
}
