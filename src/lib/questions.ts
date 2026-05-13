import type { FacetId, Question } from "./types";

export const questions: Question[] = [
  // ====== E - 主張力 (Assertiveness) Q1-Q5 ======
  { id: 1, text: "グループで意見が割れたとき、自分の考えをはっきり伝える方だ。", facetId: "E_assertiveness", dimension: "E", reversed: false },
  { id: 2, text: "みんなで「どこ行く？」となったら、自分から候補を出す。", facetId: "E_assertiveness", dimension: "E", reversed: false },
  { id: 3, text: "言いたいことがあっても、空気を読んで飲み込むことが多い。", facetId: "E_assertiveness", dimension: "E", reversed: true },
  { id: 4, text: "違うと思ったら、相手が誰でも「いや、それは」と言える。", facetId: "E_assertiveness", dimension: "E", reversed: false },
  { id: 5, text: "大勢の前で発表とか、できれば避けたいタイプだ。", facetId: "E_assertiveness", dimension: "E", reversed: true },

  // ====== E - 温かさ (Warmth) Q6-Q10 ======
  { id: 6, text: "初対面の人とでも、わりとすぐ仲良くなれる。", facetId: "E_warmth", dimension: "E", reversed: false },
  { id: 7, text: "友達が元気なさそうだと、こっちから話しかけにいく。", facetId: "E_warmth", dimension: "E", reversed: false },
  { id: 8, text: "知らない人と話すのは、できれば避けたい。", facetId: "E_warmth", dimension: "E", reversed: true },
  { id: 9, text: "人と話してると、自然と笑顔になっている。", facetId: "E_warmth", dimension: "E", reversed: false },
  { id: 10, text: "自分から人に深入りすることは少ない方だ。", facetId: "E_warmth", dimension: "E", reversed: true },

  // ====== A - 協力性 (Cooperation) Q11-Q15 ======
  { id: 11, text: "グループ作業では、自分の意見より全体の流れを優先する。", facetId: "A_cooperation", dimension: "A", reversed: false },
  { id: 12, text: "友達と意見が違っても、結局相手に合わせることが多い。", facetId: "A_cooperation", dimension: "A", reversed: false },
  { id: 13, text: "自分のやり方を曲げてまで、人に合わせたくない。", facetId: "A_cooperation", dimension: "A", reversed: true },
  { id: 14, text: "みんなが楽しめるなら、自分が我慢するのは平気だ。", facetId: "A_cooperation", dimension: "A", reversed: false },
  { id: 15, text: "「自分の意見を通したい」と思うことがよくある。", facetId: "A_cooperation", dimension: "A", reversed: true },

  // ====== A - 共感性 (Sympathy) Q16-Q20 ======
  { id: 16, text: "友達が泣いてると、つられて泣きそうになる。", facetId: "A_sympathy", dimension: "A", reversed: false },
  { id: 17, text: "映画や漫画で、登場人物の気持ちに入り込みやすい。", facetId: "A_sympathy", dimension: "A", reversed: false },
  { id: 18, text: "人の感情の起伏には、わりと無関心なほうだ。", facetId: "A_sympathy", dimension: "A", reversed: true },
  { id: 19, text: "友達の表情が少し変わるだけで、何かあったか気になる。", facetId: "A_sympathy", dimension: "A", reversed: false },
  { id: 20, text: "「気持ちを察してほしい」と言われても、よく分からない。", facetId: "A_sympathy", dimension: "A", reversed: true },

  // ====== O - 冒険性 (Adventurousness) Q21-Q25 ======
  { id: 21, text: "「行ったことない店」と聞くと、つい行きたくなる。", facetId: "O_adventurousness", dimension: "O", reversed: false },
  { id: 22, text: "旅行先では、定番より地元の人しか知らない場所を選ぶ。", facetId: "O_adventurousness", dimension: "O", reversed: false },
  { id: 23, text: "新しい場所より、慣れた場所のほうが落ち着く。", facetId: "O_adventurousness", dimension: "O", reversed: true },
  { id: 24, text: "「やったことないこと」に誘われると、わりと乗る。", facetId: "O_adventurousness", dimension: "O", reversed: false },
  { id: 25, text: "初めての経験には、つい慎重になってしまう。", facetId: "O_adventurousness", dimension: "O", reversed: true },

  // ====== O - 想像力 (Imagination) Q26-Q30 ======
  { id: 26, text: "ぼーっとしてる時、頭の中で勝手にストーリーが浮かぶ。", facetId: "O_imagination", dimension: "O", reversed: false },
  { id: 27, text: "同じ景色を見ても、人より色々考えてる気がする。", facetId: "O_imagination", dimension: "O", reversed: false },
  { id: 28, text: "空想や妄想にふけることは、ほとんどない。", facetId: "O_imagination", dimension: "O", reversed: true },
  { id: 29, text: "「もし○○だったら」を想像するのが好きだ。", facetId: "O_imagination", dimension: "O", reversed: false },
  { id: 30, text: "現実的なことだけ考えていたいタイプだ。", facetId: "O_imagination", dimension: "O", reversed: true },

  // ====== C - 達成欲求 (Achievement) Q31-Q35 ======
  { id: 31, text: "「これをやり遂げたい」という目標が、いつも頭にある。", facetId: "C_achievement", dimension: "C", reversed: false },
  { id: 32, text: "テストや課題で、平均より上を目指すタイプだ。", facetId: "C_achievement", dimension: "C", reversed: false },
  { id: 33, text: "「のんびり過ごす」が一番の幸せだと思う。", facetId: "C_achievement", dimension: "C", reversed: true },
  { id: 34, text: "自分なりの目標を立てて、それに向かって動くほうだ。", facetId: "C_achievement", dimension: "C", reversed: false },
  { id: 35, text: "特に目標がなくても、毎日それなりに楽しい。", facetId: "C_achievement", dimension: "C", reversed: true },

  // ====== C - 秩序性 (Orderliness) Q36-Q40 ======
  { id: 36, text: "机の上やカバンの中は、わりと整理されている。", facetId: "C_orderliness", dimension: "C", reversed: false },
  { id: 37, text: "予定はスケジュール帳やアプリでちゃんと管理する。", facetId: "C_orderliness", dimension: "C", reversed: false },
  { id: 38, text: "部屋が散らかっていても、あまり気にならない。", facetId: "C_orderliness", dimension: "C", reversed: true },
  { id: 39, text: "何かを始める前に、まず段取りを考えるほうだ。", facetId: "C_orderliness", dimension: "C", reversed: false },
  { id: 40, text: "「あとで片付ければいい」とつい放置してしまう。", facetId: "C_orderliness", dimension: "C", reversed: true },

  // ====== N - 感情爆発 (Volatility) Q41-Q45 ======
  { id: 41, text: "イラっとしたら、つい顔や態度に出てしまう。", facetId: "N_volatility", dimension: "N", reversed: false },
  { id: 42, text: "嫌なことがあると、しばらく機嫌が直らない方だ。", facetId: "N_volatility", dimension: "N", reversed: false },
  { id: 43, text: "感情が乱れても、表に出さないほうだ。", facetId: "N_volatility", dimension: "N", reversed: true },
  { id: 44, text: "友達と喧嘩したとき、感情が抑えられなくなる。", facetId: "N_volatility", dimension: "N", reversed: false },
  { id: 45, text: "どんな時でも、わりと冷静でいられる。", facetId: "N_volatility", dimension: "N", reversed: true },

  // ====== N - 不安 (Anxiety) Q46-Q50 ======
  { id: 46, text: "寝る前、つい今日のことを思い出して考え込む。", facetId: "N_anxiety", dimension: "N", reversed: false },
  { id: 47, text: "テストや発表の前は、何度も確認しないと不安だ。", facetId: "N_anxiety", dimension: "N", reversed: false },
  { id: 48, text: "先のことを心配することは、あまりない。", facetId: "N_anxiety", dimension: "N", reversed: true },
  { id: 49, text: "「あの言い方、大丈夫だったかな」とよく振り返る。", facetId: "N_anxiety", dimension: "N", reversed: false },
  { id: 50, text: "何か起きてから対処すればいい、と思える方だ。", facetId: "N_anxiety", dimension: "N", reversed: true },
];

// 7 段階リッカートスケールの回答選択肢
// UI 側では両端のみテキストラベル + 中間 5 段階はサイズ/色グラデーションで表示
export const answerOptions = [
  { value: 7 as const, label: "強くそう思う" },
  { value: 6 as const, label: "そう思う" },
  { value: 5 as const, label: "ややそう思う" },
  { value: 4 as const, label: "どちらでもない" },
  { value: 3 as const, label: "あまりそう思わない" },
  { value: 2 as const, label: "そう思わない" },
  { value: 1 as const, label: "強くそう思わない" },
];

// ファセット別の質問取得ヘルパー (Phase 2B で利用)
export function getQuestionsByFacet(facetId: FacetId): Question[] {
  return questions.filter((q) => q.facetId === facetId);
}
