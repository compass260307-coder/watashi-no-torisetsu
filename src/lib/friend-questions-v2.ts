// 友達評価の質問データ。
// 旧 src/lib/friend-questions.ts (13 問) は触らず並存。
//
// 設計 (改修後):
//   - 5 軸 (E/A/O/C/N) × 2 問 = 10 問、1 ページ。
//   - 各軸は 2 ファセットを 1 問ずつ代表 (すべて非逆転)。
//   - 10 問では 10 ファセットの精度は出ないため、スコアは 5 軸のみを採用し、
//     perceived_facet_scores は各ファセットに親軸スコアを埋める (friend-perception-v2.ts)。
//   - {name} プレースホルダは UI 側で招待元の displayName に置換。
//
// friend-perception-v2.ts の FRIEND_QUESTIONS_V2_MAP は本ファイルから派生生成。
// → 質問定義は本ファイルが単一の真実の源 (single source of truth)。

import type { FacetId } from "./types";

export type FriendQuestionV2 = {
  id: number; // 1-30
  text: string; // 質問本文 ({name} を招待元名で置換)
  facetId: FacetId;
  reversed: boolean;
};

// 改修: 5 軸 × 2 問 = 10 問 (1 ページ) に短縮。
// 各軸は 2 つのファセットを 1 問ずつ代表させ、すべて非逆転 (2 問では逆転の精度が出にくいため)。
// 30 問版から「質の高い 2 問ずつ」を選定。トリペンが差し替えやすいよう軸ごとに並べる。
export const FRIEND_QUESTIONS_V2: FriendQuestionV2[] = [
  // ===== 外向性 E (E_assertiveness / E_warmth) =====
  { id: 1, text: "{name}さんは、グループでも積極的に意見を言うほうだ", facetId: "E_assertiveness", reversed: false },
  { id: 2, text: "{name}さんと一緒にいると、場が和むことが多い", facetId: "E_warmth", reversed: false },
  // ===== 協調性 A (A_sympathy / A_cooperation) =====
  { id: 3, text: "{name}さんは、相手の気持ちを察するのが得意そうだ", facetId: "A_sympathy", reversed: false },
  { id: 4, text: "{name}さんは、グループの空気を読んで動くことが多い", facetId: "A_cooperation", reversed: false },
  // ===== 開放性 O (O_adventurousness / O_imagination) =====
  { id: 5, text: "{name}さんは、知らない場所や活動にも積極的に踏み込んでいく", facetId: "O_adventurousness", reversed: false },
  { id: 6, text: "{name}さんは、独特の発想で周りを驚かせることがある", facetId: "O_imagination", reversed: false },
  // ===== 誠実性 C (C_achievement / C_orderliness) =====
  { id: 7, text: "{name}さんは、目標を決めたらコツコツ努力するタイプだ", facetId: "C_achievement", reversed: false },
  { id: 8, text: "{name}さんは、整理整頓やスケジュール管理がしっかりしている", facetId: "C_orderliness", reversed: false },
  // ===== 神経症傾向 N (N_volatility / N_anxiety) =====
  { id: 9, text: "{name}さんは、感情の波が顔や態度に出やすいタイプだ", facetId: "N_volatility", reversed: false },
  { id: 10, text: "{name}さんは、心配性で、リスクに敏感に気づくほうだ", facetId: "N_anxiety", reversed: false },
];

// ページ分割 (UI で使用)。10 問 = 1 ページ。
export const FRIEND_QUESTIONS_V2_PAGE_1: FriendQuestionV2[] = FRIEND_QUESTIONS_V2.slice(0, 10);

export const FRIEND_QUESTIONS_V2_TOTAL = 10;
export const FRIEND_QUESTIONS_V2_PAGES = 1;
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
