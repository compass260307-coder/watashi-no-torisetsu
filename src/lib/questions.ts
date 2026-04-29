import type { Question } from "./types";

export const questions: Question[] = [
  // Extraversion（外向性）
  {
    id: 1,
    text: "初対面の人とでも、割とすぐ打ち解けられる",
    dimension: "E",
    reversed: false,
  },
  {
    id: 2,
    text: "大人数の集まりより、少人数で過ごすほうが落ち着く",
    dimension: "E",
    reversed: true,
  },
  {
    id: 3,
    text: "自分から「遊ぼう」と誘うことが多い",
    dimension: "E",
    reversed: false,
  },

  // Agreeableness（協調性）
  {
    id: 4,
    text: "友達の相談は、つい自分のことより優先してしまう",
    dimension: "A",
    reversed: false,
  },
  {
    id: 5,
    text: "グループの空気を読んで発言するほうだ",
    dimension: "A",
    reversed: false,
  },
  {
    id: 6,
    text: "意見が合わないとき、自分の意見を押し通すことが多い",
    dimension: "A",
    reversed: true,
  },

  // Openness（開放性）
  {
    id: 7,
    text: "「やったことないこと」に誘われると、つい乗ってしまう",
    dimension: "O",
    reversed: false,
  },
  {
    id: 8,
    text: "流行りものより、自分の「好き」を追求したい",
    dimension: "O",
    reversed: false,
  },
  {
    id: 9,
    text: "旅行は計画をしっかり立てたい派だ",
    dimension: "O",
    reversed: true,
  },

  // Conscientiousness（誠実性）
  {
    id: 10,
    text: "課題やタスクの締め切りは、余裕を持って守るほうだ",
    dimension: "C",
    reversed: false,
  },
  {
    id: 11,
    text: "部屋やカバンの中は、わりと整理されている",
    dimension: "C",
    reversed: false,
  },
  {
    id: 12,
    text: "思いつきで動くより、計画を立ててから動きたい",
    dimension: "C",
    reversed: false,
  },

  // Neuroticism（感受性）
  {
    id: 13,
    text: "人の言葉が気になって、夜ふと考え込むことがある",
    dimension: "N",
    reversed: false,
  },
  {
    id: 14,
    text: "テストや発表の前は、不安で何度も確認してしまう",
    dimension: "N",
    reversed: false,
  },
  {
    id: 15,
    text: "嬉しいことも悲しいことも、人より感情の波が大きいと思う",
    dimension: "N",
    reversed: false,
  },
];

export const answerOptions = [
  { value: 4 as const, label: "めっちゃ当てはまる" },
  { value: 3 as const, label: "まあまあ当てはまる" },
  { value: 2 as const, label: "あんまり当てはまらない" },
  { value: 1 as const, label: "ぜんぜん当てはまらない" },
];
