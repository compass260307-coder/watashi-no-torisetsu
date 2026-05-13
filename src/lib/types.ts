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

// ── ファセット (10 個) ──
export type FacetId =
  | "E_assertiveness"   // E - 主張力
  | "E_warmth"          // E - 温かさ
  | "A_cooperation"     // A - 協力性
  | "A_sympathy"        // A - 共感性
  | "O_adventurousness" // O - 冒険性
  | "O_imagination"     // O - 想像力
  | "C_achievement"     // C - 達成欲求
  | "C_orderliness"     // C - 秩序性
  | "N_volatility"      // N - 感情爆発
  | "N_anxiety";        // N - 不安

// ファセットから親 dimension への対応 (運用便利)
export const FACET_TO_DIMENSION: Record<FacetId, BigFiveDimension> = {
  E_assertiveness: "E",
  E_warmth: "E",
  A_cooperation: "A",
  A_sympathy: "A",
  O_adventurousness: "O",
  O_imagination: "O",
  C_achievement: "C",
  C_orderliness: "C",
  N_volatility: "N",
  N_anxiety: "N",
};

// ファセットの日本語ラベル (UI 表示用)
export const FACET_LABELS: Record<FacetId, string> = {
  E_assertiveness: "主張力",
  E_warmth: "温かさ",
  A_cooperation: "協力性",
  A_sympathy: "共感性",
  O_adventurousness: "冒険性",
  O_imagination: "想像力",
  C_achievement: "達成欲求",
  C_orderliness: "秩序性",
  N_volatility: "感情爆発",
  N_anxiety: "不安",
};

// ── モディファイア ──
// 誠実性軸: C (計画派) vs F (自由派)
export type CModifier = "C" | "F";

// 神経症傾向軸: N (繊細派) vs R (鉄壁派)
export type NModifier = "N" | "R";

// モディファイア組み合わせ (例: "C-N", "F-R")
export type ModifierCode = `${CModifier}-${NModifier}`;

export interface Question {
  id: number;
  text: string;
  facetId: FacetId;            // NEW (必須)
  dimension: BigFiveDimension; // 既存（後方互換のため残す）
  reversed: boolean;
}

export interface FriendQuestion {
  id: number;
  text: string;
  type: "scale" | "choice";
  facetId?: FacetId;            // NEW: scale 質問用 (友達評価のファセット軸)
  dimension?: BigFiveDimension; // 既存（後方互換）
  choices?: string[];
}

export interface DiagnosisResult {
  // ── 既存 ──
  scores: Record<BigFiveDimension, number>;  // 5 因子スコア (0-10 にスケール化)
  typeId: TorisetsuTypeId;
  reasons: string[];                          // 既存 (Phase 2B で生成ロジック改修)
  supplement: string;                         // 既存

  // ── 新規 ──
  facetScores: Record<FacetId, number>;       // 10 ファセットスコア (0-10)
  cModifier: CModifier;                       // 誠実性モディファイア (C or F)
  nModifier: NModifier;                       // 神経症傾向モディファイア (N or R)
  fullCode: string;                           // 5 文字コード "EAO-C-N" 形式
  modifierLabel: string;                      // 例: "計画 × 繊細"
}

export interface TorisetsuType {
  id: TorisetsuTypeId;
  name: string;
  shortName: string;          // NEW: 「お祭り系」「実家系」等
  emoji: string;
  imageUrl?: string;
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
  detailDescription: string;
  traits: string[];
}

// 7 段階リッカートスケール
export type AnswerValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface FriendAnswerData {
  respondentName: string;
  answers: Record<number, AnswerValue | string>;
}
