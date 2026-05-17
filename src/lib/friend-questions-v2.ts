// Phase 3-β B-1: 友達評価 30 問 (新形式) の質問データ。
// 旧 src/lib/friend-questions.ts (13 問) は触らず並存。
//
// 設計:
//   - 5 軸 × 6 問 = 30 問
//   - 10 ファセット × 3 問 = 30 問
//   - 逆転項目 11 個 (Appendix A 配分通り。E_warmth = 3+, A_cooperation = 1+2-,
//     N_volatility = 1+2- の非対称設計のため)
//   - 3 ページ × 10 問
//   - {name} プレースホルダは UI 側で招待元の displayName に置換
//
// A-5 (friend-perception-v2.ts) の FRIEND_QUESTIONS_V2_MAP は本ファイルから派生生成。
// → 質問定義は本ファイルが単一の真実の源 (single source of truth)。

import type { FacetId } from "./types";

export type FriendQuestionV2 = {
  id: number; // 1-30
  text: string; // 質問本文 ({name} を招待元名で置換)
  facetId: FacetId;
  reversed: boolean;
};

export const FRIEND_QUESTIONS_V2: FriendQuestionV2[] = [
  // ===== ページ 1 (Q1-10) 行動観察寄り、軽め =====
  { id: 1, text: "{name}さんは、グループでも積極的に意見を言うほうだ", facetId: "E_assertiveness", reversed: false },
  { id: 2, text: "{name}さんは、思いついたらすぐに行動するタイプだ", facetId: "O_adventurousness", reversed: false },
  { id: 3, text: "{name}さんは、計画を立ててから動くことが多い", facetId: "C_orderliness", reversed: false },
  { id: 4, text: "{name}さんは、自分の意見をはっきり持ち、譲らないことがある", facetId: "A_cooperation", reversed: true },
  { id: 5, text: "{name}さんは、感情の波が顔や態度に出やすいタイプだ", facetId: "N_volatility", reversed: false },
  { id: 6, text: "{name}さんは、相手の気持ちを察するのが得意そうだ", facetId: "A_sympathy", reversed: false },
  { id: 7, text: "{name}さんは、独特の発想で周りを驚かせることがある", facetId: "O_imagination", reversed: false },
  { id: 8, text: "{name}さんは、初対面の人とも自然に会話を始められる", facetId: "E_assertiveness", reversed: false },
  { id: 9, text: "{name}さんは、目の前のことに集中して、計画を後回しにすることがある", facetId: "C_orderliness", reversed: true },
  { id: 10, text: "{name}さんは、慎重に物事を考えるタイプに見える", facetId: "N_anxiety", reversed: false },

  // ===== ページ 2 (Q11-20) 行動 + 性格、中間 =====
  { id: 11, text: "{name}さんは、自分から話すよりも、聞き役に回ることが多い", facetId: "E_assertiveness", reversed: true },
  { id: 12, text: "{name}さんと一緒にいると、場が和むことが多い", facetId: "E_warmth", reversed: false },
  { id: 13, text: "{name}さんは、知らない場所や活動にも積極的に踏み込んでいく", facetId: "O_adventurousness", reversed: false },
  { id: 14, text: "{name}さんは、目標を決めたらコツコツ努力するタイプだ", facetId: "C_achievement", reversed: false },
  { id: 15, text: "{name}さんは、馴染みのある場所や活動を好むほうだ", facetId: "O_adventurousness", reversed: true },
  { id: 16, text: "{name}さんは、誰かが落ち込んでいると気づいて声をかけることが多い", facetId: "A_sympathy", reversed: false },
  { id: 17, text: "{name}さんは、目の前の物事を、現実的な視点で見るほうだ", facetId: "O_imagination", reversed: true },
  { id: 18, text: "{name}さんは、感情の起伏が穏やかで、安定しているように見える", facetId: "N_volatility", reversed: true },
  { id: 19, text: "{name}さんは、グループの空気を読んで動くことが多い", facetId: "A_cooperation", reversed: false },
  { id: 20, text: "{name}さんは、相手の話を笑顔で受け止めてくれる", facetId: "E_warmth", reversed: false },

  // ===== ページ 3 (Q21-30) 性格的特徴、深掘り =====
  { id: 21, text: "{name}さんは、最後までやり遂げることに強いこだわりがあるように見える", facetId: "C_achievement", reversed: false },
  { id: 22, text: "{name}さんは、心配性で、リスクに敏感に気づくほうだ", facetId: "N_anxiety", reversed: false },
  { id: 23, text: "{name}さんは、緊張する場面でも、落ち着いて行動できるタイプだ", facetId: "N_anxiety", reversed: true },
  { id: 24, text: "{name}さんは、相手の感情に流されにくく、冷静さを保つほうだ", facetId: "A_sympathy", reversed: true },
  { id: 25, text: "{name}さんは、整理整頓やスケジュール管理がしっかりしている", facetId: "C_orderliness", reversed: false },
  { id: 26, text: "{name}さんは、グループより自分の判断を優先するタイプだ", facetId: "A_cooperation", reversed: true },
  { id: 27, text: "{name}さんは、抽象的なアイデアや空想を楽しめるタイプだ", facetId: "O_imagination", reversed: false },
  { id: 28, text: "{name}さんは、目標達成より、今を楽しむことを大切にするタイプだ", facetId: "C_achievement", reversed: true },
  { id: 29, text: "{name}さんと話していると、こちらまで明るい気分になる", facetId: "E_warmth", reversed: false },
  { id: 30, text: "{name}さんは、感情があまり表に出ないタイプに見える", facetId: "N_volatility", reversed: true },
];

// ページ分割 (B-2 の UI で使用)
export const FRIEND_QUESTIONS_V2_PAGE_1: FriendQuestionV2[] = FRIEND_QUESTIONS_V2.slice(0, 10);
export const FRIEND_QUESTIONS_V2_PAGE_2: FriendQuestionV2[] = FRIEND_QUESTIONS_V2.slice(10, 20);
export const FRIEND_QUESTIONS_V2_PAGE_3: FriendQuestionV2[] = FRIEND_QUESTIONS_V2.slice(20, 30);

export const FRIEND_QUESTIONS_V2_TOTAL = 30;
export const FRIEND_QUESTIONS_V2_PAGES = 3;
export const FRIEND_QUESTIONS_V2_PER_PAGE = 10;

// ===== おまけ choice 3 問 (スキップ可、qualitative_data 用) =====
// 論点 2 (c) 採用: 30 問の後におまけとして提示、各問は個別スキップ可。
// id は English 短縮形 (DB jsonb キーとして使用)。
// 設計書全体 Appendix A の {好きなところ?: ..., 動物?: ..., 印象シーン?: ...} という
// Japanese キー記法はあくまでコンセプト表現で、実装キーは本ファイルの id を正とする。

export type FriendChoiceQuestionV2 = {
  id: "favorite_point" | "animal" | "impression_scene";
  label: string; // UI 表示用ラベル (短く)
  text: string; // 質問本文 ({name} 置換あり)
  options: string[]; // 選択肢
};

export const FRIEND_CHOICE_QUESTIONS_V2: FriendChoiceQuestionV2[] = [
  {
    id: "favorite_point",
    label: "好きなところ",
    text: "{name}さんの「好きなところ」を教えて",
    options: ["優しさ", "面白さ", "頭の良さ", "明るさ", "安心感", "個性"],
  },
  {
    id: "animal",
    label: "動物に例えると",
    text: "{name}さんを動物に例えると？",
    options: [
      "犬（人懐っこい）",
      "猫（マイペース）",
      "うさぎ（繊細）",
      "ライオン（堂々）",
      "パンダ（癒し）",
      "ふくろう（賢い）",
    ],
  },
  {
    id: "impression_scene",
    label: "印象的なシーン",
    text: "{name}さんとの印象的なシーンは？",
    options: [
      "一緒に笑ったとき",
      "励ましてくれたとき",
      "一緒に頑張ったとき",
      "相談に乗ってくれたとき",
      "楽しい場を作ってくれたとき",
    ],
  },
];

// ===== ヘルパー: {name} プレースホルダ置換 (B-2 / B-3 で使用) =====
export function renderQuestionText(template: string, inviteeName: string): string {
  return template.replaceAll("{name}", inviteeName);
}
