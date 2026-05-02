import type { FriendQuestion } from "./types";

export const friendQuestions: FriendQuestion[] = [
  {
    id: 1,
    text: "この人は、知らない人がいる場でも自然に話せるタイプだと思う",
    type: "scale",
    dimension: "E",
  },
  {
    id: 2,
    text: "この人は、困ってる人がいたら自分のこと後回しにしてでも助けるタイプだと思う",
    type: "scale",
    dimension: "A",
  },
  {
    id: 3,
    text: "この人は、急な予定変更やハプニングも楽しめるタイプだと思う",
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
  {
    id: 6,
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
    id: 7,
    text: "この人が一番輝いて見える瞬間は？",
    type: "choice",
    choices: [
      "みんなの中心にいるとき",
      "誰かを助けているとき",
      "好きなことに没頭してるとき",
      "ひとりで静かに過ごしてるとき",
    ],
  },
  {
    id: 8,
    text: "この人と一緒にいるとき、自分はどんな感じ？",
    type: "choice",
    choices: [
      "完全に素のまま",
      "だいたい素",
      "ちょっと背伸びする",
      "いい意味で刺激される",
    ],
  },
  {
    id: 9,
    text: "この人のLINE、どんなイメージ？",
    type: "choice",
    choices: [
      "即レス・テンション高め",
      "マイペースだけど丁寧",
      "短文・スタンプ多め",
      "気分が乗った時にバーッと返してくる",
    ],
  },
  {
    id: 10,
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

export const friendAnswerOptions = [
  { value: 4 as const, label: "めっちゃ当てはまる" },
  { value: 3 as const, label: "まあまあ当てはまる" },
  { value: 2 as const, label: "あんまり当てはまらない" },
  { value: 1 as const, label: "ぜんぜん当てはまらない" },
];
