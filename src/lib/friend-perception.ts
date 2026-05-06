import type { AnswerValue, TorisetsuTypeId } from "./types";

export type FriendPerception = {
  typeId: TorisetsuTypeId;
  confidence: "low" | "medium" | "high";
  scores: { E: number; A: number; O: number; C: number; N: number };
} | null;

// Q9 (LINEイメージ) → 誠実性(C) のマッピング
export function mapQ9toC(answer: string): number {
  switch (answer) {
    case "マイペースだけど丁寧":
      return 4;
    case "気分が乗った時にバーッと返してくる":
      return 1;
    case "即レス・テンション高め":
      return 2.5;
    case "短文・スタンプ多め":
      return 2.5;
    default:
      return 2.5;
  }
}

// Q5 (隠れた魅力) → 神経症傾向(N) のマッピング
export function mapQ5toN(answer: string): number {
  switch (answer) {
    case "実はめっちゃ繊細":
      return 4;
    case "実はめっちゃ頼りになる":
      return 1;
    case "実はめっちゃ面白い":
      return 2.5;
    case "実はめっちゃ優しい":
      return 2.5;
    default:
      return 2.5;
  }
}

export function perceiveFromFriendAnswers(
  answers: Record<number, AnswerValue | string>,
): FriendPerception {
  const e = answers[1];
  const a = answers[2];
  const o = answers[3];

  if (typeof e !== "number" || typeof a !== "number" || typeof o !== "number") {
    return null;
  }

  const q5 = answers[5];
  const q9 = answers[9];
  const n = typeof q5 === "string" ? mapQ5toN(q5) : 2.5;
  const c = typeof q9 === "string" ? mapQ9toC(q9) : 2.5;

  const scores = { E: e, A: a, O: o, C: c, N: n };

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
