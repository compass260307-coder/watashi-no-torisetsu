// 第二部「友達から見たアナタ」本文のサーバ解決 (三層モデル Step2)。
//
// 構成 (2026-07-12 確定):
//   1. 友達から見たアナタの武器      … 無料 (未解放でも公開。バイラルの燃料)
//   2. 友達から嫌われやすい性格      … 🔒 友達3人 or ¥299
//   3. 友達から好かれやすい性格      … 無料 (未解放でも公開)
//   4. 関係別の見られ方 (友達/恋人/家族/上司) … 🔒 友達3人 or ¥299
//
// 中身は自己回答のタイプ/スコアから決定的に導出した"予測" (実際の友達回答は第三部 /tako)。
//
// deep-dive-resolve.ts と同じフェイルクローズ方針:
//   🔒ブロックの本文はサーバでこのヘルパに集約し、未解放時は null を返す
//   (本文が payload にもクライアントバンドルにも載らない)。
//
// 素材:
//   - 武器/嫌われやすい: perceivedByType32 (strengths/surprises) の流用。
//     {B}=友達名 差し込み前提の /tako 用素材なので {B}さん → 「友達」に置換。
//   - 好かれやすい/関係別: このファイル内のルールベース (軸の高低で決定。LLM不使用)。

import type { BigFiveDimension } from "./types";
import type { SixteenTypeId } from "./sixteen-types";
import type { ThirtyTwoTypeId } from "./thirty-two-types";
import {
  PERCEIVED_BY_TYPE,
  type ContentItem,
} from "./mutual-result-content";
import { perceivedByType32 } from "./thirty-two-content/perceived-by-type-32";

export type RelationView = {
  /** 関係ラベル (友達/恋人/家族/上司・先輩)。 */
  relation: string;
  body: string;
};

export type ResolvedPartTwo = {
  /** 武器 (強み6カード)。無料 = 未解放でも返す。null は素材欠損時のみ。 */
  weapons: ContentItem[] | null;
  /** 好かれやすい性格 (軸由来5カード)。無料 = 未解放でも返す。 */
  likable: ContentItem[];
  /** 嫌われやすい性格 (6カード)。🔒 null = 未解放 (本文を解決しない)。 */
  dislikable: ContentItem[] | null;
  /** 関係別の見られ方 (友達/恋人/家族/上司)。🔒 null = 未解放。 */
  relations: RelationView[] | null;
  /** ギャップ予告の一文 (無料メタ)。 */
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

// ===== 好かれやすい性格 (無料・ルールベース) =====
// 5軸それぞれの高低から「友達に好かれているポイント」を1枚ずつ。どちらに転んでも
// 長所として書く (ネガをそのまま出さない)。計 5 カード。
const LIKABLE: Record<BigFiveDimension, Record<"H" | "L", ContentItem>> = {
  E: {
    H: { title: "場が明るくなる", body: "アナタが来るだけで空気が軽くなる。「呼ぼう」の一番手に挙がるタイプ。" },
    L: { title: "聞き上手の安心感", body: "騒がないぶん、話をちゃんと受け止めてくれる。二人のときが一番好かれてる。" },
  },
  A: {
    H: { title: "自然な気配り", body: "頼まれる前に動く優しさ。本人が思っている以上に、周りはそれに救われてる。" },
    L: { title: "裏表のなさ", body: "思ったことをそのまま言うから、褒め言葉に嘘がない。信用の置ける正直さ。" },
  },
  O: {
    H: { title: "話題の引き出し", body: "「それ何?」から会話が転がる。一緒にいて飽きない人だと思われてる。" },
    L: { title: "ブレない安定感", body: "流行に流されず、いつも同じテンションでいてくれる。それが心地いい。" },
  },
  C: {
    H: { title: "約束を守る誠実さ", body: "時間も秘密もちゃんと守る。「あいつなら大丈夫」の信頼が積み上がってる。" },
    L: { title: "一緒にいて気楽", body: "きっちりしすぎないゆるさが、相手の肩の力も抜いてくれる。" },
  },
  N: {
    H: { title: "痛みに気づける繊細さ", body: "誰かが沈んでる時、最初に気づくのはアナタ。その一言に救われた友達がいる。" },
    L: { title: "動じない余裕", body: "トラブルでも慌てないから、そばにいるだけで安心感がある。" },
  },
};

// ===== 関係別の見られ方 (🔒・ルールベース) =====
// 関係ごとに効く2軸の高低 (2×2=4パターン) で本文を決定。トーンは伝聞・やわらか。
type Quad = "HH" | "HL" | "LH" | "LL";

const RELATION_FRIEND: Record<Quad, string> = {
  // E × A
  HH: "グループの中心にいる、ノリが良くて優しいやつ。遊びの誘いはまずアナタに声がかかるし、アナタが来る日は集まりの出席率が上がる。",
  HL: "言いたいことを言ってくれる、さっぱりした面白いやつ。遠慮がないから最初はひやっとさせるけど、裏で悪く言わない安心感で、長く付き合うほど信頼されていく。",
  LH: "静かだけど、いてくれると安心するやつ。大人数では目立たないのに、二人になると一番話しやすい。気づけば悩み相談が集まってくるタイプ。",
  LL: "群れない、自分の世界を持ってるやつ。付き合う相手は狭いけど、アナタが心を許した友達は、それをちょっと誇りに思ってる。",
};

const RELATION_LOVER: Record<Quad, string> = {
  // A × N
  HH: "相手の気持ちを先回りして動く、尽くすタイプ。その優しさは伝わってる。ただ我慢も一緒に溜めがちだから、恋人はアナタの本音をもっと聞きたいと思ってるかも。",
  HL: "一緒にいて楽な、包容力のある恋人。ぶつかることが少ないぶん、たまに「何を考えてるか分からない」と言われることも。言葉にした分だけ、ちゃんと伝わる。",
  LH: "好きな相手にだけ見せる顔がある、不器用な一途タイプ。素っ気なく見えて、心の中では相手のことをずっと考えてる。そのギャップに気づいた人が、離れられなくなる。",
  LL: "ベタベタしない、対等でさっぱりした恋人。束縛しない自由さが魅力。ただ、たまの「好き」のひと言が、相手にとって一番の安心材料になる。",
};

const RELATION_FAMILY: Record<Quad, string> = {
  // C × E
  HH: "家でも外でも頼られる、自慢の存在。何でも自分でやってしまうから、家族は頼られなくて少し寂しいくらい。",
  HL: "手がかからない、静かなしっかり者。「心配ない」と思われてるぶん、しんどい時ほど言葉にしないと気づいてもらえない。",
  LH: "にぎやかで憎めない、家のムードメーカー。散らかった部屋も含めて、キャラとして愛されてる。",
  LL: "マイペースで、家では省エネモード。外での頑張りが家族には見えにくいから、たまに近況をひと言話すだけで、けっこう喜ばれる。",
};

const RELATION_BOSS: Record<Quad, string> = {
  // C × A
  HH: "安心して任せられて、気配りもできる優等生。ただ都合よく頼られやすいから、たまには断ることも覚えていい。",
  HL: "仕事は確実、意見もはっきり言う戦力。生意気と紙一重だけど、結果で信頼を積んでいくタイプだと見られてる。",
  LH: "憎めない愛されキャラ。締切より人間関係で評価が保たれてる。ここぞの場面だけきっちり決めると、株が一気に上がる。",
  LL: "読めないけど、たまに大物感を出す存在。型にはめられるのが苦手なだけで、合う環境なら化けると思われてる。",
};

function buildRelations(
  scores: Partial<Record<BigFiveDimension, number>>,
): RelationView[] {
  const hi = (d: BigFiveDimension) =>
    (typeof scores[d] === "number" ? (scores[d] as number) : 5) >= 5;
  const quad = (a: BigFiveDimension, b: BigFiveDimension): Quad =>
    `${hi(a) ? "H" : "L"}${hi(b) ? "H" : "L"}` as Quad;
  return [
    { relation: "友達から", body: RELATION_FRIEND[quad("E", "A")] },
    { relation: "恋人から", body: RELATION_LOVER[quad("A", "N")] },
    { relation: "家族から", body: RELATION_FAMILY[quad("C", "E")] },
    { relation: "上司・先輩から", body: RELATION_BOSS[quad("C", "A")] },
  ];
}

function buildLikable(
  scores: Partial<Record<BigFiveDimension, number>>,
): ContentItem[] {
  const dims: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  return dims.map((d) => {
    const v = typeof scores[d] === "number" ? (scores[d] as number) : 5;
    return LIKABLE[d][v >= 5 ? "H" : "L"];
  });
}

/**
 * 第二部の本文を解決する。無料ブロック (武器/好かれやすい) は常に解決し、
 * 🔒ブロック (嫌われやすい/関係別) は unlocked=false なら解決しない (null)。
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

  // 武器/嫌われやすい: 32タイプ (全32キー投入済み) を優先、欠損時のみ 16タイプにフォールバック。
  const perceived =
    perceivedByType32[thirtyTwoId] ?? PERCEIVED_BY_TYPE[sixteenId] ?? null;

  return {
    weapons: perceived ? generalizeItems(perceived.strengths) : null,
    likable: buildLikable(scores),
    dislikable:
      opts.unlocked && perceived ? generalizeItems(perceived.surprises) : null,
    relations: opts.unlocked ? buildRelations(scores) : null,
    gapTeaser,
    locked: !opts.unlocked,
  };
}
