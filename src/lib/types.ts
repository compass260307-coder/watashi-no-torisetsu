export type BigFiveDimension = "E" | "A" | "O" | "C" | "N";

export type TorisetsuTypeId =
  | "festival-sun"
  | "everyones-home"
  | "wild-charisma"
  | "iron-mental"
  | "delicate-creator"
  | "healing-guardian"
  | "deep-dive-explorer"
  | "cool-maverick";

export interface Question {
  id: number;
  text: string;
  dimension: BigFiveDimension;
  reversed: boolean;
}

export interface FriendQuestion {
  id: number;
  text: string;
  type: "scale" | "choice";
  dimension?: BigFiveDimension;
  choices?: string[];
}

export interface DiagnosisResult {
  scores: Record<BigFiveDimension, number>;
  typeId: TorisetsuTypeId;
  reasons: string[];
  supplement: string;
}

export interface TorisetsuType {
  id: TorisetsuTypeId;
  name: string;
  emoji: string;
  color: string;
  subtitle: string;
  basicSpec: string;
  happyWords: string;
  weakEnvironment: string;
  handlingTips: string;
  energyBoost: string;
  hiddenAbility: string;
  unknownCharm: string;
  lovedQuirk: string;
}

export type AnswerValue = 1 | 2 | 3 | 4;

export interface FriendAnswerData {
  respondentName: string;
  answers: Record<number, AnswerValue | string>;
}
