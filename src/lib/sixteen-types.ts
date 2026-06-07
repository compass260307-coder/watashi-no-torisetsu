// Phase 1.5-α Day 12-Polish (自己診断本文): 16 タイプ・マスター定義 + 判定マッピング
//
// watashi-torisetsu-16type-master-v1.md を正とする。
// Big Five のうち O(開放)/C(誠実)/E(外向)/A(協調) の 4 軸 × 高/低 = 16 タイプ。
// N(神経症傾向) は診断ではスコア表示するが、型(キャラ)判定には使わない。
//
// 設計判断: 既存の診断ロジック (lib/diagnosis.ts の 8 タイプ + C/N モディファイア) と
// スキーマ (users.scores) は触らない。user.scores の O/C/E/A 高低から 16 タイプを
// 結果ページ側で「派生」する (classifySixteenType)。8 タイプ × C 高低 = 16 と一対一対応する。

import type { BigFiveDimension } from "./types";

export type SixteenTypeId =
  | "sparkle-dolphin" // O＋C＋E＋A＋ きらめきイルカ
  | "ambition-lion" // O＋C＋E＋A− こころざしライオン
  | "quiet-owl" // O＋C＋E−A＋ しずかフクロウ
  | "seeker-wolf" // O＋C＋E−A− こだわりオオカミ
  | "idea-monkey" // O＋C−E＋A＋ ひらめきザル
  | "whim-fox" // O＋C−E＋A− きまぐれキツネ
  | "dreamer-rabbit" // O＋C−E−A＋ きらめきウサギ
  | "fantasy-cat" // O＋C−E−A− ゆめみるネコ
  | "caretaker-dog" // O−C＋E＋A＋ せわやきイヌ
  | "brisk-tiger" // O−C＋E＋A− てきぱきトラ
  | "earnest-elephant" // O−C＋E−A＋ まじめゾウ
  | "steady-turtle" // O−C＋E−A− こつこつカメ
  | "smiley-panda" // O−C−E＋A＋ にこにこパンダ
  | "playful-raccoon" // O−C−E＋A− やんちゃアライグマ
  | "gentle-koala" // O−C−E−A＋ ほんわかコアラ
  | "solo-hedgehog"; // O−C−E−A− マイペースハリネズミ

export interface SixteenType {
  id: SixteenTypeId;
  name: string; // 例: きらめきウサギ
  animal: string; // 例: ウサギ
  code: string; // OCEA 高低コード 例: O＋C−E−A＋
  essence: string; // 例: 気まぐれロマンチスト
  oneLiner: string;
}

export const sixteenTypes: Record<SixteenTypeId, SixteenType> = {
  "sparkle-dolphin": {
    id: "sparkle-dolphin",
    name: "きらめきイルカ",
    animal: "イルカ",
    code: "O＋C＋E＋A＋",
    essence: "太陽のリーダー",
    oneLiner: "好奇心と思いやりでみんなを率いる、明るく有能なまとめ役。",
  },
  "ambition-lion": {
    id: "ambition-lion",
    name: "こころざしライオン",
    animal: "ライオン",
    code: "O＋C＋E＋A−",
    essence: "野心のビジョナリー",
    oneLiner: "理想を掲げて先頭を走る、自信家の改革者。",
  },
  "quiet-owl": {
    id: "quiet-owl",
    name: "しずかフクロウ",
    animal: "フクロウ",
    code: "O＋C＋E−A＋",
    essence: "献身の理想家",
    oneLiner: "静かに理想を形にする、思慮深くやさしい設計者。",
  },
  "seeker-wolf": {
    id: "seeker-wolf",
    name: "こだわりオオカミ",
    animal: "オオカミ",
    code: "O＋C＋E−A−",
    essence: "孤高の探究者",
    oneLiner: "自分の基準で深く突き詰める、ひとりの探究者。",
  },
  "idea-monkey": {
    id: "idea-monkey",
    name: "ひらめきザル",
    animal: "サル",
    code: "O＋C−E＋A＋",
    essence: "遊び心の発明家",
    oneLiner: "思いつきで人を楽しませる、奔放なアイデアマン。",
  },
  "whim-fox": {
    id: "whim-fox",
    name: "きまぐれキツネ",
    animal: "キツネ",
    code: "O＋C−E＋A−",
    essence: "型破りの冒険者",
    oneLiner: "刺激を求めて飛び回る、型にはまらない挑戦者。",
  },
  "dreamer-rabbit": {
    id: "dreamer-rabbit",
    name: "きらめきウサギ",
    animal: "ウサギ",
    code: "O＋C−E−A＋",
    essence: "気まぐれロマンチスト",
    oneLiner: "空想とやさしさで心を満たす、繊細な夢想家。",
  },
  "fantasy-cat": {
    id: "fantasy-cat",
    name: "ゆめみるネコ",
    animal: "ネコ",
    code: "O＋C−E−A−",
    essence: "空想アーティスト",
    oneLiner: "ひとりの世界で空想をふくらませる、気分屋の表現者。",
  },
  "caretaker-dog": {
    id: "caretaker-dog",
    name: "せわやきイヌ",
    animal: "イヌ",
    code: "O−C＋E＋A＋",
    essence: "頼れる世話役",
    oneLiner: "みんなの面倒をまめに見る、あたたかい幹事タイプ。",
  },
  "brisk-tiger": {
    id: "brisk-tiger",
    name: "てきぱきトラ",
    animal: "トラ",
    code: "O−C＋E＋A−",
    essence: "結果志向の指揮官",
    oneLiner: "目標に向けてきびきび仕切る、有能な実務家。",
  },
  "earnest-elephant": {
    id: "earnest-elephant",
    name: "まじめゾウ",
    animal: "ゾウ",
    code: "O−C＋E−A＋",
    essence: "縁の下の力持ち",
    oneLiner: "黙ってコツコツ支える、誠実で律儀な働き者。",
  },
  "steady-turtle": {
    id: "steady-turtle",
    name: "こつこつカメ",
    animal: "カメ",
    code: "O−C＋E−A−",
    essence: "黙々の職人",
    oneLiner: "自分の役割を堅実にやり切る、地道な実力派。",
  },
  "smiley-panda": {
    id: "smiley-panda",
    name: "にこにこパンダ",
    animal: "パンダ",
    code: "O−C−E＋A＋",
    essence: "みんなの人気者",
    oneLiner: "あたたかい雰囲気で自然と人が集まる、愛されムードメーカー。",
  },
  "playful-raccoon": {
    id: "playful-raccoon",
    name: "やんちゃアライグマ",
    animal: "アライグマ",
    code: "O−C−E＋A−",
    essence: "自由な遊び人",
    oneLiner: "その場のノリで動く、しばられない自由人。",
  },
  "gentle-koala": {
    id: "gentle-koala",
    name: "ほんわかコアラ",
    animal: "コアラ",
    code: "O−C−E−A＋",
    essence: "マイペースな癒し",
    oneLiner: "のんびり自分のペースで人にやさしい、和ませ役。",
  },
  "solo-hedgehog": {
    id: "solo-hedgehog",
    name: "マイペースハリネズミ",
    animal: "ハリネズミ",
    code: "O−C−E−A−",
    essence: "自由なソロ",
    oneLiner: "干渉せず自分の世界を守る、独立した一匹狼。",
  },
};

// OCEA 高低 (O,C,E,A の順、"+"=高 / "-"=低) → SixteenTypeId
const CODE_TO_ID: Record<string, SixteenTypeId> = {
  "++++": "sparkle-dolphin",
  "+++-": "ambition-lion",
  "++-+": "quiet-owl",
  "++--": "seeker-wolf",
  "+-++": "idea-monkey",
  "+-+-": "whim-fox",
  "+--+": "dreamer-rabbit",
  "+---": "fantasy-cat",
  "-+++": "caretaker-dog",
  "-++-": "brisk-tiger",
  "-+-+": "earnest-elephant",
  "-+--": "steady-turtle",
  "--++": "smiley-panda",
  "--+-": "playful-raccoon",
  "---+": "gentle-koala",
  "----": "solo-hedgehog",
};

const SCALE_MIDPOINT = 5.0;

/**
 * user.scores (Big Five 0-10) の O/C/E/A 高低から 16 タイプを派生する。
 * しきい値は診断ロジック (lib/diagnosis.ts) と同じ 5.0。欠損は中央値 5 (= 低扱い境界) にフォールバック。
 * N は型判定に使わない (スコア表示のみ)。
 */
export function classifySixteenType(
  scores: Partial<Record<BigFiveDimension, number>>,
): SixteenTypeId {
  const sign = (v: number | undefined) =>
    (typeof v === "number" ? v : SCALE_MIDPOINT) >= SCALE_MIDPOINT ? "+" : "-";
  const key = `${sign(scores.O)}${sign(scores.C)}${sign(scores.E)}${sign(scores.A)}`;
  return CODE_TO_ID[key] ?? "dreamer-rabbit";
}

// =====================================================================
// キャラ画像 lookup: 型 → 動物 slug → /characters/{animal}.png
// 画像は public/characters/{animal}.png (白背景・正方形) を丸枠に流し込む想定。
// =====================================================================
const ANIMAL_SLUG: Record<SixteenTypeId, string> = {
  "sparkle-dolphin": "dolphin",
  "ambition-lion": "lion",
  "quiet-owl": "owl",
  "seeker-wolf": "wolf",
  "idea-monkey": "monkey",
  "whim-fox": "fox",
  "dreamer-rabbit": "rabbit",
  "fantasy-cat": "cat",
  "caretaker-dog": "dog",
  "brisk-tiger": "tiger",
  "earnest-elephant": "elephant",
  "steady-turtle": "turtle",
  "smiley-panda": "panda",
  "playful-raccoon": "raccoon",
  "gentle-koala": "koala",
  "solo-hedgehog": "hedgehog",
};

export function animalSlugForType(id: SixteenTypeId): string {
  return ANIMAL_SLUG[id] ?? "rabbit";
}

// キャラ画像アセットのバージョン。同名で差し替えた時のキャッシュ更新用。
// 確実に効かせるためクエリ(?v=)ではなくバージョン付きディレクトリ /characters/v{N}/ を使う
// (この非標準 Next では next/image がローカル src のクエリを扱えず画像が出ないため)。
// 差し替え時はこの数値を上げ、public/characters/v{N}/ に画像を置く。
export const CHARACTER_ASSET_VERSION = 2;

/** 型 → キャラ画像パス (/characters/v{N}/{animal}.png、ディレクトリでキャッシュバスト) */
export function characterImagePath(id: SixteenTypeId): string {
  return `/characters/v${CHARACTER_ASSET_VERSION}/${animalSlugForType(id)}.png`;
}
