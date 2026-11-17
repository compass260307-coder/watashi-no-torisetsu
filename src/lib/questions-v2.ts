import type { FacetId, Question } from "./types";
import { FACET_TO_DIMENSION } from "./types";

// 自己診断 50 問の新セット (v2)。現行 (src/lib/questions.ts) と並存させ、比較検証に使う。
//
// 方針:
//   - 10 ファセット × 5 問 = 50 問は現行と同じ。採点 (src/lib/diagnosis.ts) はファセット単位なので流用できる。
//   - 「〜なタイプだ」という抽象的な自己評価をやめ、具体的な場面の本音を聞く。
//   - 出題順はファセットを混ぜる (1 ページ 10 問に 10 ファセットから 1 問ずつ)。
//   - id は表示順の通し番号 (1〜50)。途中再開のページ計算と設問到達の計測が
//     「id = 表示順」を前提にしているため、定義順ではなく表示順で採番する。
//
// 編集しやすさのため、定義はファセットごとにまとめ、表示順は DISPLAY_ORDER で別に持つ。

type Item = readonly [text: string, reversed: boolean];

const ITEMS_BY_FACET: ReadonlyArray<readonly [FacetId, readonly Item[]]> = [
  // 定義番号 1-5
  ["E_assertiveness", [
    ["話し合いで誰も発言しないとき、最初に口を開くのは自分であることが多い。", false],
    ["食事の行き先を決めるとき、「どこでもいい」と言わず自分から候補を出す。", false],
    ["飲食店で注文と違うものが運ばれてきても、何も言わずそのまま食べる。", true],
    ["相手が年上や立場が上の人でも、違うと思ったことはその場で伝える。", false],
    ["自己紹介の順番が回ってくるのは、できれば最後のほうがいい。", true],
  ]],
  // 定義番号 6-10
  ["E_warmth", [
    ["人から相談や打ち明け話をされることが多い。", false],
    ["誘われるのを待つより、自分から誘うことのほうが多い。", false],
    ["道で知り合いを見かけても、気づかれなければそのまま通り過ぎる。", true],
    ["うれしいことがあると、まず誰かに話したくなる。", false],
    ["仲のいい相手でも、休日に何をしているかはあまり知らない。", true],
  ]],
  // 定義番号 11-15
  ["A_cooperation", [
    ["意見が分かれたら、自分が折れたほうが早いと思う。", false],
    ["頼まれごとは、気が進まなくてもつい引き受けてしまう。", false],
    ["ゲームや勝負ごとは、相手が誰でも本気で勝ちにいく。", true],
    ["自分の分が終わったら、まだ終わっていない人を手伝いにいく。", false],
    ["人のやり方を見ていると、つい口を出したくなる。", true],
  ]],
  // 定義番号 16-20
  ["A_sympathy", [
    ["泣いている人を見ると、理由を知らなくてもつられそうになる。", false],
    ["映画やドラマで登場人物が恥をかく場面は、見ていられない。", false],
    ["人の悩みを聞いていると、内心「それで結論は？」と思うことがある。", true],
    ["相手の返事がいつもより短いと、何かあったのかと気になる。", false],
    ["相手が怒っている理由が、説明されるまで分からないことがある。", true],
  ]],
  // 定義番号 21-25
  ["O_adventurousness", [
    ["メニューに見たことのない料理があると、つい頼んでしまう。", false],
    ["行き先を決めずに出かけることがある。", false],
    ["気に入ったものは、同じものを何年も買い続けている。", true],
    ["「やったことがない」は、断る理由より行く理由になる。", false],
    ["引っ越しや異動など、環境が変わることはできれば避けたい。", true],
  ]],
  // 定義番号 26-30
  ["O_imagination", [
    ["嘘だと分かっている話でも、面白ければそれでいいと思う。", false],
    ["理屈で説明できない話ほど、興味をそそられる。", false],
    ["ぼーっとしているとき、頭の中は本当に何も考えていない。", true],
    ["映画や本の結末に納得がいかないと、自分で別の結末を考える。", false],
    ["「宝くじが当たったら」の話は、正直あまり盛り上がれない。", true],
  ]],
  // 定義番号 31-35
  ["C_achievement", [
    ["合格点が取れても、満点でないと少し悔しい。", false],
    ["使う予定がなくても、資格や級があると取りたくなる。", false],
    ["何もせず終わった休日でも、「いい日だった」と思える。", true],
    ["「初心者向け」と書かれていると、少し物足りなく感じる。", false],
    ["「5年後どうなっていたい？」と聞かれても、特に思い浮かばない。", true],
  ]],
  // 定義番号 36-40 (このファセットだけ 順方向 2 / 逆転 3)
  ["C_orderliness", [
    ["買い物は、買うものを決めてから店に行く。", false],
    ["アラームは、キリのいい時刻にセットする。", false],
    ["探し物をしている時間が、人より長いと思う。", true],
    ["説明書やレシピがあっても、結局は自己流で進める。", true],
    ["締め切りがあるものは、直前にならないと手をつけない。", true],
  ]],
  // 定義番号 41-45
  ["N_volatility", [
    ["イラっとしたら、つい顔や態度に出てしまう。", false],
    ["人前で、こらえきれずに泣いてしまったことがある。", false],
    ["かなり腹が立っていても、周りには気づかれない。", true],
    ["カッとなって送ったメッセージを、後から消したくなったことがある。", false],
    ["人に声を荒らげた記憶が、ほとんどない。", true],
  ]],
  // 定義番号 46-50
  ["N_anxiety", [
    ["少し体調が悪いと、「大きな病気かも」と調べてしまう。", false],
    ["家を出たあと、「鍵かけたっけ」と不安になる。", false],
    ["大事な予定の前夜でも、「なんとかなる」とすぐ眠れる。", true],
    ["会話が途切れると、「つまらないと思われたかな」と気になる。", false],
    ["道に迷っても、「そのうち着く」とあまり焦らない。", true],
  ]],
];

// 表示順。値は上の「定義番号」(ファセット順の通し番号 1〜50)。
// 1 行 = 1 ページ (10 問)。各ページに 10 ファセットから 1 問ずつ入り、
// 同じ因子 (E/A/O/C/N) の質問が隣り合わないように並べている。
const DISPLAY_ORDER: readonly number[] = [
  26, 7, 38, 44, 13, 32, 1, 25, 19, 50,
  21, 8, 46, 33, 14, 45, 27, 39, 2, 20,
  47, 22, 3, 34, 15, 41, 28, 9, 40, 16,
  36, 10, 29, 11, 48, 4, 23, 17, 35, 42,
  24, 5, 31, 18, 49, 30, 37, 12, 43, 6,
];

const DEFINED: ReadonlyArray<Omit<Question, "id">> = ITEMS_BY_FACET.flatMap(
  ([facetId, items]) =>
    items.map(([text, reversed]) => ({
      text,
      facetId,
      dimension: FACET_TO_DIMENSION[facetId],
      reversed,
    })),
);

export const questionsV2: Question[] = DISPLAY_ORDER.map(
  (definitionNumber, index) => ({
    id: index + 1,
    ...DEFINED[definitionNumber - 1],
  }),
);

/** 1 ファセット分の翻訳文 (上の ITEMS_BY_FACET と同じ並びの 5 問)。 */
export type QuestionV2FacetTexts = readonly [string, string, string, string, string];

/**
 * v2 の他言語版を作る。文だけを差し替え、id・出題順・ファセット・逆転は日本語版と同一にする。
 * サーバーの採点は「id → ファセット / 逆転」しか見ないので、どの言語の回答も
 * 日本語版と同じ v2 の定義で採点できる (src/lib/question-sets.ts)。
 */
export function localizeQuestionsV2(
  textsByFacet: Readonly<Record<FacetId, QuestionV2FacetTexts>>,
): Question[] {
  return DISPLAY_ORDER.map((definitionNumber, index) => {
    const base = DEFINED[definitionNumber - 1];
    return {
      ...base,
      id: index + 1,
      text: textsByFacet[base.facetId][(definitionNumber - 1) % 5],
    };
  });
}
