import type { BigFiveDimension } from "./types";

type FriendAnswerRecord = {
  answers: Record<string, string | number>;
};

const FRIEND_DIMENSION_MAP: Record<string, BigFiveDimension> = {
  "1": "E",
  "2": "A",
  "3": "O",
};

const DIMENSION_META: Record<
  string,
  { label: string; emoji: string }
> = {
  E: { label: "社交性", emoji: "🗣️" },
  A: { label: "協調性", emoji: "🤝" },
  O: { label: "好奇心", emoji: "🌈" },
};

const SCORE_LABELS: Record<BigFiveDimension, [string, string, string, string]> =
  {
    E: ["かなり人見知り", "ちょっと控えめ", "まあまあ話せる", "めっちゃ社交的"],
    A: [
      "マイペース寄り",
      "自分優先ぎみ",
      "まあまあ気配り上手",
      "かなり面倒見いい",
    ],
    O: ["安定志向", "変化は苦手ぎみ", "割と柔軟", "冒険心すごい"],
    C: ["自由人タイプ", "ゆるめ", "しっかりしてる", "超計画的"],
    N: ["鉄メンタル", "割と安定", "ちょっと繊細", "かなり繊細"],
  };

function getScoreLabel(score: number, dimension: BigFiveDimension): string {
  const labels = SCORE_LABELS[dimension];
  if (score < 1.75) return labels[0];
  if (score < 2.5) return labels[1];
  if (score < 3.25) return labels[2];
  return labels[3];
}

export interface GapItem {
  dimension: BigFiveDimension;
  label: string;
  emoji: string;
  selfScore: number;
  friendScore: number;
  selfLabel: string;
  friendLabel: string;
  gap: number;
}

function calculateFriendAverageScores(
  friendAnswers: FriendAnswerRecord[],
): Partial<Record<BigFiveDimension, number>> {
  const buckets: Partial<Record<BigFiveDimension, number[]>> = {};

  for (const friend of friendAnswers) {
    for (const [qId, dim] of Object.entries(FRIEND_DIMENSION_MAP)) {
      const value = friend.answers[qId];
      if (typeof value === "number") {
        (buckets[dim] ??= []).push(value);
      }
    }
  }

  const result: Partial<Record<BigFiveDimension, number>> = {};
  for (const dim of ["E", "A", "O"] as BigFiveDimension[]) {
    const values = buckets[dim];
    if (values && values.length > 0) {
      result[dim] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }
  return result;
}

export function computeGapAnalysis(
  selfScores: Record<BigFiveDimension, number>,
  friendAnswers: FriendAnswerRecord[],
): GapItem[] {
  const friendScores = calculateFriendAverageScores(friendAnswers);
  const items: GapItem[] = [];

  for (const dim of ["E", "A", "O"] as BigFiveDimension[]) {
    const friendScore = friendScores[dim];
    if (friendScore == null) continue;

    const selfScore = selfScores[dim];
    const meta = DIMENSION_META[dim];

    items.push({
      dimension: dim,
      label: meta.label,
      emoji: meta.emoji,
      selfScore,
      friendScore,
      selfLabel: getScoreLabel(selfScore, dim),
      friendLabel: getScoreLabel(friendScore, dim),
      gap: friendScore - selfScore,
    });
  }

  return items;
}

const GAP_TEMPLATES_HIGHER: Record<string, string> = {
  E: "あなたは自分の社交性を控えめに見ていますが、友達からは「もっと話せる人」と見られています。自分が思っているより、周りはあなたの存在に助けられています。",
  A: "あなたは自分の優しさを当たり前だと思っていますが、友達からは「めっちゃ気配りできる人」と見られています。あなたの気遣いは、ちゃんと届いています。",
  O: "あなたは自分を慎重派だと思っていますが、友達からは「柔軟で楽しめる人」と見られています。実はあなた、周りに新鮮さを与えています。",
};

const GAP_TEMPLATES_LOWER: Record<string, string> = {
  E: "あなたは自分を社交的だと思っていますが、友達からは「実は落ち着いてる人」と見られています。内面の穏やかさが、周りには安心感として伝わっています。",
  A: "あなたは自分を協調的だと思っていますが、友達からは「意外とマイペース」と見られています。それはあなたの芯の強さの表れかもしれません。",
  O: "あなたは自分を冒険好きだと思っていますが、友達からは「実は安定感がある人」と見られています。その落ち着きが、周りの支えになっています。",
};

export function generateGapSummary(gaps: GapItem[]): string {
  if (gaps.length === 0) return "";

  const sorted = [...gaps].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const biggest = sorted[0];

  if (Math.abs(biggest.gap) < 0.3) {
    return "自分の認識と友達からの評価がほぼ一致しています。自己理解がかなり正確なタイプです。素直に自分を見れているって、実はすごいこと。";
  }

  if (biggest.gap > 0) {
    return GAP_TEMPLATES_HIGHER[biggest.dimension] ?? "";
  }
  return GAP_TEMPLATES_LOWER[biggest.dimension] ?? "";
}
