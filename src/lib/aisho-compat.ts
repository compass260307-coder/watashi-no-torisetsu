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

// 軸×状態のマイクロコピー辞書 (褒め文／ケア文兼用・状態に応じて読み替わる)。
// 各文は 2 文構成で、結果ページの地の文に馴染む長さ・トーン (「〜。」で完結)。
function axisCopy(key: AxisKey, x: Axes, y: Axes): string {
  const a = x[key];
  const b = y[key];
  switch (key) {
    case "A": {
      const s = pairState(a, b);
      return s === "both"
        ? "ふたりとも思いやりが深くて、相手の気持ちを先に考えられるタイプ。たとえば相手の元気がない日は、根掘り葉掘り聞かずにそっと「無理しないでね」と一言添えられる。だから多少ぶつかっても、どちらかが自然に折れて優しくほどけるし、根っこに「大事にしたい」があるから大きくこじれにくい。"
        : s === "one"
          ? "片方の優しさが、この関係の潤滑油になっているみたい。たとえば約束の時間に少し遅れても、片方が「気にしないで」と笑って受け止めてくれる場面が多いはず。ただ、いつも受け止めてくれる側に甘えすぎず、たまには自分から「ありがとう」と労う側に回れると、ぐっと対等で心地いいバランスになるよ。"
          : "お互い率直にものを言えるぶん、遠慮のない一言がふっと刺さることもある。たとえば疲れている日に「それ違くない?」と正論を返されると、内容は正しくてもチクッとくるもの。悪気はないと分かっていても、忙しい日ほど言葉は選びたい。ひと言の労いがあるだけで、空気は全然変わるはず。";
    }
    case "N": {
      const s = pairState(a, b);
      return s === "both"
        ? "ふたりとも繊細で、相手の機嫌や場の空気によく気づけるタイプ。たとえば返信が半日こないだけで「なにか怒らせたかな」と、ふたりそろって不安になりがち。やさしさの裏返しで不安が伝染しやすいから、モヤモヤは一人で抱え込まず、その日のうちに「ちょっと心配だっただけ」と言葉にできると安定する。"
        : s === "one"
          ? "片方の気持ちが揺れた日も、もう片方がどっしり受け止めてくれる関係。たとえばテスト前でピリついていても、片方が「大丈夫、なんとかなるって」と場の空気を落ち着かせてくれる。感情の波を片方が引き受けてくれるから、大崩れしにくくて安心感がある。"
          : "ふたりとも情緒が安定していて、多少の荒波でも動じないコンビ。たとえば楽しみにしていた予定が急に流れても、引きずらず「じゃあ次いつにする?」とすぐ切り替えられる。感情戦になりにくいから、もめても「で、どうする?」とすぐ建設モードに戻れる。";
    }
    case "O":
      return a === b
        ? "見ている世界の方向がそっくりで、話しても遊んでも話題が尽きない。たとえば同じ動画や音楽に同時に「これ好き」となって、深夜までLINEが止まらなくなるタイプ。「それな」が止まらないから、一緒にいて一番ラクな相手になりやすい。"
        : "価値観は違うけれど、そのぶんお互いが、自分ひとりでは出会わない景色を見せてくれる。たとえば片方が誘うイベントやお店は、もう片方にとっては初めての世界だったりする。刺激をくれる相手として、世界を広げ合える関係だよ。";
    case "C":
      return a === b
        ? "計画やペースの感覚が近くて、一緒に動いても擦れにくい。たとえば旅行でも「とりあえず集合だけ決めて、あとは現地でゆるく」の温度感がぴったり合う。段取りのテンポが同じだから、遊びも課題も気持ちよく進められる。"
        : "片方は計画派、片方は勢い派。たとえば片方がしおりを作りこむ横で、もう片方は「当日のノリでよくない?」となりがち。でも最初に締め切りと集合だけ決めておけば、この違いはむしろ噛み合って、楽しくて速いコンビになる。";
    case "E":
      if (a !== b)
        return "場を回す側と、じっくり深める側の凸凹コンビ。たとえば飲み会では片方が全体を盛り上げて、もう片方は隣で一人ひとりの話をちゃんと聞いている。正反対だからこそ役割が自然に分かれて、グループでもふたりでも心地よく機能する。";
      return a
        ? "ふたりとも外向きでエネルギッシュ。たとえば「今から集まらない?」の急な誘いにも、ふたりともノリよく乗れるタイプ。テンションの上がるポイントが同じだから、賑やかで飽きのこない関係になりやすい。"
        : "ふたりとも静かな時間を大切にするタイプ。たとえば同じ部屋でそれぞれスマホを見ているだけでも、沈黙が気まずくならず、むしろ心地いい。無理に盛り上げなくていいから、一緒にいてもどこか落ち着く関係だよ。";
  }
}

// サマリー (%帯)
function summaryFor(percent: number): string {
  if (percent >= 90) return "運命級の相性";
  if (percent >= 75) return "かなりの好相性";
  if (percent >= 60) return "バランスのいいふたり";
  if (percent >= 45) return "歩み寄りで輝くふたり";
  return "試練は多いが、学びも大きい";
}

// 相性ランク S/A/B/C (表示% 40〜95 を4段階に)。
//   S ≥85 / A ≥70 / B ≥55 / C それ未満。結果ページはこのランクの画像を主役表示する。
export type CompatRank = "S" | "A" | "B" | "C";
function rankFor(percent: number): CompatRank {
  if (percent >= 85) return "S";
  if (percent >= 70) return "A";
  if (percent >= 55) return "B";
  return "C";
}

export interface CompatResult {
  raw: number; // 素点 (26〜100)
  percent: number; // 表示% (40〜95)
  stars: number; // 1〜5
  rank: CompatRank; // 相性ランク S/A/B/C
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
    rank: rankFor(percent),
    s,
    summary: summaryFor(percent),
    goods,
    caution,
  };
}
