import type { AnswerValue, TorisetsuTypeId } from "./types";

export type FriendPerception = {
  typeId: TorisetsuTypeId;
  confidence: "low" | "medium" | "high";
  scores: { E: number; A: number; O: number };
} | null;

export function perceiveFromFriendAnswers(
  answers: Record<number, AnswerValue | string>,
): FriendPerception {
  const e = answers[1];
  const a = answers[2];
  const o = answers[3];

  if (typeof e !== "number" || typeof a !== "number" || typeof o !== "number") {
    return null;
  }

  const scores = { E: e, A: a, O: o };

  const isHighE = e >= 2.5;
  const isHighA = a >= 2.5;
  const isHighO = o >= 2.5;

  let typeId: TorisetsuTypeId;
  if (isHighE && isHighA && isHighO) typeId = "festival-sun";
  else if (isHighE && isHighA && !isHighO) typeId = "everyones-home";
  else if (isHighE && !isHighA && isHighO) typeId = "wild-charisma";
  else if (isHighE && !isHighA && !isHighO) typeId = "iron-mental";
  else if (!isHighE && isHighA && isHighO) typeId = "delicate-creator";
  else if (!isHighE && isHighA && !isHighO) typeId = "healing-guardian";
  else if (!isHighE && !isHighA && isHighO) typeId = "deep-dive-explorer";
  else typeId = "cool-maverick";

  const isExtreme = (v: number) => v === 1 || v === 4;
  const extremeCount = [e, a, o].filter(isExtreme).length;

  let confidence: "low" | "medium" | "high";
  if (extremeCount >= 3) confidence = "high";
  else if (extremeCount >= 1) confidence = "medium";
  else confidence = "low";

  return { typeId, confidence, scores };
}
