// 相性診断ロジック (ルールベース・LLM不使用＝B-1思想)
//
// 型テーブルに 0-10 数値は無い (Step1確定)。各タイプは 5軸の高低(±)二値のみ。
// → 数値化せず、ThirtyTwoType.code ("O＋C＋E＋A＋N＋") を parseAxes で各軸bool化し、
//   軸ごとの効き方テーブルを直引きして合成する。
//   ※ 高低→数値(8/2・10/0等)マッピングは採用しない (8/2だと★5が構造上出ないため経路自体を回避)。
//
// 実データで確認済みの文字コード: ＋ = U+FF0B (高=true) / − = U+2212 (低=false)。

import { thirtyTwoType, type ThirtyTwoTypeId } from "./thirty-two-types";

const PLUS = "＋"; // U+FF0B = 高

export interface Axes {
  O: boolean;
  C: boolean;
  E: boolean;
  A: boolean;
  N: boolean;
}

export type AxisKey = "A" | "N" | "O" | "C" | "E";

// code ("O＋C＋E＋A＋N＋") をパースし { O,C,E,A,N } の boolean を返す。
// 各軸文字の直後が ＋(U+FF0B) なら高=true、それ以外(−=U+2212)は低=false。
export function parseAxes(code: string): Axes {
  const read = (axis: string): boolean => {
    const i = code.indexOf(axis);
    return i >= 0 && code[i + 1] === PLUS;
  };
  return {
    O: read("O"),
    C: read("C"),
    E: read("E"),
    A: read("A"),
    N: read("N"),
  };
}

// 両者の true 数で 3状態に分類 (A/N の レベル系軸で使用)
type PairState = "both" | "one" | "none";
function pairState(a: boolean, b: boolean): PairState {
  if (a && b) return "both";
  if (a || b) return "one";
  return "none";
}

// 各軸を 0-1 で算出。x,y について対称。
function axisScores(x: Axes, y: Axes): Record<AxisKey, number> {
  // A 思いやり: レベル (高いほど良／片方でも救われる)  両＋1.0 / 片＋0.6 / 両−0.15
  const a = pairState(x.A, y.A);
  const sA = a === "both" ? 1.0 : a === "one" ? 0.6 : 0.15;
  // N 情緒(＋=繊細/N高): 逆レベル (両繊細で不安増幅)  両＋0.2 / 片＋0.55 / 両−1.0
  const n = pairState(x.N, y.N);
  const sN = n === "both" ? 0.2 : n === "one" ? 0.55 : 1.0;
  // O 価値観: 類似  一致1.0 / 不一致0.35
  const sO = x.O === y.O ? 1.0 : 0.35;
  // C 生活リズム: 類似  一致1.0 / 不一致0.35
  const sC = x.C === y.C ? 1.0 : 0.35;
  // E 社交: 補完 (確定)  不一致1.0 / 一致0.35
  const sE = x.E !== y.E ? 1.0 : 0.35;
  return { A: sA, N: sN, O: sO, C: sC, E: sE };
}

// 軸×状態のマイクロコピー辞書 (褒め文／ケア文兼用・状態に応じて読み替わる)
function axisCopy(key: AxisKey, x: Axes, y: Axes): string {
  const a = x[key];
  const b = y[key];
  switch (key) {
    case "A": {
      const s = pairState(a, b);
      return s === "both"
        ? "二人とも思いやりが深く、ぶつかっても優しくほどける土台がある"
        : s === "one"
          ? "片方の優しさが関係の潤滑油。受け取る側も甘えすぎない意識を"
          : "お互い率直な分、遠慮のない一言が刺さりやすい。労いの言葉を意識して";
    }
    case "N": {
      const s = pairState(a, b);
      return s === "both"
        ? "二人とも繊細。不安が伝染しやすいので、抱え込まず言葉にするのがコツ"
        : s === "one"
          ? "片方が揺れても、もう片方が支えになれるバランス"
          : "二人とも情緒が安定していて、多少の荒波でも動じないコンビ";
    }
    case "O":
      return a === b
        ? "見ている世界の方向が揃っていて、話しても遊んでも尽きない"
        : "価値観は違うけれど、その分お互いが新しい景色を見せてくれる";
    case "C":
      return a === b
        ? "計画やペースの感覚が近く、一緒に動いても擦れにくい"
        : "片方は計画派、片方は勢い派。役割を分ければ噛み合う";
    case "E":
      if (a !== b)
        return "場を回す側と深める側の凸凹コンビ。正反対だからかみ合う";
      return a
        ? "二人とも外向きでエネルギッシュ、賑やかな関係"
        : "二人とも静かな時間を大切にする、落ち着いた関係";
  }
}

// サマリー (%帯)
function summaryFor(percent: number): string {
  if (percent >= 90) return "運命級の相性";
  if (percent >= 75) return "かなりの好相性";
  if (percent >= 60) return "バランスのいい二人";
  if (percent >= 45) return "歩み寄りで輝く二人";
  return "試練は多いが、学びも大きい";
}

export interface CompatResult {
  raw: number; // 素点 (26〜100)
  percent: number; // 表示% (40〜95)
  stars: number; // 1〜5
  s: Record<AxisKey, number>;
  summary: string;
  goods: string[]; // 良いところ (s降順トップ2軸)
  caution: string; // 気をつけるところ (s昇順最下位1軸・トップ2と重複したら次点)
}

// s の合成順 (タイ時の決定順・O(1)で対称)
const AXIS_ORDER: AxisKey[] = ["A", "N", "O", "C", "E"];

export function compat(aId: ThirtyTwoTypeId, bId: ThirtyTwoTypeId): CompatResult {
  const x = parseAxes(thirtyTwoType(aId).code);
  const y = parseAxes(thirtyTwoType(bId).code);
  const s = axisScores(x, y);

  const raw = 30 * s.A + 20 * s.N + 20 * s.O + 15 * s.C + 15 * s.E; // 26〜100
  let percent = Math.round(40 + ((raw - 26) / 74) * 55);
  percent = Math.max(40, Math.min(95, percent)); // 丸め保険
  const stars =
    percent >= 90 ? 5 : percent >= 75 ? 4 : percent >= 60 ? 3 : percent >= 45 ? 2 : 1;

  // 良いところ = s降順トップ2軸のコピー
  const desc = [...AXIS_ORDER].sort((p, q) => s[q] - s[p]);
  const top2 = desc.slice(0, 2);
  const goods = top2.map((k) => axisCopy(k, x, y));

  // 気をつけるところ = s昇順で最下位、ただしトップ2と重複したら次点
  const asc = [...AXIS_ORDER].sort((p, q) => s[p] - s[q]);
  const cautionKey = asc.find((k) => !top2.includes(k)) ?? asc[0];
  const caution = axisCopy(cautionKey, x, y);

  return {
    raw,
    percent,
    stars,
    s,
    summary: summaryFor(percent),
    goods,
    caution,
  };
}
