import type { FriendQuestion } from "./types";

export const friendQuestions: FriendQuestion[] = [
  {
    id: 1,
    text: "知らない人がいる場でも、わりと自然に話せる",
    type: "scale",
    dimension: "E",
  },
  {
    id: 2,
    text: "困ってる人がいたら、自分のこと後回しにしてでも助ける",
    type: "scale",
    dimension: "A",
  },
  {
    id: 3,
    text: "急な予定変更とかハプニング、むしろ楽しんでる",
    type: "scale",
    dimension: "O",
  },
  {
    id: 4,
    text: "この人の「ここが好き！」と思うところは？",
    type: "choice",
    choices: [
      "一緒にいると楽しい",
      "安心感がある",
      "刺激をもらえる",
      "素でいられる",
    ],
  },
  {
    id: 5,
    text: "この人の、たぶん本人は気づいてない魅力は？",
    type: "choice",
    choices: [
      "実はめっちゃ繊細",
      "実はめっちゃ頼りになる",
      "実はめっちゃ面白い",
      "実はめっちゃ優しい",
    ],
  },
];

export const friendAnswerOptions = [
  { value: 4 as const, label: "めっちゃ当てはまる" },
  { value: 3 as const, label: "まあまあ当てはまる" },
  { value: 2 as const, label: "あんまり当てはまらない" },
  { value: 1 as const, label: "ぜんぜん当てはまらない" },
];
