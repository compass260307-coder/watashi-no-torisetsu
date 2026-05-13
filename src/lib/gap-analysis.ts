import type { BigFiveDimension, FacetId } from "./types";
import { FACET_LABELS, FACET_TO_DIMENSION } from "./types";

type FriendAnswerRecord = {
  answers: Record<string, string | number>;
};

// 既存 (Dim レベル) — 0-10 スケールに変更
export interface GapItem {
  dimension: BigFiveDimension;
  label: string;
  emoji: string;
  selfScore: number; // 0-10
  friendScore: number; // 0-10
  selfLabel: string;
  friendLabel: string;
  gap: number; // friendScore - selfScore (範囲 -10 〜 +10)
}

// 新規 (Facet レベル)
export interface FacetGapItem {
  facetId: FacetId;
  label: string;
  dimension: BigFiveDimension;
  selfScore: number;
  friendScore: number;
  selfLabel: string;
  friendLabel: string;
  gap: number;
}

const DIMENSION_META: Record<
  BigFiveDimension,
  { label: string; emoji: string }
> = {
  E: { label: "社交性", emoji: "🗣️" },
  A: { label: "協調性", emoji: "🤝" },
  O: { label: "好奇心", emoji: "🌈" },
  C: { label: "計画性", emoji: "📋" },
  N: { label: "繊細さ", emoji: "💧" },
};

// 0-10 スケール、4 段階ラベル
const DIMENSION_SCORE_LABELS: Record<
  BigFiveDimension,
  [string, string, string, string]
> = {
  E: ["かなり人見知り", "ちょっと控えめ", "まあまあ話せる", "めっちゃ社交的"],
  A: [
    "マイペース寄り",
    "自分優先ぎみ",
    "まあまあ気配り上手",
    "かなり面倒見いい",
  ],
  O: ["安定志向", "変化は苦手ぎみ", "割と柔軟", "冒険心すごい"],
  C: ["衝動的", "やや衝動派", "やや計画派", "計画的"],
  N: ["メンタル安定", "割と安定", "やや繊細", "繊細派"],
};

// ファセット用ラベル
const FACET_SCORE_LABELS: Record<
  FacetId,
  [string, string, string, string]
> = {
  E_assertiveness: ["かなり控えめ", "控えめ", "わりと主張", "めっちゃ主張"],
  E_warmth: ["距離感あり", "ややクール", "温かめ", "すごく温かい"],
  A_cooperation: ["マイペース", "やや自分軸", "協調的", "めっちゃ協調"],
  A_sympathy: ["わりとクール", "共感薄め", "共感あり", "めっちゃ共感"],
  O_adventurousness: ["安定志向", "慎重め", "冒険心あり", "めっちゃ冒険"],
  O_imagination: ["現実派", "やや現実派", "想像豊か", "妄想暴走"],
  C_achievement: ["のんびり派", "目標ゆるめ", "達成志向", "超達成志向"],
  C_orderliness: ["わりと散らかし", "自由派", "整理整頓", "几帳面"],
  N_volatility: ["鋼メンタル", "わりと安定", "感情豊か", "感情の波大"],
  N_anxiety: ["心配ゼロ", "わりと楽天", "ちょい不安", "心配性"],
};

// 0-10 スケールで 4 段階に分類
function getScoreLabel(
  score: number,
  labels: [string, string, string, string],
): string {
  if (score < 2.5) return labels[0];
  if (score < 5.0) return labels[1];
  if (score < 7.5) return labels[2];
  return labels[3];
}

function getDimensionScoreLabel(
  score: number,
  dim: BigFiveDimension,
): string {
  return getScoreLabel(score, DIMENSION_SCORE_LABELS[dim]);
}

function getFacetScoreLabel(score: number, facetId: FacetId): string {
  return getScoreLabel(score, FACET_SCORE_LABELS[facetId]);
}

// 友達スケール質問 (id 1-10) → facetId のマッピング
const FRIEND_QUESTION_ID_TO_FACET: Record<string, FacetId> = {
  "1": "E_assertiveness",
  "2": "E_warmth",
  "3": "A_cooperation",
  "4": "A_sympathy",
  "5": "O_adventurousness",
  "6": "O_imagination",
  "7": "C_achievement",
  "8": "C_orderliness",
  "9": "N_volatility",
  "10": "N_anxiety",
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

/**
 * 友達回答 (多人数) からファセットスコア平均を算出。
 * - 各 facet は friend scale 質問 1 問 (id 1-10)
 * - 1-7 → 0-10 スケール変換
 */
export function calculateFriendFacetScores(
  friendAnswers: FriendAnswerRecord[],
): Partial<Record<FacetId, number>> {
  const buckets: Partial<Record<FacetId, number[]>> = {};

  for (const friend of friendAnswers) {
    for (const [qId, facetId] of Object.entries(FRIEND_QUESTION_ID_TO_FACET)) {
      const value = friend.answers[qId];
      if (typeof value === "number") {
        const scaled = ((value - 1) / 6) * 10;
        (buckets[facetId] ??= []).push(scaled);
      }
    }
  }

  const result: Partial<Record<FacetId, number>> = {};
  for (const facetId of ALL_FACETS) {
    const values = buckets[facetId];
    if (values && values.length > 0) {
      result[facetId] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }
  return result;
}

/**
 * 友達ファセットスコアから dim スコア (各 dim の 2 facet 平均) を算出。
 */
function calculateFriendDimensionScores(
  facetScores: Partial<Record<FacetId, number>>,
): Partial<Record<BigFiveDimension, number>> {
  const buckets: Partial<Record<BigFiveDimension, number[]>> = {};

  for (const facetId of Object.keys(facetScores) as FacetId[]) {
    const score = facetScores[facetId];
    if (score === undefined) continue;
    const dim = FACET_TO_DIMENSION[facetId];
    (buckets[dim] ??= []).push(score);
  }

  const result: Partial<Record<BigFiveDimension, number>> = {};
  for (const dim of ["E", "A", "O", "C", "N"] as BigFiveDimension[]) {
    const values = buckets[dim];
    if (values && values.length > 0) {
      result[dim] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }
  return result;
}

/**
 * ディメンション (5 因子) レベルのギャップ分析。
 * 既存 API シグネチャを維持しつつ、内部を 0-10 + facet 経由に刷新。
 */
export function computeGapAnalysis(
  selfScores: Record<BigFiveDimension, number>,
  friendAnswers: FriendAnswerRecord[],
): GapItem[] {
  const friendFacetScores = calculateFriendFacetScores(friendAnswers);
  const friendDimScores = calculateFriendDimensionScores(friendFacetScores);
  const items: GapItem[] = [];

  for (const dim of ["E", "A", "O", "C", "N"] as BigFiveDimension[]) {
    const friendScore = friendDimScores[dim];
    if (friendScore === undefined) continue;

    const selfScore = selfScores[dim];
    const meta = DIMENSION_META[dim];

    items.push({
      dimension: dim,
      label: meta.label,
      emoji: meta.emoji,
      selfScore,
      friendScore,
      selfLabel: getDimensionScoreLabel(selfScore, dim),
      friendLabel: getDimensionScoreLabel(friendScore, dim),
      gap: friendScore - selfScore,
    });
  }

  return items;
}

/**
 * ファセット (10 軸) レベルのギャップ分析。
 * 自他比較の解像度が大幅に上がる。
 */
export function computeFacetGapAnalysis(
  selfFacetScores: Record<FacetId, number>,
  friendAnswers: FriendAnswerRecord[],
): FacetGapItem[] {
  const friendFacetScores = calculateFriendFacetScores(friendAnswers);
  const items: FacetGapItem[] = [];

  for (const facetId of ALL_FACETS) {
    const friendScore = friendFacetScores[facetId];
    if (friendScore === undefined) continue;

    const selfScore = selfFacetScores[facetId];
    const dim = FACET_TO_DIMENSION[facetId];

    items.push({
      facetId,
      label: FACET_LABELS[facetId],
      dimension: dim,
      selfScore,
      friendScore,
      selfLabel: getFacetScoreLabel(selfScore, facetId),
      friendLabel: getFacetScoreLabel(friendScore, facetId),
      gap: friendScore - selfScore,
    });
  }

  return items;
}

// 0-10 スケールでの「ほぼ一致」しきい値 (約 10% 差以下)
const GAP_THRESHOLD = 1.0;

const GAP_TEMPLATES_HIGHER: Record<string, string> = {
  E: "あなたは自分の社交性を控えめに見ていますが、友達からは「もっと話せる人」と見られています。自分が思っているより、周りはあなたの存在に助けられています。",
  A: "あなたは自分の優しさを当たり前だと思っていますが、友達からは「めっちゃ気配りできる人」と見られています。あなたの気遣いは、ちゃんと届いています。",
  O: "あなたは自分を慎重派だと思っていますが、友達からは「柔軟で楽しめる人」と見られています。実はあなた、周りに新鮮さを与えています。",
  C: "あなたは自分を自由派だと思っていますが、友達からは「実は計画的にやってる」と見られています。あなたの段取りは、ちゃんと評価されています。",
  N: "あなたは自分を鉄壁メンタルだと思っていますが、友達からは「実は繊細な部分もある」と見られています。本当の強さは、繊細さも含めて持ってるところです。",
};

const GAP_TEMPLATES_LOWER: Record<string, string> = {
  E: "あなたは自分を社交的だと思っていますが、友達からは「実は落ち着いてる人」と見られています。内面の穏やかさが、周りには安心感として伝わっています。",
  A: "あなたは自分を協調的だと思っていますが、友達からは「意外とマイペース」と見られています。それはあなたの芯の強さの表れかもしれません。",
  O: "あなたは自分を冒険好きだと思っていますが、友達からは「実は安定感がある人」と見られています。その落ち着きが、周りの支えになっています。",
  C: "あなたは自分を計画的だと思っていますが、友達からは「もっと自由な人」と見られています。あなたの柔軟さは、周りには心地よく映っています。",
  N: "あなたは自分を繊細だと思っていますが、友達からは「メンタル強い人」と見られています。気づかないうちに、あなたは強さを発揮しています。",
};

export function generateGapSummary(gaps: GapItem[]): string {
  if (gaps.length === 0) return "";

  const sorted = [...gaps].sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
  );
  const biggest = sorted[0];

  if (Math.abs(biggest.gap) < GAP_THRESHOLD) {
    return "自分の認識と友達からの評価がほぼ一致しています。自己理解がかなり正確なタイプです。素直に自分を見れているって、実はすごいこと。";
  }

  if (biggest.gap > 0) {
    return GAP_TEMPLATES_HIGHER[biggest.dimension] ?? "";
  }
  return GAP_TEMPLATES_LOWER[biggest.dimension] ?? "";
}

const FRIEND_TREND_HIGH: Record<string, string> = {
  E: "自分で思っているより、周りからは話しやすい人として見られています",
  A: "本人は普通だと思っていても、友達からは安心感があるタイプに見られています",
  O: "友達からは、一緒にいると新しい発見がある人と思われています",
  C: "友達からは、しっかり考えて動いてる人と思われています",
  N: "友達からは、感受性が豊かで繊細な部分があると見られています",
};

const FRIEND_TREND_LOW: Record<string, string> = {
  E: "友達からは、落ち着いていて信頼できる人だと思われています",
  A: "友達からは、自分の意見をしっかり持っている人だと見られています",
  O: "友達からは、安定感があって頼れる人だと思われています",
  C: "友達からは、自由で気軽に付き合える人と思われています",
  N: "友達からは、ブレない強さがある人と思われています",
};

export function generateFriendTrends(gaps: GapItem[]): string[] {
  const trends: string[] = [];

  for (const gap of gaps) {
    if (Math.abs(gap.gap) < GAP_THRESHOLD) continue;
    const templates = gap.gap > 0 ? FRIEND_TREND_HIGH : FRIEND_TREND_LOW;
    const text = templates[gap.dimension];
    if (text) trends.push(text);
  }

  return trends;
}
