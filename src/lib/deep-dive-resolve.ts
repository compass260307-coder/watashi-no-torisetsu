// 自己分析「深掘り」(恋愛/キャリア/成長) 本文のサーバ解決 (PR2: 課金ゲート)。
//
// 目的: 本文データ (TYPE_DEEP_DIVE / LOVE_BY_TYPE_32 / CAREER_BY_TYPE_32) を
//   クライアントコンポーネント (DeepDiveSections) から直接 import すると、全タイプの
//   全本文がクライアント JS バンドルに同梱され、未課金でも View Source で読めてしまう。
//   → 本文解決はサーバ (/me) 側でこのヘルパに集約し、「許可されたぶんだけ」を props で
//     DeepDiveSections へ渡す。未課金の課金タブ (キャリア/成長) は body=null で渡す
//     (=バンドルにも props にも本文が乗らない。フェイルクローズ)。
//
// 線引き (三層モデル 2026-07-12 確定):
//   - 無料 (第一部): 恋愛(love) タブ本文 … サービスの核・バイラルの燃料なのでゲートしない。
//   - 🔒第二部 (友達3人 or ¥99): キャリア(career) / 成長(growth) / 相性(aisho) タブ本文。
//     opts.hasFullAccess には hasPartTwoAccess の結果を渡す (呼び出し側 /me)。
//
// サーバ専用ではないが (純データのみ)、クライアントから import しないこと
// (import した時点でバンドル同梱に戻り、ゲートの意味が消える)。

import type { BigFiveDimension, TorisetsuTypeId } from "./types";
import { TYPE_DEEP_DIVE, type TypeDeepDive } from "./report-data";
import {
  classifyThirtyTwoType,
  type ThirtyTwoTypeId,
} from "./thirty-two-types";
import { LOVE_BY_TYPE_32 } from "./love-by-type-32";
import { CAREER_BY_TYPE_32 } from "./career-by-type-32";

export type DeepDiveTabKey = "love" | "career" | "growth" | "aisho";

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
  /**
   * 本文を見出し付きブロックに分割したもの (2026-07-14・恋愛のみ)。
   * 登録済みタイプだけ設定され、表示側はこれがあれば body の代わりに見出し付きで描画する。
   * 未登録は undefined = 従来どおり body を単一表示。
   * locked=true のブロックは payoff (救い/ヒント) が未解放。body は "" (payload に載せない)。
   */
  blocks?: { heading: string; body: string; locked?: boolean }[];
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

// 表示するカテゴリ。hint = スコア一文の素材の選び方。
// 2026-07-14 指示: 成長/相性は一旦削除し、恋愛+キャリアの2本に絞る。
const DEEP_DIVE_CARDS: {
  key: Extract<DeepDiveTabKey, "love" | "career">;
  tab: string;
  hint: "top" | "bottom" | "growth" | "aisho" | BigFiveDimension;
}[] = [
  { key: "love", tab: "恋愛傾向", hint: "A" },
  { key: "career", tab: "キャリア傾向", hint: "C" },
];

// 未課金でも見せてよい無料タブ (2026-07-14 指示: キャリアもデフォルト表示に)。
const FREE_TAB_KEYS: ReadonlySet<DeepDiveTabKey> = new Set<DeepDiveTabKey>([
  "love",
  "career",
]);

// 恋愛本文を分割する共通見出し (全32タイプ固定・2ブロック / 2026-07-14)。
//   本文はどのタイプも「魅力〜本音 → 救い/ヒント」の同じ流れなので、見出しは共通で成立する。
//   原稿(body)は一切変更せず、段落境界で2つに割るだけ。
//   ※「つい抱えこんでしまうこと」は削除し「恋の魅力」に統合 (2026-07-14 指示)。
const LOVE_HEADINGS = [
  "あなたの恋の魅力",
  "あなたを好きになった人が読むトリセツ",
] as const;

// タイプ別の区切り = [ブロック1の段落数, ブロック2の段落数]。ブロック3 = 残り全部。
//   談話標識 (「でも/じつは」で本音へ、「でも、それは〜じゃない/だから/最後に」で救いへ) を
//   基準に全タイプ機械決定。R系=[2,1] / N系=[1,2] が基本、原稿に応じ例外あり。
const LOVE_SPLITS: Partial<Record<ThirtyTwoTypeId, [number, number]>> = {
  "smiley-panda__R": [2, 1],
  "smiley-panda__N": [1, 2],
  "caretaker-dog__R": [2, 1],
  "caretaker-dog__N": [1, 2],
  "brisk-tiger__R": [2, 2],
  "brisk-tiger__N": [1, 2],
  "playful-raccoon__R": [2, 1],
  "playful-raccoon__N": [2, 1],
  "idea-monkey__R": [2, 1],
  "idea-monkey__N": [1, 2],
  "sparkle-dolphin__R": [2, 1],
  "sparkle-dolphin__N": [1, 2],
  "ambition-lion__R": [2, 1],
  "ambition-lion__N": [1, 2],
  "whim-fox__R": [2, 1],
  "whim-fox__N": [1, 2],
  "dreamer-rabbit__R": [2, 1],
  "dreamer-rabbit__N": [1, 2],
  "quiet-owl__R": [2, 1],
  "quiet-owl__N": [1, 2],
  "seeker-wolf__R": [2, 1],
  "seeker-wolf__N": [1, 2],
  "fantasy-cat__R": [2, 1],
  "fantasy-cat__N": [1, 2],
  "gentle-koala__R": [2, 1],
  "gentle-koala__N": [1, 2],
  "earnest-elephant__R": [2, 1],
  "earnest-elephant__N": [1, 2],
  "steady-turtle__R": [2, 1],
  "steady-turtle__N": [1, 2],
  "solo-hedgehog__R": [2, 1],
  "solo-hedgehog__N": [1, 2],
};

// 恋愛 body を共通見出し2ブロックに分割。未登録/段落不足のタイプは undefined
// (= 従来どおり単一本文表示)。両ブロックとも1段落以上でなければ分割しない。
//   2ブロック目「あなたを好きになった人が読むトリセツ」(救い/ヒントの payoff) は課金ゲート対象。
//   unlocked=false のときは locked=true・body="" とし、本文を payload に載せない
//   (フェイルクローズ。表示側はぼかし + 解除カードにする)。
//   LOVE_SPLITS の [c1, c2] は旧3ブロック時代の区切り。payoff 境界 (c1+c2) だけ使う。
function buildLoveBlocks(
  typeId: ThirtyTwoTypeId,
  body: string,
  unlocked: boolean,
): { heading: string; body: string; locked?: boolean }[] | undefined {
  const split = LOVE_SPLITS[typeId];
  if (!split) return undefined;
  const paras = body.split("\n\n");
  const [c1, c2] = split;
  if (c1 < 1 || c2 < 1 || c1 + c2 >= paras.length) return undefined;
  const slices = [paras.slice(0, c1 + c2), paras.slice(c1 + c2)];
  return slices.map((s, i) => {
    const heading = LOVE_HEADINGS[i];
    const isPayoff = i === slices.length - 1;
    if (isPayoff && !unlocked) {
      return { heading, body: "", locked: true };
    }
    return { heading, body: s.join("\n\n") };
  });
}

// キャリア本文を分割する共通見出し (全32タイプ固定・3ブロック / 2026-07-14)。
//   本文はどのタイプも「働き方のクセ描写 → その希少さ → 向き不向きの領域 → 強みの再定義」
//   の4段落で統一されているため、[2,1,1] の固定分割で成立する。原稿(body)は無改変。
const CAREER_HEADINGS = [
  "あなたの働き方",
  "向いているキャリア",
  "あなたの隠れた才能",
] as const;

// キャリア body を共通見出し3ブロックに分割。1ブロック目 (働き方) は無料、
// 2・3ブロック目 (向いているキャリア/隠れた才能) は課金ゲート対象 (恋愛 payoff と同じ)。
// unlocked=false のときは locked=true・body="" とし、本文を payload に載せない
// (フェイルクローズ。表示側はぼかし + 解除カードにする)。
// 4段落でない原稿 (8タイプフォールバック等) は undefined = 従来どおり単一本文表示。
function buildCareerBlocks(
  body: string,
  unlocked: boolean,
): { heading: string; body: string; locked?: boolean }[] | undefined {
  const paras = body.split("\n\n");
  if (paras.length < 4) return undefined;
  const slices = [paras.slice(0, 2), paras.slice(2, 3), paras.slice(3)];
  return slices.map((s, i) => {
    const heading = CAREER_HEADINGS[i];
    if (i > 0 && !unlocked) {
      return { heading, body: "", locked: true };
    }
    return { heading, body: s.join("\n\n") };
  });
}

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
    if (hint === "aisho") {
      return "32タイプ全員と総当たりで計算した、アナタの相性ランキング。";
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
      // ゲート対象タブ・未解放 → 本文を解決しない (body=null)。
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
    if (card.key === "love") {
      // 恋愛は無料表示だが、payoff (3ブロック目「あなたを好きになった人が読むトリセツ」) だけは
      // 課金ゲート。未解放時は locked ブロックの本文を payload に載せない。
      const blocks = buildLoveBlocks(
        thirtyTwoId,
        section.body,
        opts.hasFullAccess,
      );
      // body は blocks があれば表示に使われないが、フェイルクローズのため公開分だけに絞る。
      const visibleBody = blocks
        ? blocks
            .filter((b) => !b.locked)
            .map((b) => b.body)
            .join("\n\n")
        : section.body;
      return {
        key: card.key,
        tab: card.tab,
        note: scoreNote(card.hint),
        body: visibleBody,
        blocks,
        locked: false,
      };
    }
    // キャリアも恋愛と同じ共通見出し3ブロック。「働き方」は無料、
    // 「向いているキャリア」「あなたの隠れた才能」は課金ゲート (未解放時はフェイルクローズ)。
    const careerBlocks = buildCareerBlocks(section.body, opts.hasFullAccess);
    const careerVisibleBody = careerBlocks
      ? careerBlocks
          .filter((b) => !b.locked)
          .map((b) => b.body)
          .join("\n\n")
      : section.body;
    return {
      key: card.key,
      tab: card.tab,
      note: scoreNote(card.hint),
      body: careerVisibleBody,
      blocks: careerBlocks,
      locked: false,
    };
  });
}
