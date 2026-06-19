// 相性キャラ表示用データ (結果ページ /me の「アナタと相性のいいタイプ」)。
//
// 相性は 8 タイプ (TorisetsuTypeId) 粒度。
//   - 1 位: 既存 report-data.ts の BEST_PARTNER_CONTENT (partnerTypeId / whyCompatible) を使う。
//   - 2 位: 既存に無いため本ファイルで暫定割り当て (SECOND_PARTNER)。
//   - 表示は 32 タイプキャラ (v3) で行うため、8 タイプ → 代表 32 キャラの対応表 (BASE_TYPE_TO_REP_32)。
//
// ⚠️ 暫定データ (トリペン調整可):
//   - SECOND_PARTNER: 1 位の選び方 (性格を補い合う方向) に倣い、1 位と重複しない相手を 1 件。
//   - BASE_TYPE_TO_REP_32: 各 8 タイプの「自前 32 バリアント」の中から essence が最も近い 1 体を選定。
//     (例: festival-sun の 4 変種 = sparkle-dolphin__N/R, idea-monkey__N/R から選ぶ)

import type { TorisetsuTypeId } from "./types";
import type { ThirtyTwoTypeId } from "./thirty-two-types";

/**
 * 8 タイプ → 代表 32 キャラ (暫定)。
 * 各タイプの自前バリアントから essence が最も近い 1 体を選定。トリペン調整可。
 */
export const BASE_TYPE_TO_REP_32: Record<TorisetsuTypeId, ThirtyTwoTypeId> = {
  "festival-sun": "sparkle-dolphin__N", // きらめきイルカ / 好奇心の探究者
  "everyones-home": "caretaker-dog__N", // せわやきイヌ / あたたかい世話役
  "wild-charisma": "whim-fox__R", // マイペースサメ / 動じない一匹狼
  "iron-mental": "brisk-tiger__R", // どっしりクマ / 揺るがない大黒柱
  "delicate-creator": "dreamer-rabbit__N", // なかよしペンギン / 甘えん坊の人気者
  "healing-guardian": "gentle-koala__N", // おもいやりエンジェル / 慈愛の使い
  "deep-dive-explorer": "seeker-wolf__R", // クールタカ / 孤高の狩人
  "cool-maverick": "solo-hedgehog__R", // のんきガイコツ / 飄々の自由人
};

/**
 * 相性 2 位 (暫定)。1 位 (BEST_PARTNER_CONTENT.partnerTypeId) とは重複させない。
 * reason は一言 (kawaii トーン)。トリペン調整可。
 */
export const SECOND_PARTNER: Record<
  TorisetsuTypeId,
  { partnerTypeId: TorisetsuTypeId; reason: string }
> = {
  // 1位=everyones-home。明るく走り続ける自分を癒す内省型を 2 位に。
  "festival-sun": {
    partnerTypeId: "healing-guardian",
    reason: "走り続けるアナタを、そっと休ませてくれる癒し役。",
  },
  // 1位=wild-charisma。安定の自分に明るい風を足す中心地タイプ。
  "everyones-home": {
    partnerTypeId: "festival-sun",
    reason: "アナタの安心感に、明るい風を吹き込んでくれる。",
  },
  // 1位=cool-maverick。勢いに繊細な発想を添える相棒。
  "wild-charisma": {
    partnerTypeId: "delicate-creator",
    reason: "アナタの勢いに、繊細な発想を足してくれる。",
  },
  // 1位=everyones-home。硬くなりがちな自分を明るくほぐす。
  "iron-mental": {
    partnerTypeId: "festival-sun",
    reason: "硬くなりがちなアナタを、明るくほぐしてくれる。",
  },
  // 1位=festival-sun。繊細さを否定せず静かに支える同系統。
  "delicate-creator": {
    partnerTypeId: "healing-guardian",
    reason: "繊細なアナタを否定せず、静かに支えてくれる。",
  },
  // 1位=deep-dive-explorer。やさしさ同士で安心しあえる。
  "healing-guardian": {
    partnerTypeId: "everyones-home",
    reason: "やさしさ同士、無理なく安心できる関係。",
  },
  // 1位=iron-mental。ひとりの世界を尊重しつつ深く語れる。
  "deep-dive-explorer": {
    partnerTypeId: "delicate-creator",
    reason: "ひとりの世界を尊重しつつ、深く語り合える。",
  },
  // 1位=delicate-creator。互いの一人時間を尊重できる楽な相手。
  "cool-maverick": {
    partnerTypeId: "deep-dive-explorer",
    reason: "お互いの一人の時間を尊重できる、楽な相手。",
  },
};

/**
 * whyCompatible (2 文構成: 1 文目=自分 / 2 文目=「一方、〜相手タイプは…」) から、
 * 相手を説明する短い一文を取り出す (カード表示用)。見つからなければ全文を返す。
 */
export function shortWhyCompatible(why: string): string {
  const idx = why.indexOf("一方");
  const tail = idx >= 0 ? why.slice(idx) : why;
  const end = tail.indexOf("。");
  return end >= 0 ? tail.slice(0, end + 1) : tail;
}
