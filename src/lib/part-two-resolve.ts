// 第二部「友達から見たアナタ (予測)」本文のサーバ解決 (三層モデル Step2)。
//
// 三層モデルの第二部 = 見られ方の"予測"。実際の友達回答 (第三部 /tako) ではなく、
// 自己回答のタイプから決定的に導出する。解放条件は hasPartTwoAccess (友達3人 or ¥299)。
//
// deep-dive-resolve.ts と同じフェイルクローズ方針:
//   本文データ (perceivedByType32 / perceivedManualContent32) をクライアントから
//   import するとバンドル同梱で未解放でも読めてしまう。→ 解決はサーバ (/me) 側で
//   このヘルパに集約し、未解放時は null を返す (本文が payload に載らない)。
//
// 素材の流用と置換:
//   perceivedByType32 (強み6/あれっ?6) と perceivedManualContent32 (段落2=接し方のコツ)
//   は {B}=友達名 差し込み前提の /tako 用素材。第二部は特定の友達がいない"予測"なので、
//   {B}さん → 「友達」に置換した汎用文で出す。/tako では同素材が実名入りの本物として出る。

import type { BigFiveDimension } from "./types";
import type { SixteenTypeId } from "./sixteen-types";
import type { ThirtyTwoTypeId } from "./thirty-two-types";
import {
  PERCEIVED_BY_TYPE,
  FOUR_TRAITS,
  fourTraitBody,
  levelForScore,
  type ContentItem,
  type TraitLevel,
} from "./mutual-result-content";
import { perceivedByType32 } from "./thirty-two-content/perceived-by-type-32";
import { perceivedManualContent32 } from "./thirty-two-content/perceived-manual-32";

export type ResolvedPartTwo = {
  /** 第一印象 (初対面でどう見えるかの予測) の段落。null = 未解放。 */
  firstImpression: string[] | null;
  /** 強み6カード。null = 未解放 (本文を解決しない)。 */
  strengths: ContentItem[] | null;
  /** あれっ?な一面 (弱み) 6カード。null = 未解放。 */
  surprises: ContentItem[] | null;
  /** 友達から見た4つのステータス (頼れる度/ノリの良さ/本音の見せ方/距離の取り方)。null = 未解放。 */
  stats: { label: string; level: TraitLevel; body: string; color: string }[] | null;
  /** アナタの取扱い方 (接し方のコツ) の段落。null = 未解放 or 素材なし。 */
  manual: string[] | null;
  /** ギャップ予告の一文 (無料メタ。ロック時に出してもよい)。 */
  gapTeaser: string;
  locked: boolean;
};

// ===== 第一印象 (新規・ルールベース) =====
// 初対面の印象は主に E (自分から出るか) × A (感じの良さ) で決まり、N が緊張の乗り方を
// 変える、という整理。E×A の4象限 + N の一文で決定的に組む (LLM不使用・B-1思想)。
// トーンは他ブロックと同じ「伝聞・愛されるクセ変換」(ネガをそのまま出さない)。
const FIRST_IMPRESSION_BASE: Record<"HH" | "HL" | "LH" | "LL", string> = {
  HH: "初対面のアナタは、たぶん「感じよくてノリのいい人」。自分から話しかけるし、相手の話にもちゃんと笑う。第一印象では、かなり得をしている側のはず。",
  HL: "初対面のアナタは「物おじしない人」。思ったことをまっすぐ話すから、最初はちょっと強そうに見られがち。でも裏表のなさが伝わった瞬間、その印象は一気に信頼へ変わる。",
  LH: "初対面のアナタは「物静かだけど、感じのいい人」。自分からぐいぐいは行かないぶん、相槌ややわらかい空気で好印象を残す。仲良くなるほど評価が上がる、後伸びタイプ。",
  LL: "初対面のアナタは、ちょっとミステリアス。口数が少なくて、最初は壁があるように見られることも。でもそのぶん、心を開いた相手に「選ばれた感」を渡せる人。",
};
const FIRST_IMPRESSION_N: Record<"N" | "R", string> = {
  N: "そして初対面の場では、けっこう気を張っているはず。帰り道でどっと疲れるのは、それだけ相手の空気を読んでいる証拠。",
  R: "そして初対面でも、あまり緊張しない。その自然体の余裕が、相手にも安心感を与えている。",
};

function buildFirstImpression(
  scores: Partial<Record<BigFiveDimension, number>>,
): string[] {
  const hi = (d: BigFiveDimension) =>
    (typeof scores[d] === "number" ? (scores[d] as number) : 5) >= 5;
  const quad = `${hi("E") ? "H" : "L"}${hi("A") ? "H" : "L"}` as
    | "HH"
    | "HL"
    | "LH"
    | "LL";
  return [FIRST_IMPRESSION_BASE[quad], FIRST_IMPRESSION_N[hi("N") ? "N" : "R"]];
}

const AXIS_LABEL: Record<BigFiveDimension, string> = {
  E: "外向性",
  A: "協調性",
  O: "開放性",
  C: "誠実性",
  N: "繊細さ",
};

/** {B}さん (友達名プレースホルダ) を「友達」に置換した汎用文にする。 */
function generalize(text: string): string {
  return text.replaceAll("{B}さん", "友達");
}

function generalizeItems(items: ContentItem[]): ContentItem[] {
  return items.map((it) => ({ ...it, body: generalize(it.body) }));
}

/**
 * 第二部の本文を解決する。unlocked=false なら本文は一切解決しない (null)。
 * gapTeaser だけはスコア由来の無料メタとして常に返す。
 */
export function resolvePartTwo(
  thirtyTwoId: ThirtyTwoTypeId,
  sixteenId: SixteenTypeId,
  scores: Partial<Record<BigFiveDimension, number>>,
  opts: { unlocked: boolean },
): ResolvedPartTwo {
  // ギャップ予告: 自己スコアの最大軸を挙げ、第三部 (本物) への期待を作る。
  const dims: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  const val = (d: BigFiveDimension) =>
    typeof scores[d] === "number" ? (scores[d] as number) : 5;
  const topDim = dims.reduce((a, b) => (val(b) > val(a) ? b : a));
  const gapTeaser = `アナタが自分でいちばん強いと思っている「${AXIS_LABEL[topDim]}」。友達の目には、違う濃さで映っているかも。`;

  if (!opts.unlocked) {
    return {
      firstImpression: null,
      strengths: null,
      surprises: null,
      stats: null,
      manual: null,
      gapTeaser,
      locked: true,
    };
  }

  // 強み/あれっ?: 32タイプ (全32キー投入済み) を優先、欠損時のみ 16タイプにフォールバック。
  const perceived =
    perceivedByType32[thirtyTwoId] ?? PERCEIVED_BY_TYPE[sixteenId] ?? null;

  // 取扱い方: perceived-manual-32 の段落2 (①描写 / ②コツ のうちコツ側) を使う。
  const manualRaw = perceivedManualContent32[thirtyTwoId];
  const manualParas = manualRaw ? manualRaw.split("\n\n") : [];
  const manual = manualParas.length >= 2 ? [manualParas[1]] : null;

  // 4つのステータス: 既存の対人特性部品 (FOUR_TRAITS × 高/中/低 本文) を自己スコアで
  // 予測解決。本文の {B}さん は「友達」に置換。
  const stats = FOUR_TRAITS.map((t) => {
    const level = levelForScore(
      typeof scores[t.dim] === "number" ? (scores[t.dim] as number) : 5,
    );
    return {
      label: t.label,
      level,
      body: generalize(fourTraitBody(t.label, level)),
      color: t.color,
    };
  });

  return {
    firstImpression: buildFirstImpression(scores),
    strengths: perceived ? generalizeItems(perceived.strengths) : null,
    surprises: perceived ? generalizeItems(perceived.surprises) : null,
    stats,
    manual,
    gapTeaser,
    locked: false,
  };
}
