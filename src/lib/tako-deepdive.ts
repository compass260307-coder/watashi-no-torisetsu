// タコ結果ページ ② 深掘りの自動生成データ。
//   スコア計算・タイプ判定には一切触れず、既存の perception-analysis.ts
//   (buildDimensionGaps / calcMutualUnderstanding) の結果から表示用の
//   「一致度・ギャップ一言・隠れた長所」を導出するだけ。
//
// 軸ラベルは、発散バー本体の臨床的ラベル (神経症傾向 等) ではなく、
//   プロダクト方針「ネガティブ表現は愛されるクセに変換」に沿った温かい名詞を使う
//   (仕様の文例『優しさ』『繊細さ』に準拠)。バー本体のラベルは変更しない。

import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "./perception-analysis";
import type { BigFiveDimension } from "./types";

// ② 一言テンプレート用の温かい軸名 (脇役トーン)。
const WARM_AXIS_LABEL: Record<BigFiveDimension, string> = {
  O: "好奇心",
  C: "まじめさ",
  E: "社交性",
  A: "優しさ",
  N: "繊細さ",
};

export type DeepDiveGap = {
  /** 温かい軸名 (例: 繊細さ) */
  label: string;
  /** 自己スコア % (0-100) */
  selfPercent: number;
  /** 友達平均 % (0-100) */
  otherPercent: number;
};

export type DeepDiveData = {
  /** 見方の一致 (相互理解度) %。 */
  agreement: number;
  /** 主役: 自己と友達の差が最大の軸。 */
  gap: DeepDiveGap;
  /** 脇役: 友達が自己より高く見た軸 (ギャップ軸と重複時は次点にフォールバック)。無ければ null。 */
  hiddenStrength: DeepDiveGap | null;
};

/**
 * 自己スコアと友達平均から ② 深掘りの表示データを導出する。
 * どちらかが欠損 (friendAvg=null) の場合は null。
 */
export function buildDeepDive(
  selfScores: BigFiveScores,
  friendAvgScores: BigFiveScores | null,
): DeepDiveData | null {
  if (!friendAvgScores) return null;

  const gaps = buildDimensionGaps(selfScores, friendAvgScores);
  if (gaps.length === 0) return null;

  const agreement = calcMutualUnderstanding(gaps);

  const toWarm = (g: (typeof gaps)[number]): DeepDiveGap => ({
    label: WARM_AXIS_LABEL[g.key],
    selfPercent: g.selfPercent,
    otherPercent: g.otherPercent,
  });

  // 主役: 差 (diffPoints) が最大の軸。同値は元の軸順 (perception-analysis の DIMENSIONS 順)。
  const byDiff = [...gaps].sort((a, b) => b.diffPoints - a.diffPoints);
  const gapAxis = byDiff[0];

  // 脇役 (隠れた長所): 友達が自己を上回った軸を差の大きい順。
  //   主役 (ギャップ軸) と同一軸になったら次点にフォールバックし、二重説明を避ける。
  const hiddenCandidates = gaps
    .filter((g) => g.otherPercent > g.selfPercent)
    .sort(
      (a, b) =>
        b.otherPercent - b.selfPercent - (a.otherPercent - a.selfPercent),
    );
  const hidden =
    hiddenCandidates.find((g) => g.key !== gapAxis.key) ?? null;

  return {
    agreement,
    gap: toWarm(gapAxis),
    hiddenStrength: hidden ? toWarm(hidden) : null,
  };
}

/** ギャップ一言。self がごく低いときは「ほぼゼロ」で柔らかく。 */
export function gapSentence(gap: DeepDiveGap): string {
  const selfText = gap.selfPercent <= 10 ? "ほぼゼロ" : `${gap.selfPercent}%`;
  return `一番のギャップは${gap.label}。自分では${selfText}、でも友達は${gap.otherPercent}%感じてる。`;
}

/** 隠れた長所の一言。 */
export function hiddenStrengthSentence(gap: DeepDiveGap): string {
  return `気づいてない強みは${gap.label}。自分で思うより高く見られてる。`;
}
