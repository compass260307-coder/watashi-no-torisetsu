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
  /** 武器 (強み6項目・チェックリスト表示)。無料 = 未解放でも返す。null は素材欠損時のみ。 */
  weapons: ContentItem[] | null;
  /** 好かれやすい性格 (軸由来の文章・段落配列)。無料 = 未解放でも返す。 */
  likable: string[];
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

// ===== 武器の文体バリエーション =====
// 素材は全文「{B}さんは、/{B}さんには、」で始まるため、単純置換だと6項目とも
// 「友達は、〜」で単調になる (2026-07-13 指摘)。主語をインデックス別に散らし、
// 補足の一文 (汎用の称賛タグ) を足して 16P 風の2文構成にする。
const WEAPON_SUBJECT_WA = [
  "友達は、",
  "周りは、",
  "実は友達は、",
  "みんな、",
  "仲のいい友達ほど、",
  "気づけば周りは、",
];
const WEAPON_SUBJECT_NIWA = [
  "友達には、",
  "周りの目には、",
  "実は友達には、",
  "みんなの目には、",
  "仲のいい友達の目には、",
  "気づけば周りには、",
];
const WEAPON_TAIL = [
  "自分では当たり前でも、周りから見れば立派な特技。",
  "これができる人は、実はそんなに多くない。",
  "本人が思っているより、ずっと大きな武器。",
  "アナタがいるだけで、助かっている人がいる。",
  "気づいていないのは、たぶんアナタだけ。",
  "この安心感は、簡単には真似できない。",
];

function varyWeapons(items: ContentItem[]): ContentItem[] {
  return items.map((it, i) => {
    const body = it.body
      .replaceAll("{B}さんには、", WEAPON_SUBJECT_NIWA[i % WEAPON_SUBJECT_NIWA.length])
      .replaceAll("{B}さんは、", WEAPON_SUBJECT_WA[i % WEAPON_SUBJECT_WA.length])
      .replaceAll("{B}さん", "友達"); // 文中残り (係り方が違うもの) は従来どおり
    return { ...it, body: `${body}${WEAPON_TAIL[i % WEAPON_TAIL.length]}` };
  });
}

// ===== 好かれやすい性格 (無料・ルールベース・文章) =====
// 5軸の高低から流れのある文章 (3〜4段落) を組む。どちらに転んでも長所として書く
// (ネガをそのまま出さない)。段落構成: ①E (第一印象の魅力) ②A+C (人柄の信頼)
// ③O+N (一緒にいて得なところ) ④締め (固定)。
const LIKABLE_PROSE: Record<BigFiveDimension, Record<"H" | "L", string>> = {
  E: {
    H: "アナタの周りは、いつも少しにぎやか。アナタが来るだけで空気が軽くなって、「とりあえず呼ぼう」の一番手に挙がっている。本人が思っているより、その明るさに救われている友達はずっと多い。",
    L: "アナタの魅力は、静かな安心感。騒がないぶん、話をちゃんと受け止めてくれる人だと思われていて、二人きりのときのアナタが一番好かれている。「あの子には話せる」——そう思っている友達が、たぶんいる。",
  },
  A: {
    H: "それから、頼まれる前に動ける自然な気配り。アナタにとっては当たり前すぎて気づいていないけれど、その小さな優しさに周りは何度も救われている。",
    L: "それから、裏表のなさ。思ったことをそのまま言うから、アナタの褒め言葉には嘘がない。だからこそ、アナタに認められると特別に嬉しい——そんな存在になっている。",
  },
  C: {
    H: "約束も秘密もちゃんと守る誠実さで、「あいつなら大丈夫」の信頼が静かに積み上がっているのも大きい。",
    L: "きっちりしすぎないゆるさがあって、一緒にいると相手も肩の力が抜ける。それも立派な才能。",
  },
  O: {
    H: "話していて飽きない、というのもアナタの得なところ。「それ何?」から会話がどんどん転がっていくから、一緒にいる時間が長いほど好かれていく。",
    L: "流行に流されない安定感も、アナタの得なところ。いつ会っても同じテンションでいてくれる心地よさは、長く付き合うほど効いてくる。",
  },
  N: {
    H: "そして、誰かが沈んでいる時に最初に気づくのは、たぶんアナタ。何気ないその一言に救われた友達が、きっといる。",
    L: "そして、何が起きても慌てない余裕。そばにいるだけでなんだか安心する、と思われている。",
  },
};

const LIKABLE_CLOSING =
  "本人は無自覚かもしれないけれど、この組み合わせはかなり得な性格です。無理に盛らなくていい。いつものアナタのままで、ちゃんと好かれています。";

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
): string[] {
  const hl = (d: BigFiveDimension): "H" | "L" =>
    (typeof scores[d] === "number" ? (scores[d] as number) : 5) >= 5
      ? "H"
      : "L";
  const p = (d: BigFiveDimension) => LIKABLE_PROSE[d][hl(d)];
  return [
    p("E"),
    `${p("A")}${p("C")}`,
    `${p("O")}${p("N")}`,
    LIKABLE_CLOSING,
  ];
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
    weapons: perceived ? varyWeapons(perceived.strengths) : null,
    likable: buildLikable(scores),
    dislikable:
      opts.unlocked && perceived ? generalizeItems(perceived.surprises) : null,
    relations: opts.unlocked ? buildRelations(scores) : null,
    gapTeaser,
    locked: !opts.unlocked,
  };
}
