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
//   - 🔒第二部 (友達3人 or ¥499): キャリア(career) / 成長(growth) / 相性(aisho) タブ本文。
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

// ===== 恋人が密かに我慢していること (🔒・ルールベース・文章 / 2026-07-22) =====
// 旧「失敗する恋愛の特徴」を恋人視点にリフレーム (2026-07-22 指示)。
// part-two-resolve の LIKABLE_PROSE と同じ方式で、軸の高低から段落を組む。
// 段落構成: ①N (不安まわりの我慢) ②A (本音・言葉まわりの我慢) ③E+C (ペース・クセの我慢) ④締め (固定)。
// トーンは断罪ではなく「相手は関係を大事にしたいから黙っている」(ネガは愛されるクセに変換)。
export const LOVE_ENDURE_HEADING = "恋人が密かに我慢していること";

const LOVE_ENDURE_PROSE: Partial<
  Record<BigFiveDimension, Record<"H" | "L", string>>
> = {
  N: {
    H: "アナタの恋人が静かに受け止めているのは、アナタの「考えすぎる夜」。既読の速さや語尾の変化を深読みして不安になったアナタの、「ねえ、ほんとに大丈夫?」——その確認に何度も同じ答えを返しながら、「どう伝えたら安心してもらえるんだろう」と、相手も相手で悩んでいたりする。",
    L: "アナタの恋人が静かに飲み込んでいるのは、小さな不安を打ち明けたときの「気にしすぎだって」のひと言。アナタに悪気がないのは分かっているから責めないけど、「この人には深刻に聞こえないんだな」と思うたび、少しずつ相談することをやめていく。",
  },
  A: {
    H: "それから、アナタの「どこでもいいよ」。合わせてくれる優しさだと分かっていても、本音が見えないことは、相手にとって案外さみしい。「本当はどうしたいの?」を聞き出せないまま、アナタの顔色から答えを探す作業を、恋人は密かに続けている。",
    L: "それから、アナタの「正しすぎる一言」。的確なのは分かっているから言い返さないけど、欲しかったのは答えじゃなくて「わかるよ」だった——そんな夜を、恋人は言わずに流している。アナタの率直さを好きでいるからこそ、なおさら口にしない。",
  },
  E: {
    H: "そして、アナタのスピードとにぎやかさ。予定がどんどん埋まっていくアナタの隣で、「二人だけのゆっくりした時間」を言い出すタイミングを、相手はそっと窺っている。",
    L: "そして、誘うのがいつも自分側だという小さな偏り。アナタの気持ちを疑ってはいないけど、「たまには先に誘ってほしい」を、相手は言えずにいる。",
  },
  C: {
    H: "アナタの「ちゃんとしたい」に合わせて、ゆるく過ごしたい日を少し我慢していることもある。",
    L: "アナタの返信の波を「気持ちの波じゃない」と自分に言い聞かせている日も、たぶんある。",
  },
};

const LOVE_ENDURE_CLOSING =
  "ここまで読んで胸がチクッとしても、大丈夫。相手が黙っているのは、アナタが嫌いだからじゃなく、この関係を壊したくないから。我慢の場所を先に知って、こちらから「最近どう?」と聞けたなら——その我慢は、ぜんぶ信頼に変わる。";

function buildLoveEndure(
  scores: Partial<Record<BigFiveDimension, number>>,
): string {
  const hl = (d: BigFiveDimension): "H" | "L" =>
    (typeof scores[d] === "number" ? (scores[d] as number) : 5) >= 5
      ? "H"
      : "L";
  const p = (d: BigFiveDimension) => LOVE_ENDURE_PROSE[d]![hl(d)];
  return [p("N"), p("A"), `${p("E")}${p("C")}`, LOVE_ENDURE_CLOSING].join(
    "\n\n",
  );
}

// キャリア本文を分割する共通見出し (全32タイプ固定・3ブロック / 2026-07-22)。
//   本文はどのタイプも「働き方のクセ描写 → その希少さ → 向き不向きの領域 → 強みの再定義」
//   の4段落で統一。1-2段落目 = 働き方 (無料)、3段落目 = 合う/避ける (🔒)。
//   4段落目 (才能の再定義) は 2026-07-22 指示で非表示 (原稿は温存)。
//   3ブロック目「職場の人間関係」は原稿ではなくスコア由来のルールベース本文 (下記)。
const CAREER_HEADINGS = [
  "あなたの働き方",
  "あなたに合った働き方・避けたほうがいい職場",
] as const;

// ===== 職場の人間関係 (🔒・ルールベース・文章 / 2026-07-22) =====
// 「恋人が密かに我慢していること」(LOVE_ENDURE_PROSE) と同じ方式で、軸の高低から段落を組む。
// 段落構成: ①E (距離のとり方) ②A (頼まれごと・衝突のクセ) ③N+C (消耗ポイント) ④締め (固定)。
// トーンは断罪ではなく「合う距離感を教える」(ネガは愛されるクセに変換)。
export const CAREER_RELATIONS_HEADING = "職場の人間関係";

const CAREER_RELATIONS_PROSE: Partial<
  Record<BigFiveDimension, Record<"H" | "L", string>>
> = {
  E: {
    H: "職場でのアナタは、自然と輪の真ん中に近いポジションにいる人。誰とでもすぐ打ち解けて、空気が重い会議でも口火を切れる。ただ、広く付き合えるぶん「誰にでもいい顔をする」と見られたり、浅い関係ばかり増えて、本当にしんどいときに頼れる相手がいない——そんな瞬間が、思い当たらない?",
    L: "職場でのアナタは、雑談の輪にガンガン入っていくタイプじゃない。でもそれは壁があるんじゃなくて、少人数とじっくり信頼を積むスタイルなだけ。ただ、静かにしているだけで「何を考えてるか分からない」と誤解されたり、気づいたら輪の外に置かれていた——そんな損のしかたをすることがある。",
  },
  A: {
    H: "人間関係で一番すり減るのは、頼まれごと。嫌われたくなくて断れず、気づけばアナタの机にだけ仕事が積み上がっていく。衝突を避けて飲み込んだ「それ、おかしくない?」は消えずに溜まって、ある日どっと疲れに変わる。優しさが、いちばんの消耗ポイントになりやすい。",
    L: "アナタは思ったことを率直に言えるタイプ。それ自体はチームの財産だけど、正しい指摘ほど「キツい一言」として届くことがある。相手が欲しかったのは正解じゃなくて、まず「わかるよ」の一言だった——そんなすれ違いが、評価に響く前に知っておきたいクセ。",
  },
  N: {
    H: "そして、周りの評価や空気の変化に人一倍敏感なぶん、上司の機嫌や同僚の一言を引きずって消耗しやすい。",
    L: "そして、多少ピリついた空気でも動じない安定感は、周りが思っている以上にチームを落ち着かせている。",
  },
  C: {
    H: "責任感が強いぶん一人で抱え込みやすく、「相談＝迷惑」と思い込んで限界まで言えないところもある。",
    L: "マイペースに動けるぶん、報告や共有が後回しになって「勝手に進めてる」と見られてしまうこともある。",
  },
};

const CAREER_RELATIONS_CLOSING =
  "人間関係のクセは、直すものじゃなくて「置く場所」の問題。アナタの距離のとり方がそのまま活きるチームなら、無理にキャラを変えなくても、ちゃんと信頼される。合う距離感の職場を選ぶことが、いちばんの処世術なんです。";

function buildCareerRelations(
  scores: Partial<Record<BigFiveDimension, number>>,
): string {
  const hl = (d: BigFiveDimension): "H" | "L" =>
    (typeof scores[d] === "number" ? (scores[d] as number) : 5) >= 5
      ? "H"
      : "L";
  const p = (d: BigFiveDimension) => CAREER_RELATIONS_PROSE[d]![hl(d)];
  return [p("E"), p("A"), `${p("N")}${p("C")}`, CAREER_RELATIONS_CLOSING].join(
    "\n\n",
  );
}

// キャリア body を共通見出し3ブロックに分割。1ブロック目 (働き方) は無料、
// 2ブロック目 (合った働き方・避けたほうがいい職場 = 原稿3段落目) と
// 3ブロック目 (職場の人間関係 = ルールベース) は課金ゲート対象 (恋愛 payoff と同じ)。
// unlocked=false のときは locked=true・body="" とし、本文を payload に載せない
// (フェイルクローズ。表示側はぼかし + 解除カードにする)。
// 4段落でない原稿 (8タイプフォールバック等) は undefined = 従来どおり単一本文表示。
function buildCareerBlocks(
  body: string,
  scores: Partial<Record<BigFiveDimension, number>>,
  unlocked: boolean,
): { heading: string; body: string; locked?: boolean }[] | undefined {
  const paras = body.split("\n\n");
  if (paras.length < 4) return undefined;
  const gate = (heading: string, text: string) =>
    unlocked
      ? { heading, body: text }
      : { heading, body: "", locked: true as const };
  return [
    { heading: CAREER_HEADINGS[0], body: paras.slice(0, 2).join("\n\n") },
    gate(CAREER_HEADINGS[1], paras[2]),
    gate(CAREER_RELATIONS_HEADING, buildCareerRelations(scores)),
  ];
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
      // 「恋人が密かに我慢していること」(🔒) を末尾に追加 (2026-07-15/22 リフレーム)。
      // スコア由来のルールベース本文。未解放時は body を解決せず locked のみ
      // (フェイルクローズ。表示側は LOCKED_BLOCK_CONFIG のデコイ + 解除カード)。
      if (blocks) {
        blocks.push(
          opts.hasFullAccess
            ? { heading: LOVE_ENDURE_HEADING, body: buildLoveEndure(scores) }
            : { heading: LOVE_ENDURE_HEADING, body: "", locked: true },
        );
      }
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
    // 「合った働き方・避けたほうがいい職場」「職場の人間関係」は課金ゲート (未解放時はフェイルクローズ)。
    const careerBlocks = buildCareerBlocks(
      section.body,
      scores,
      opts.hasFullAccess,
    );
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
