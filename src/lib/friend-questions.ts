import type { FriendQuestion } from "./types";

export const friendQuestions: FriendQuestion[] = [
  // ====== スケール式 10 問（各 facet 1 問、7 段階） ======
  {
    id: 1,
    text: "この人は、グループで意見が割れたら自分の考えをはっきり伝えるタイプだと思う",
    type: "scale",
    facetId: "E_assertiveness",
    dimension: "E",
  },
  {
    id: 2,
    text: "この人は、初対面の人にも自然に温かく接するタイプだと思う",
    type: "scale",
    facetId: "E_warmth",
    dimension: "E",
  },
  {
    id: 3,
    text: "この人は、自分のやり方より全体の流れを優先するタイプだと思う",
    type: "scale",
    facetId: "A_cooperation",
    dimension: "A",
  },
  {
    id: 4,
    text: "この人は、人の気持ちに敏感に共感するタイプだと思う",
    type: "scale",
    facetId: "A_sympathy",
    dimension: "A",
  },
  {
    id: 5,
    text: "この人は、新しいことに自分から飛び込むタイプだと思う",
    type: "scale",
    facetId: "O_adventurousness",
    dimension: "O",
  },
  {
    id: 6,
    text: "この人は、頭の中で色々空想してそうなタイプだと思う",
    type: "scale",
    facetId: "O_imagination",
    dimension: "O",
  },
  {
    id: 7,
    text: "この人は、目標を立ててそれに向かって動くタイプだと思う",
    type: "scale",
    facetId: "C_achievement",
    dimension: "C",
  },
  {
    id: 8,
    text: "この人は、身の回りや持ち物を整理整頓してるタイプだと思う",
    type: "scale",
    facetId: "C_orderliness",
    dimension: "C",
  },
  {
    id: 9,
    text: "この人は、感情が表に出やすいタイプだと思う",
    type: "scale",
    facetId: "N_volatility",
    dimension: "N",
  },
  {
    id: 10,
    text: "この人は、不安や心配が多いタイプだと思う",
    type: "scale",
    facetId: "N_anxiety",
    dimension: "N",
  },

  // ====== 選択式 3 問（エンゲージメント維持） ======
  {
    id: 11,
    text: "この人の「ここが好き！」と思うところは？",
    type: "choice",
    choices: [
      "一緒にいて楽しい",
      "安心感がある",
      "刺激をもらえる",
      "素でいられる",
    ],
  },
  {
    id: 12,
    text: "この人を動物に例えるなら？",
    type: "choice",
    choices: [
      "🦮 ゴールデンレトリバー（人懐っこい）",
      "🐱 猫（マイペース）",
      "🐺 オオカミ（芯が強い）",
      "🦦 カワウソ（好奇心旺盛）",
    ],
  },
  {
    id: 13,
    text: "この人で一番印象に残ってるシーンは？",
    type: "choice",
    choices: [
      "めちゃくちゃ笑った瞬間",
      "助けてもらった瞬間",
      "意外な一面を見た瞬間",
      "普通に過ごしてた何気ない時間",
    ],
  },
];

// 友達質問の回答スケール（自己診断と同じ 7 段階に統一）
export const friendAnswerOptions = [
  { value: 7 as const, label: "強くそう思う" },
  { value: 6 as const, label: "そう思う" },
  { value: 5 as const, label: "ややそう思う" },
  { value: 4 as const, label: "どちらでもない" },
  { value: 3 as const, label: "あまりそう思わない" },
  { value: 2 as const, label: "そう思わない" },
  { value: 1 as const, label: "強くそう思わない" },
];
