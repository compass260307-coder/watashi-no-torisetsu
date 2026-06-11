// Day 12 ③④改修: ③「◯◯さんが見つけたアナタ」の文章生成。
//
// PERCEIVED_BY_TYPE (mutual-result-content.ts) の強み/あれっ? 各 3 項目を、
// 1〜2 段落の流れる文章に織り込む。キーワード (強みワード/言い換え後のあれっ?ワード)
// は vividPink 太字で埋め込むため、セグメント列 (FoundSegment[]) として返す。
//
// 品質ルール:
//   - 本文中に友達名を出さない (主語省略 + 伝聞・推量)
//   - 文末・接続はパターンセット 3 種 × 文末スタイル 3 種で多様化し、
//     「〜みたい。」連発や「そして/さらに」の機械的連結を避ける
//   - パターンは typeId 由来のシード値で決定的に選ぶ (Server Component で安定)
//   - あれっ? のキツいワードは SOFT_WORD 辞書で柔らかい言い換えに変換してから
//     埋め込む (トーンは指摘ではなく「ちゃんと見られてた」発見の温かさ)

export interface FoundSegment {
  text: string;
  /** true = vividPink 太字のキーワード */
  pink?: boolean;
}
export type FoundParagraph = FoundSegment[];

interface RawItem {
  title: string;
  body: string;
}

// =====================================================================
// あれっ? ワードの言い換え辞書 (元ワード → 表示ワード)。
// PERCEIVED_BY_TYPE の surprises 全タイトルを網羅 (表示は各タイプ先頭 3 つだが、
// 有料深掘りレポートでの再利用に備えて 6 つぶんすべて持つ)。
// 辞書に無いワードはそのまま表示 (フォールバック)。
// =====================================================================
export const SOFT_WORD: Record<string, string> = {
  // brisk-tiger
  実は気にしてる: "こっそり気にしてる繊細さ",
  厳しさの奥の優しさ: "厳しさの奥の優しさ",
  弱音を見せない: "弱音をしまっておく強がり",
  せっかちな一面: "待ち時間が苦手な前のめり",
  抱え込みがち: "ひとりで抱えがちな一面",
  ふと力が抜けた表情: "ふと力が抜けた素顔",
  // sparkle-dolphin
  実は抱え込みがち: "ひとりで抱えがちな頑張り",
  温度差に凹む: "温度差にしゅんとする繊細さ",
  休むのが下手: "充電を後回しにする頑張り",
  本音が読みにくい時: "本音のしまい場所",
  甘えるのが苦手: "甘え下手な一面",
  // ambition-lion
  強引に見える時: "前のめりになる熱さ",
  正論で詰めがち: "まっすぐすぎる正しさ",
  弱音を隠す: "弱音をしまう強がり",
  一人で抱える: "ひとりで背負いがちな責任感",
  // quiet-owl
  考えすぎる一面: "じっくり考えこむ慎重さ",
  内に抱えがち: "胸の内にしまう静けさ",
  理想に苦しむ時: "理想の高さゆえのもどかしさ",
  譲りすぎる: "ゆずりがちな優しさ",
  変化に時間がいる: "新しい風への助走",
  静かに傷つく: "静かに揺れる繊細さ",
  // seeker-wolf
  実は情に厚い: "実は厚い情",
  頑固に映る時: "曲げない芯の強さ",
  頼るのが苦手: "頼り下手な一面",
  言葉が足りない: "言葉少なな伝え方",
  興味の偏り: "好きに正直な集中力",
  一人になりがち: "ひとり時間の心地よさ",
  // idea-monkey
  ノリの裏の繊細さ: "ノリの裏の繊細さ",
  飽きっぽい一面: "移り気な好奇心",
  詰めが甘い時: "あと一歩の抜け感",
  約束がゆるい: "ノリのいい安請け合い",
  重い話を避ける: "重さを笑いに変える癖",
  本当は一途: "本当は一途なところ",
  // whim-fox
  実は鋭く見てる: "実は鋭い観察眼",
  飽きが早い: "次へ向かう身軽さ",
  衝動的な一面: "考えるより先に動く勢い",
  縛られると逃げる: "自由でいたい心",
  情はある: "さりげない情の深さ",
  // dreamer-rabbit
  実はよく見てる: "実はよく見ている観察眼",
  先延ばしの一面: "気分待ちのスロースタート",
  考えすぎる: "想像がふくらみすぎる夜",
  流されやすい: "周りに寄り添いすぎる優しさ",
  傷を引きずる: "言葉を長く覚えている繊細さ",
  // fantasy-cat
  好きには熱い: "好きへの熱さ",
  気分の波: "気分のゆらぎ",
  マイペースすぎる時: "マイペースな横顔",
  連絡が省エネ: "省エネな連絡スタイル",
  我が道が頑固: "我が道をいく芯",
  無関心そうで見てる: "クールな顔の観察眼",
  // caretaker-dog
  実は甘え下手: "甘え下手な一面",
  お節介な一面: "世話焼きの先回り",
  抱え込みすぎ: "自分を後回しにする優しさ",
  心配性: "先回りしすぎる心配",
  断れない: "断り下手な優しさ",
  評価を気にする: "役に立ちたい気持ちの強さ",
  // earnest-elephant
  実は芯が強い: "控えめな顔の強い芯",
  我慢しすぎ: "飲みこみがちな我慢",
  自己主張が弱い: "ひかえめな主張",
  頑張りを隠す: "頑張りを見せない奥ゆかしさ",
  変化に戸惑う: "新しい風への助走",
  // steady-turtle
  実はよく感じてる: "動じない顔の下の感受性",
  融通がききにくい: "自分のやり方への愛着",
  言葉が少ない: "言葉少なな伝え方",
  変化に弱い: "ゆっくり馴染むペース",
  一人にこもる: "ひとり時間の心地よさ",
  // smiley-panda
  実は気を遣ってる: "ゆるさの裏の気くばり",
  本音を飲み込む: "本音をそっとしまう優しさ",
  のんびりしすぎ: "ゆったりすぎるテンポ",
  明るさの裏の繊細さ: "明るさの裏の繊細さ",
  // playful-raccoon
  実は寂しがり: "実は寂しがりな一面",
  飽きっぽい: "移り気な好奇心",
  後先考えない時: "考えるより先に動く勢い",
  自分勝手に映る時: "自由優先の正直さ",
  騒がしさの裏の繊細さ: "にぎやかさの裏の繊細さ",
  // gentle-koala
  実は芯がある: "ゆるさの奥の芯",
  希望を飲み込む: "希望をしまいがちな遠慮",
  決断が遅い: "じっくり選ぶ慎重さ",
  面倒を避けがち: "面倒ごとからの上手な逃げ足",
  // solo-hedgehog
  実は気にかけてる: "そっけなさの奥のやさしさ",
  寄せつけにくい: "ほどよい距離感",
  協調が苦手: "マイペースな横顔",
  そっけなく映る時: "クールに見える自由さ",
  一人を好む: "ひとりを楽しむ力",
};

// =====================================================================
// 文章の織り込みパターン
// =====================================================================

// 文末スタイル: "〜ている。" で終わる説明文にだけ伝聞・推量を足す (それ以外は原文のまま)
type EndStyle = "asis" | "mitai" | "youdesu";

function applyEnd(desc: string, style: EndStyle): string {
  if (!desc.endsWith("ている。")) return desc;
  if (style === "mitai") return `${desc.slice(0, -1)}みたい。`;
  if (style === "youdesu") return `${desc.slice(0, -1)}ようです。`;
  return desc;
}

interface Frame {
  /** キーワードの前に置く文 */
  pre: string;
  /** キーワードの直後 (説明文との橋渡し) */
  mid: string;
  end: EndStyle;
}

interface PatternSet {
  /** 段落分け (項目 index のグループ)。[[0,1],[2]] = 2 段落 */
  groups: number[][];
  frames: [Frame, Frame, Frame];
}

// 強みパート: 「友達に認定された」誇らしさのトーン
const STRENGTH_SETS: PatternSet[] = [
  {
    groups: [[0, 1], [2]],
    frames: [
      { pre: "いちばんまっすぐ伝わってきたのは、", mid: "。", end: "asis" },
      { pre: "あわせて、", mid: "も見抜かれていました。", end: "mitai" },
      { pre: "極めつきは、", mid: "。", end: "youdesu" },
    ],
  },
  {
    groups: [[0], [1, 2]],
    frames: [
      {
        pre: "3つの強みが、ちゃんと見つかっていました。まずは、",
        mid: "。",
        end: "mitai",
      },
      { pre: "つぎに、", mid: "。", end: "asis" },
      { pre: "そして何より大きかったのが、", mid: "。", end: "youdesu" },
    ],
  },
  {
    groups: [[0, 1], [2]],
    frames: [
      { pre: "", mid: "——最初に挙がったのは、この強み。", end: "asis" },
      { pre: "", mid: "にも、ちゃんと視線が届いています。", end: "mitai" },
      { pre: "そしてしめくくりに挙がったのは、", mid: "。", end: "youdesu" },
    ],
  },
];

// あれっ?パート: 指摘ではなく「ちゃんと見られてた」発見の驚き・温かさのトーン
const SURPRISE_SETS: PatternSet[] = [
  {
    groups: [[0, 1], [2]],
    frames: [
      { pre: "意外だったのは、", mid: "に気づかれていたこと。", end: "asis" },
      { pre: "", mid: "も、ちゃんと見られていました。", end: "mitai" },
      { pre: "そしてもうひとつ、", mid: "。", end: "youdesu" },
    ],
  },
  {
    groups: [[0], [1, 2]],
    frames: [
      {
        pre: "隠しているつもりでも、見ている人は見ています。たとえば、",
        mid: "。",
        end: "mitai",
      },
      { pre: "", mid: "にも気づかれていました。", end: "asis" },
      { pre: "それから、", mid: "。", end: "youdesu" },
    ],
  },
  {
    groups: [[0, 1], [2]],
    frames: [
      {
        pre: "",
        mid: "——そんなところまで、こっそり見つかっていました。",
        end: "asis",
      },
      { pre: "あわせて、", mid: "も。", end: "mitai" },
      { pre: "最後にもうひとつ、", mid: "。", end: "youdesu" },
    ],
  },
];

/** typeId から決定的なシード値 (Server Component で安定、型ごとにパターンが変わる) */
export function seedFromTypeId(typeId: string): number {
  let n = 0;
  for (const ch of typeId) n = (n + ch.charCodeAt(0)) % 997;
  return n;
}

/** 説明文から友達名の主語を除去 (主語省略で自然に読める形へ) */
function nameFreeDesc(body: string): string {
  return body
    .replace(/^\{B\}さん(?:に)?は、/, "")
    .replace(/\{B\}さん/g, "友達"); // 文中に残った場合の安全網
}

/**
 * 強み/あれっ? の 3 項目を 1〜2 段落の文章セグメントに織り込む。
 * items は PERCEIVED_BY_TYPE の先頭 3 つを渡す (残り 3 つは有料レポート用に温存)。
 */
export function weaveFound(
  items: RawItem[],
  kind: "strengths" | "surprises",
  seed: number,
): FoundParagraph[] {
  const sets = kind === "strengths" ? STRENGTH_SETS : SURPRISE_SETS;
  const set = sets[seed % sets.length];
  const three = items.slice(0, 3);
  const words = three.map((it) =>
    kind === "surprises" ? (SOFT_WORD[it.title] ?? it.title) : it.title,
  );
  const descs = three.map((it) => nameFreeDesc(it.body));
  return set.groups.map((group) =>
    group.flatMap((i) => {
      if (i >= three.length) return [];
      const f = set.frames[i];
      const segs: FoundSegment[] = [];
      if (f.pre) segs.push({ text: f.pre });
      segs.push({ text: words[i], pink: true });
      segs.push({ text: f.mid + applyEnd(descs[i], f.end) });
      return segs;
    }),
  );
}
