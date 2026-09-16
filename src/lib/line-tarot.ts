// LINEトーク内「恋のタロット」(今日の1枚)。
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
    keyword: "答えを急がず、本音を見つける",
    image: "/tarot/line/moon.jpg",
    summary:
      "月は、不安や想像がふくらみやすいときに現れるカード。今は相手の反応から答えを決めるより、自分が本当は何を知りたいのか整理すると、恋の迷いが少しずつほどけそうです。",
    details: [
      {
        title: "恋の流れ",
        text: "今日は関係を急いで動かすより、見えている事実を確かめるのに向いています。",
      },
      {
        title: "気をつけること",
        text: "返信の速さや短い言葉だけで、脈あり・脈なしを決めつけないで。",
      },
      {
        title: "恋の一歩",
        text: "不安に思っていることをメモに書き、事実と想像の2つに分けてみて。",
      },
    ],
  },
  star: {
    title: "XVII 星",
    keyword: "素直な希望を、もう一度信じる",
    image: "/tarot/line/star.jpg",
    summary:
      "星は、恋に抱いている素直な願いを思い出させるカード。うまくいくかを先に考えるより、どんな関係を育てたいのかを大切にすると、次の一歩が見えやすくなります。",
    details: [
      {
        title: "恋の流れ",
        text: "焦らず自然体でいるほど、あなたの魅力が伝わりやすい日です。",
      },
      {
        title: "気をつけること",
        text: "周りの恋愛と比べて、自分たちのペースを否定しないで。",
      },
      {
        title: "恋の一歩",
        text: "伝えたい気持ちをひとつ選び、飾らない短い言葉にしてみて。",
      },
    ],
  },
  sun: {
    title: "XIX 太陽",
    keyword: "素直な一歩が、恋を明るく動かす",
    image: "/tarot/line/sun.jpg",
    summary:
      "太陽は、素直な言葉と行動が恋を明るく動かすカード。相手にどう見られるかより、自分がうれしいと思える関わり方を選ぶと、関係にあたたかな変化が生まれそうです。",
    details: [
      {
        title: "恋の流れ",
        text: "待つよりも、明るく短いアクションを起こすのに向いています。",
      },
      {
        title: "気をつけること",
        text: "勢いで答えを求めすぎず、相手が返しやすい余白も残して。",
      },
      {
        title: "恋の一歩",
        text: "会いたい人に短い一言を送るか、気になる誘いにひとつ応じてみて。",
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
    `🃏 恋のタロット「${info.title}」`,
    `— ${info.keyword} —`,
    "",
    info.summary,
    "",
    ...info.details.map((d) => `・${d.title}: ${d.text}`),
    "",
    "カードを見て心に浮かんだことがあったら、そのまま聞かせてね。",
  ].join("\n");
}
