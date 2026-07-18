// 「友達から見た恋愛傾向 / あなたのモテポイントは実はここ」セクションのデータとロジック。
// 友達平均スコア (他者が付けた OCEAN) からモテ寄与度を出し、主/隠れのモテポイントを決定的に選ぶ。

import type { BigFiveDimension } from "./types";

export type MotePoint = {
  /** 軸ラベル (見出し用の短いキーワード)。 */
  keyword: string;
  /** 「あなたのモテポイントは実はここ」の主見出し (1行)。 */
  headline: string;
  /** 本文 (友達視点でモテる理由を掘り下げる)。 */
  body: string;
};

// 各軸が「モテ寄与度トップ」だったときの文言。E/A/O/C は高いとき、N は低いとき (安定) に出る。
const MOTE_BY_AXIS: Record<BigFiveDimension, MotePoint> = {
  E: {
    keyword: "一緒にいて楽しい",
    headline: "あなたのモテポイントは、その場を明るくする空気感。",
    body: "友達から見たあなたは、いるだけで場がぱっと華やぐ人。会話を回すのも、誰かの一言を拾って盛り上げるのも自然にできてしまう。本人は「ただ楽しんでるだけ」のつもりでも、周りは『この人といると退屈しない』と感じています。デートでも遊びでも、あなたと過ごす時間はいつも記憶に残る——それが、いちばんのモテポイントです。",
  },
  A: {
    keyword: "安心して隣にいられる",
    headline: "あなたのモテポイントは、そばにいてホッとする安心感。",
    body: "友達から見たあなたは、相手の気持ちにちゃんと気づいて、さりげなく寄り添える人。無理に盛り上げなくても、隣にいるだけで空気がやわらかくなる。この『一緒にいて疲れない』感覚は、実は恋愛でいちばん長続きする魅力です。本人は当たり前にやっているぶん気づいていないけれど、周りは『こういう人と付き合ったら幸せだろうな』とちゃんと見ています。",
  },
  O: {
    keyword: "一緒にいると世界が広がる",
    headline: "あなたのモテポイントは、話していて飽きない好奇心。",
    body: "友達から見たあなたは、知らないことや面白いものをたくさん持っている人。あなたと話すと『そんな見方があるんだ』と世界がひとつ広がる。同じ景色でも、あなたと見ると違って見える——その刺激が、相手をどんどん惹きつけます。本人は「好きなことを話してるだけ」でも、周りにとってあなたは『一緒にいると毎日が新しくなる人』なんです。",
  },
  C: {
    keyword: "ちゃんとしてて頼れる",
    headline: "あなたのモテポイントは、言葉より行動で示す誠実さ。",
    body: "友達から見たあなたは、約束を守る・任されたことをやり遂げる、その一つひとつが信頼になっている人。派手なアピールはしないけれど、『この人は言ったことを必ずやる』という安心感は、どんな甘い言葉より強い。本人は当たり前のつもりでも、周りは『こういう人こそ、いざという時に頼れる』とちゃんと見抜いています。それが、じわじわ効くモテポイントです。",
  },
  N: {
    keyword: "どんな時も動じない余裕",
    headline: "あなたのモテポイントは、隣にいて安心できる落ち着き。",
    body: "友達から見たあなたは、ちょっとしたことでは動じない、腰の据わった人。周りが慌てている時ほど、あなたの落ち着きが場を安定させる。この『一緒にいて振り回されない』余裕は、付き合うほどにありがたみが分かる魅力です。本人は自然体でいるだけでも、周りは『この人といると安心する』と、その包容力をちゃんと感じています。",
  },
};

export type FriendLoveContent = {
  /** 主モテポイント (寄与度トップの軸)。 */
  main: MotePoint;
  /** 隠れモテポイント (寄与度2番目の軸)。main と別軸。 */
  hidden: MotePoint;
};

/**
 * 友達平均スコアからモテポイントを決定的に選ぶ。数値のある軸だけを対象にする。
 * スコアが2軸未満なら null (セクション非表示)。
 */
export function resolveFriendLove(
  friendAvgScores: Partial<Record<BigFiveDimension, number>>,
): FriendLoveContent | null {
  const AXES: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  // モテ寄与度: E/A/O/C はそのまま、N は反転 (低いほど安定=モテ)。
  const contrib = AXES.map((ax) => {
    const v = friendAvgScores[ax];
    if (typeof v !== "number") return null;
    return { ax, score: ax === "N" ? 10 - v : v };
  }).filter((x): x is { ax: BigFiveDimension; score: number } => x !== null);

  if (contrib.length < 2) return null;

  contrib.sort((a, b) => b.score - a.score);
  return {
    main: MOTE_BY_AXIS[contrib[0].ax],
    hidden: MOTE_BY_AXIS[contrib[1].ax],
  };
}
