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

// 温かい軸ラベルごとの、他己視点のあたたかい深掘り一文 (方向によらず常にポジティブ)。
// ネガ表現は出さず「愛されるクセ」に寄せる (WARM_AXIS_LABEL の 5 種に対応)。
const WARM_FLAVOR: Record<string, string> = {
  好奇心:
    "新しいことにためらわず飛び込んでいくアナタの姿は、周りの背中もそっと押しているみたい。まだ誰も気づいていない面白さを最初に見つけるのが、アナタの得意技だと思われているよ。",
  まじめさ:
    "やると決めたことを最後までやり切るアナタを、みんなは口に出さなくても信頼しているみたい。「あの人が言うなら大丈夫」——そんな安心を、知らないうちに周りに配っているよ。",
  社交性:
    "場の空気を明るくして人と人をつないでいくアナタは、いるだけでその場に安心をつくっているみたい。話しかけやすい雰囲気そのものが、みんなにとってのありがたさになっているよ。",
  優しさ:
    "困っている人にすっと気づいて動けるアナタの優しさは、言葉にされなくてもちゃんと伝わっているみたい。さりげない気づかいほど、受け取った側の記憶に長く残っているよ。",
  繊細さ:
    "細やかに気持ちを感じ取れるアナタのやわらかさを、みんなは大事な魅力として見ているみたい。人の小さな変化に気づけることは、そばにいる人の心強さになっているよ。",
};

/**
 * ②「みんなの目」固定プローズ (AIを使わず deep から決定的に組み立てる)。
 *   P1: gap の方向 (友達が高く/低く見たか) で出し分ける導入。
 *   P2: ギャップ軸の温かい深掘り (WARM_FLAVOR)。
 *   P3: hiddenStrength (隠れた長所) があれば、その軸の深掘りも添える。
 *   P4: 見方の一致 (agreement) で締める。
 * 返り値は段落の配列 (呼び出し側で <p> 化)。ネガ表現は「愛されるクセ」に寄せる。
 */
// viewer: 「誰から見たか」の表示名 (例 "ゆかさん")。1人完結モデルの友達別シートで
// 指定すると「友達/みんな」をその名前に置き換える。省略時は従来の総称。
export function buildMinnaProse(deep: DeepDiveData, viewer?: string): string[] {
  const { gap, hiddenStrength, agreement } = deep;
  const diff = gap.otherPercent - gap.selfPercent;
  const paras: string[] = [];
  const who = viewer ?? "みんな"; // 主語 (〜は頼りにしている / 〜との見方の一致)
  const friendWord = viewer ?? "友達"; // 「友達の目には」の置き換え

  // P1: ギャップの方向
  if (diff >= 8) {
    // 友達のほうが高く見ている: 自己評価より周りが頼りにしている軸。
    paras.push(
      `${friendWord}の目には、自分が思うよりずっと「${gap.label}のある人」として映っているみたい。その${gap.label}を、アナタが思う以上に${who}は頼りにしているよ。自分では当たり前にやっていることが、周りにはしっかり届いているんだ。`,
    );
  } else if (diff <= -8) {
    // 友達のほうが低く見ている: 気を張らない姿として伝わっている。
    paras.push(
      `自分では「${gap.label}」を強めに出しているつもりでも、${friendWord}にはもう少し肩の力を抜いた姿として映っているみたい。気を張りすぎないその自然体こそ、まわりが安心して寄ってくる理由になっているよ。`,
    );
  } else {
    // ほぼ一致: 自己像と周りの印象が重なっている。
    paras.push(
      `「${gap.label}」の見え方は、自分と${who}でほとんど同じ。自己イメージと周りの印象がきれいに重なっているのは、アナタが素のままで人と関われている証拠だよ。`,
    );
  }

  // P2: ギャップ軸のあたたかい深掘り
  if (WARM_FLAVOR[gap.label]) {
    paras.push(WARM_FLAVOR[gap.label]);
  }

  // P3: 隠れた長所 (+ その軸の深掘りも添える)
  if (hiddenStrength) {
    const extra = WARM_FLAVOR[hiddenStrength.label] ?? "";
    paras.push(
      `それに、自分ではあまり気づいていない「${hiddenStrength.label}」も、${who}にはしっかり届いているみたい。${extra}`.trim(),
    );
  }

  // P4: 見方の一致で締める
  paras.push(
    agreement >= 70
      ? `${who}との見方の一致は${agreement}%。自分らしさが、そのまま周りに伝わっているみたい。今のアナタのままで、まわりはちゃんと受け取ってくれているよ。`
      : `${who}との見方の一致は${agreement}%。自分では当たり前だと思っている一面が、周りには新鮮に映っていることもあるみたい。まだ知られていない良さも、これから少しずつ伝わっていきそうだよ。`,
  );

  return paras;
}
