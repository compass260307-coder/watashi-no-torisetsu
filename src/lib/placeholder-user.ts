import type { BigFiveDimension } from "@/lib/types";

// Guest purchases need a users row before diagnosis, but users.scores/type_id are
// NOT NULL. Keep the neutral placeholder and every guard that recognizes it in
// one place so report links never render it as a real result.
export const PLACEHOLDER_SCORES: Record<BigFiveDimension, number> = {
  O: 5,
  C: 5,
  E: 5,
  A: 5,
  N: 5,
};

const PLACEHOLDER_SCORE_KEYS: readonly BigFiveDimension[] = [
  "O",
  "C",
  "E",
  "A",
  "N",
];

export function isPlaceholderScores(scores: unknown): boolean {
  if (scores === null || scores === undefined) return true;
  if (typeof scores !== "object" || Array.isArray(scores)) return true;
  const record = scores as Record<string, unknown>;
  return PLACEHOLDER_SCORE_KEYS.every(
    (key) => record[key] === PLACEHOLDER_SCORES[key],
  );
}

export function isUndiagnosedPlaceholderUser(
  user:
    | {
        diagnosis_completed_at?: string | null;
        scores: unknown;
      }
    | null
    | undefined,
): boolean {
  return (
    !!user &&
    !user.diagnosis_completed_at &&
    isPlaceholderScores(user.scores)
  );
}
