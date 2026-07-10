// 自己分析「深掘り」(恋愛/キャリア/成長) 本文のサーバ解決 (PR2: 課金ゲート)。
//
// 目的: 本文データ (TYPE_DEEP_DIVE / LOVE_BY_TYPE_32 / CAREER_BY_TYPE_32) を
//   クライアントコンポーネント (DeepDiveSections) から直接 import すると、全タイプの
//   全本文がクライアント JS バンドルに同梱され、未課金でも View Source で読めてしまう。
//   → 本文解決はサーバ (/me) 側でこのヘルパに集約し、「許可されたぶんだけ」を props で
//     DeepDiveSections へ渡す。未課金の課金タブ (キャリア/成長) は body=null で渡す
//     (=バンドルにも props にも本文が乗らない。フェイルクローズ)。
//
// 線引き (spec 確定):
//   - 無料: 恋愛(love) タブ本文 … サービスの核・バイラルの燃料なのでゲートしない。
//   - 🔒課金(¥299=full): キャリア(career) / 成長(growth) タブ本文。
//
// サーバ専用ではないが (純データのみ)、クライアントから import しないこと
// (import した時点でバンドル同梱に戻り、ゲートの意味が消える)。

import type { BigFiveDimension, TorisetsuTypeId } from "./types";
import { TYPE_DEEP_DIVE, type TypeDeepDive } from "./report-data";
import { classifyThirtyTwoType } from "./thirty-two-types";
import { LOVE_BY_TYPE_32 } from "./love-by-type-32";
import { CAREER_BY_TYPE_32 } from "./career-by-type-32";

export type DeepDiveTabKey = "love" | "career" | "growth";

// DeepDiveSections が表示だけで使う、解決済みの1タブぶん。
export type ResolvedDeepDiveSection = {
  key: DeepDiveTabKey;
  /** タブに出すラベル。 */
  tab: string;
  /** スコア由来の中立的な一文 (無料メタ。ロック時も出してよい)。 */
  note: string;
  /**
   * 本文 (段落は "\n\n" 区切り)。null = ロック (未課金の課金タブ)。
   * null のときは本文をそもそも解決していない (payload にも載らない)。
   */
  body: string | null;
  /** ロック中か (課金導線を出すフラグ)。 */
  locked: boolean;
};

// 一文に使う軸の表示名 (発散バーと整合。N はやわらかく「繊細さ」)。
const AXIS_LABEL: Record<BigFiveDimension, string> = {
  E: "外向性",
  A: "協調性",
  O: "開放性",
  C: "誠実性",
  N: "繊細さ",
};

// 表示する 3 カテゴリ (恋愛/キャリア/成長)。hint = スコア一文の素材の選び方。
const DEEP_DIVE_CARDS: {
  key: DeepDiveTabKey;
  tab: string;
  hint: "top" | "bottom" | "growth" | BigFiveDimension;
}[] = [
  { key: "love", tab: "恋愛傾向", hint: "A" },
  { key: "career", tab: "キャリア", hint: "C" },
  { key: "growth", tab: "成長", hint: "growth" },
];

// 未課金でも見せてよい無料タブ。ここ以外 (キャリア/成長) は課金でロック。
const FREE_TAB_KEYS: ReadonlySet<DeepDiveTabKey> = new Set<DeepDiveTabKey>([
  "love",
]);

function toPercent(score: number | undefined): number {
  const s = typeof score === "number" ? score : 5;
  return Math.max(0, Math.min(100, Math.round(s * 10)));
}

/**
 * 深掘り3タブを解決する。hasFullAccess=false のとき、キャリア/成長は body=null・
 * locked=true で返す (本文を一切解決しない)。恋愛は常に本文を返す。
 */
export function resolveDeepDiveSections(
  typeId: TorisetsuTypeId,
  scores: Partial<Record<BigFiveDimension, number>>,
  opts: { hasFullAccess: boolean },
): ResolvedDeepDiveSection[] {
  const deepDive = TYPE_DEEP_DIVE[typeId];

  const dims: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
  const pct: Record<BigFiveDimension, number> = {
    E: toPercent(scores.E),
    A: toPercent(scores.A),
    O: toPercent(scores.O),
    C: toPercent(scores.C),
    N: toPercent(scores.N),
  };
  const topDim = dims.reduce((a, b) => (pct[b] > pct[a] ? b : a));
  const bottomDim = dims.reduce((a, b) => (pct[b] < pct[a] ? b : a));

  function scoreNote(hint: (typeof DEEP_DIVE_CARDS)[number]["hint"]): string {
    if (hint === "top") {
      return `アナタの中で最も高いのは${AXIS_LABEL[topDim]}（${pct[topDim]}%）。`;
    }
    if (hint === "bottom") {
      return `最も控えめなのは${AXIS_LABEL[bottomDim]}（${pct[bottomDim]}%）。`;
    }
    if (hint === "growth") {
      return `${AXIS_LABEL[bottomDim]}（${pct[bottomDim]}%）は、意識すると伸ばしどころ。`;
    }
    return `アナタの${AXIS_LABEL[hint]}は${pct[hint]}%。`;
  }

  // ⚠ 恋愛/キャリアのみ 32タイプ解決 (非対称設計。理由は love-by-type-32.ts 冒頭)。
  //   未投入タイプは 8タイプ (deepDive) にフォールバック。
  const thirtyTwoId = classifyThirtyTwoType(scores);
  const love32 = LOVE_BY_TYPE_32[thirtyTwoId];
  const career32 = CAREER_BY_TYPE_32[thirtyTwoId];

  return DEEP_DIVE_CARDS.map((card) => {
    const unlocked = opts.hasFullAccess || FREE_TAB_KEYS.has(card.key);
    if (!unlocked) {
      // 課金タブ・未課金 → 本文を解決しない (body=null)。
      return {
        key: card.key,
        tab: card.tab,
        note: scoreNote(card.hint),
        body: null,
        locked: true,
      };
    }
    const section: TypeDeepDive[keyof TypeDeepDive] =
      card.key === "love" && love32
        ? love32
        : card.key === "career" && career32
          ? career32
          : deepDive[card.key];
    return {
      key: card.key,
      tab: card.tab,
      note: scoreNote(card.hint),
      body: section.body,
      locked: false,
    };
  });
}
