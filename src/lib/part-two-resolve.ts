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
  type ContentItem,
} from "./mutual-result-content";
import { perceivedByType32 } from "./thirty-two-content/perceived-by-type-32";
import { perceivedManualContent32 } from "./thirty-two-content/perceived-manual-32";

export type ResolvedPartTwo = {
  /** 強み6カード。null = 未解放 (本文を解決しない)。 */
  strengths: ContentItem[] | null;
  /** あれっ?な一面 (弱み) 6カード。null = 未解放。 */
  surprises: ContentItem[] | null;
  /** アナタの取扱い方 (接し方のコツ) の段落。null = 未解放 or 素材なし。 */
  manual: string[] | null;
  /** ギャップ予告の一文 (無料メタ。ロック時に出してもよい)。 */
  gapTeaser: string;
  locked: boolean;
};

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
      strengths: null,
      surprises: null,
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

  return {
    strengths: perceived ? generalizeItems(perceived.strengths) : null,
    surprises: perceived ? generalizeItems(perceived.surprises) : null,
    manual,
    gapTeaser,
    locked: false,
  };
}
