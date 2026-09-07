// LINEトーク内タロット (今日の1枚)。
//
// サイトの /tarot と同じ3枚 (月・星・太陽) のスクリプト読み。AI生成なしなので
// コストゼロ・無料枠非消費。カードは userId+JST日付で決定的に選ぶ =
// 同じ日に何度引いても「今日の1枚」は変わらない (占いの儀式感を守る)。
// 読み札の原文: src/components/tarot/TarotDrawExperience.tsx SINGLE_READINGS
// (サイト側を書き換えたらこちらも合わせること)

import { createHash } from "node:crypto";

export type LineTarotCard = "moon" | "star" | "sun";

export const LINE_TAROT_CARDS: Record<
  LineTarotCard,
  {
    title: string;
    keyword: string;
    image: string; // public 配下 (JPEG・LINE画像メッセージ用)
    summary: string;
    details: ReadonlyArray<{ title: string; text: string }>;
  }
> = {
  moon: {
    title: "XVIII 月",
    keyword: "曖昧さの中の本音",
    image: "/tarot/line/moon.jpg",
    summary:
      "月は、まだ言葉になっていない気持ちを急いで決めなくていいと伝えています。今日は答えよりも、自分が何に揺れているのかを丁寧に見つける日です。",
    details: [
      {
        title: "カードが示すこと",
        text: "曖昧さの奥にある小さな違和感が、本音へ戻る入口になります。",
      },
      {
        title: "今日の注意",
        text: "不安から結論を出したり、相手の気持ちを決めつけたりしないこと。",
      },
      {
        title: "今日の行動",
        text: "気になることをひとつ書き出し、事実と想像を分けてみて。",
      },
    ],
  },
  star: {
    title: "XVII 星",
    keyword: "希望を信じ直す",
    image: "/tarot/line/star.jpg",
    summary:
      "星は、希望を取り戻しながら自分の感覚を信じ直すカードです。今日は、すぐに答えを出すより、心が少し明るくなる方向を選ぶことが流れを整えます。",
    details: [
      {
        title: "カードが示すこと",
        text: "焦りを手放したときに、本当に望んでいる方向が見えてきます。",
      },
      {
        title: "今日の注意",
        text: "周りの正解に合わせるために、自分の小さな違和感を無視しないこと。",
      },
      {
        title: "今日の行動",
        text: "気になっていたことを、結果を求めず10分だけ始めてみて。",
      },
    ],
  },
  sun: {
    title: "XIX 太陽",
    keyword: "明るい前進",
    image: "/tarot/line/sun.jpg",
    summary:
      "太陽は、迷いの中に十分な光が差していることを伝えています。今日は遠慮して小さく収まるより、うれしいと思える方向へ素直に動くほど流れが開きます。",
    details: [
      {
        title: "カードが示すこと",
        text: "率直さと行動力が、停滞していた状況を明るく動かします。",
      },
      {
        title: "今日の注意",
        text: "勢いだけで約束を増やさず、できる範囲を確かめること。",
      },
      {
        title: "今日の行動",
        text: "先延ばしにしていた連絡を、短い一言から送ってみて。",
      },
    ],
  },
};

/** JSTの日付文字列 (YYYY-MM-DD)。引きロックのキーにも使う。 */
export function jstTarotDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const PERMUTATIONS: ReadonlyArray<readonly LineTarotCard[]> = [
  ["moon", "star", "sun"],
  ["moon", "sun", "star"],
  ["star", "moon", "sun"],
  ["star", "sun", "moon"],
  ["sun", "moon", "star"],
  ["sun", "star", "moon"],
];

/**
 * 今日の3枚の並び (裏向きの左・中・右)。userId+JST日付から決定的に決まるので、
 * どの位置を選んでも「その日その位置のカード」は変わらない (選び直しの再抽選不可)。
 */
export function dealLineTarotArrangement(
  userId: string,
): readonly LineTarotCard[] {
  const digest = createHash("sha256")
    .update(`line-tarot-deal\0${userId}\0${jstTarotDateKey()}`)
    .digest();
  return PERMUTATIONS[digest[0] % PERMUTATIONS.length];
}

/** トークに送る読み札テキスト。 */
export function formatLineTarotReading(card: LineTarotCard): string {
  const info = LINE_TAROT_CARDS[card];
  return [
    `🃏 今日の1枚「${info.title}」`,
    `— ${info.keyword} —`,
    "",
    info.summary,
    "",
    ...info.details.map((d) => `・${d.title}: ${d.text}`),
    "",
    "カードの続きが気になったら、そのまま話しかけてくださいね。",
  ].join("\n");
}
