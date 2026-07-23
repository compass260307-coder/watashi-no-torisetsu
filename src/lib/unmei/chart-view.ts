// 出生図ホイールの表示用ビューモデル & レイアウト (純関数・エフェメリス非依存)。
//
// 方針:
//   - chart(エフェメリス結果) から「円に描くための座標・ラベル・一覧」を組み立てる。
//   - 占星術記号(☉☽…)は使わず日本語表記。星座も日本語。
//   - 月は時刻不明だと日周移動(約13°)で位置が確定しないため、点ではなく範囲(弧)で扱う。
//     範囲(moonArc)は呼び出し側がエフェメリスで算出して渡す(この層はエフェメリスに依存しない)。
//   - SVG座標(layoutWheel)もここで算出し、React描画とテスト用SVGダンプで同じ計算を共有する。

export const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

export const SIGN_JA: Record<string, string> = {
  Aries: "牡羊座", Taurus: "牡牛座", Gemini: "双子座", Cancer: "蟹座",
  Leo: "獅子座", Virgo: "乙女座", Libra: "天秤座", Scorpio: "蠍座",
  Sagittarius: "射手座", Capricorn: "山羊座", Aquarius: "水瓶座", Pisces: "魚座",
};

// 図に載せる天体 = 古典7天体 + ASC/MC (ASC/MC は時刻既知時のみ chart に存在)。
export const BODY_JA: Record<string, string> = {
  sun: "太陽", moon: "月", mercury: "水星", venus: "金星",
  mars: "火星", jupiter: "木星", saturn: "土星", asc: "上昇宮", mc: "天頂",
};
const CLASSIC = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"] as const;

export type Pos = { sign: string; degree: number };
export type Chart = {
  planets?: Record<string, Pos>;
  asc?: Pos;
  mc?: Pos;
  houses_available?: boolean;
  location?: { latitude: number; longitude: number };
  datetime_utc?: string;
};
export type MoonArc = { startLon: number; endLon: number; start: Pos; end: Pos };

export type WheelBody = { key: string; label: string; lon: number };
export type Aspect = { fromLon: number; toLon: number };
export type ChartView = {
  timeUnknown: boolean;
  points: WheelBody[]; // 点で描く天体 (時刻不明時は月を含まない)
  moonArc: MoonArc | null; // 時刻不明時の月の範囲 (弧)
  aspects: Aspect[]; // 天体同士の主要アスペクト線 (古典7天体のみ。ASC/MC・時刻不明の月[弧]は除外)
  listItems: { key: string; label: string; text: string }[];
  ariaLabel: string;
};

// 黄経(絶対角度 0〜360)。星座インデックス×30 + 星座内度数。
export function absLon(p: Pos): number {
  const i = SIGN_ORDER.indexOf(p.sign as (typeof SIGN_ORDER)[number]);
  return (i < 0 ? 0 : i * 30) + (typeof p.degree === "number" ? p.degree : 0);
}
export function signJa(sign: string): string {
  return SIGN_JA[sign] ?? sign;
}
export function fmtPos(p: Pos): string {
  return `${signJa(p.sign)}${p.degree.toFixed(1)}°`;
}

// 主要アスペクト(角度)とオーブ。60°(セクスタイル)は本数を抑えるため ±4°、他は ±6°。
const ASPECT_DEFS: { angle: number; orb: number }[] = [
  { angle: 0, orb: 6 },
  { angle: 60, orb: 4 },
  { angle: 90, orb: 6 },
  { angle: 120, orb: 6 },
  { angle: 180, orb: 6 },
];
// 2つの黄経の角度差 (0〜180)。
function separationDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// chart + (時刻不明時の) moonArc からビューモデルを組み立てる。
export function buildChartView(
  chart: Chart | null | undefined,
  opts: { timeUnknown?: boolean; moonArc?: MoonArc | null },
): ChartView | null {
  if (!chart || !chart.planets || !chart.planets.sun) return null;
  const timeUnknown = opts.timeUnknown ?? chart.houses_available === false;
  const moonArc = timeUnknown ? opts.moonArc ?? null : null;
  const planets = chart.planets;
  const points: WheelBody[] = [];
  const listItems: ChartView["listItems"] = [];

  for (const key of CLASSIC) {
    const p = planets[key];
    if (!p || !p.sign) continue;
    if (key === "moon" && timeUnknown) {
      // 時刻不明の月は点にしない(推定値を確定値として描かない)。一覧は範囲表記。
      if (moonArc) {
        const s = moonArc.start;
        const e = moonArc.end;
        const text =
          s.sign === e.sign
            ? `${signJa(s.sign)}${Math.floor(s.degree)}°〜${Math.floor(e.degree)}°のあいだ`
            : `${signJa(s.sign)}${Math.floor(s.degree)}°〜${signJa(e.sign)}${Math.floor(e.degree)}°のあいだ`;
        listItems.push({ key, label: BODY_JA[key], text });
      } else {
        listItems.push({ key, label: BODY_JA[key], text: "時刻不明のため位置未確定" });
      }
      continue;
    }
    points.push({ key, label: BODY_JA[key], lon: absLon(p) });
    listItems.push({ key, label: BODY_JA[key], text: fmtPos(p) });
  }
  // ASC/MC (時刻既知時のみ)
  for (const key of ["asc", "mc"] as const) {
    const p = chart[key];
    if (p && p.sign) {
      points.push({ key, label: BODY_JA[key], lon: absLon(p) });
      listItems.push({ key, label: BODY_JA[key], text: fmtPos(p) });
    }
  }

  // アスペクト線: 描画する全点 (古典7天体 + ASC/MC) 同士。時刻不明の月[弧]は points に無く対象外。
  const aspectPoints = points;
  const aspects: Aspect[] = [];
  for (let i = 0; i < aspectPoints.length; i++) {
    for (let j = i + 1; j < aspectPoints.length; j++) {
      const s = separationDeg(aspectPoints[i].lon, aspectPoints[j].lon);
      for (const def of ASPECT_DEFS) {
        if (Math.abs(s - def.angle) <= def.orb) {
          aspects.push({
            fromLon: aspectPoints[i].lon,
            toLon: aspectPoints[j].lon,
          });
          break;
        }
      }
    }
  }

  const ariaLabel =
    "出生図。" + listItems.map((it) => `${it.label} ${it.text}`).join("、");
  return { timeUnknown, points, moonArc, aspects, listItems, ariaLabel };
}

// ===== SVG レイアウト (純幾何・React とダンプで共有) =====

export const WHEEL = {
  size: 340,
  cx: 170,
  cy: 170,
  rOuter: 150, // 外周円
  rBand: 128, // 星座帯の内側境界円 (帯をやや細く: 120→128)
  rSignText: 138, // 星座名の半径 (帯の中央に合わせる)
  rDot: 104, // 天体の点 / 月の弧
  rLabel: 78, // 天体名ラベル(内側)
  labelGapDeg: 15, // ラベルの最小角度間隔(重なり回避)
} as const;

// 黄経 lon(0=牡羊座0°) を固定向きで座標に。牡羊座0°を左(9時)、反時計回りに黄経が増加。
export function polar(r: number, lon: number): [number, number] {
  const a = ((180 - lon) * Math.PI) / 180;
  return [WHEEL.cx + r * Math.cos(a), WHEEL.cy + r * Math.sin(a)];
}

// 近接天体のラベルを重ならないよう最小角度間隔まで押し広げる(点は正確な位置のまま)。
function declump(items: { lon: number }[], gap: number): number[] {
  const idx = items.map((_, i) => i).sort((a, b) => items[a].lon - items[b].lon);
  const adj: number[] = new Array(items.length);
  let prev = -Infinity;
  for (const i of idx) {
    let v = items[i].lon;
    if (v < prev + gap) v = prev + gap;
    adj[i] = v;
    prev = v;
  }
  return adj; // items と同じ並びの調整後 lon
}

export type WheelLayout = {
  size: number;
  stars: { x: number; y: number; r: number; o: number }[];
  aspectLines: { x1: number; y1: number; x2: number; y2: number }[];
  circles: { r: number }[];
  ticks: { x1: number; y1: number; x2: number; y2: number }[];
  signLabels: { x: number; y: number; text: string }[];
  dots: { x: number; y: number }[];
  leaders: { x1: number; y1: number; x2: number; y2: number }[];
  bodyLabels: { x: number; y: number; text: string }[];
  moonPath: string | null;
  moonCaps: { x1: number; y1: number; x2: number; y2: number }[];
};

// ビューモデルから描画プリミティブ(座標)を生成する。
export function layoutWheel(view: ChartView): WheelLayout {
  const { rOuter, rBand, rSignText, rDot, rLabel, labelGapDeg, size } = WHEEL;

  const circles = [{ r: rOuter }, { r: rBand }];

  // 背景の星: 本物の星空風。小さく淡い星が大多数・明るい大きな星は少数。疎密のムラをつける。
  // 決定的な擬似乱数(sinハッシュ)で固定 = SSRとダンプで一致。
  const stars: WheelLayout["stars"] = [];
  let starSeed = 0;
  const rnd = () => {
    starSeed += 1;
    const v = Math.sin(starSeed * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let placed = 0, tries = 0; placed < 84 && tries < 2600; tries++) {
    const x = 5 + rnd() * (size - 10);
    const y = 5 + rnd() * (size - 10);
    if (Math.hypot(x - WHEEL.cx, y - WHEEL.cy) <= rOuter + 3) continue; // 円の内側・縁は避ける
    // 疎密のムラ: 低周波の密度場で間引く (完全ランダムを避け、濃い所と疎な所を作る)
    const density =
      0.3 +
      0.7 * Math.abs(Math.sin(x * 0.031 + y * 0.019) * Math.cos(x * 0.015 - y * 0.036));
    if (rnd() > density) continue;
    const t = rnd(); // 星の「等級」0..1
    stars.push({
      x,
      y,
      r: 0.3 + 0.9 * Math.pow(t, 3), // 極小(0.3)を圧倒的に多く、たまに小(〜1.2)
      // 空気遠近法: 星は最も奥=最も淡い層。全要素より暗く抑える(相対的な明暗差は残す)。
      o: 0.05 + 0.13 * Math.pow(t, 1.4), // 0.05〜0.18 (星座名0.22より暗い)
    });
    placed += 1;
  }

  // アスペクト線: 点リング(rDot)上で2天体を結ぶ弦。最背面に描く。
  const aspectLines = view.aspects.map((a) => {
    const [x1, y1] = polar(rDot, a.fromLon);
    const [x2, y2] = polar(rDot, a.toLon);
    return { x1, y1, x2, y2 };
  });

  // 星座分割(12本)と星座名(セクター中央)
  const ticks: WheelLayout["ticks"] = [];
  const signLabels: WheelLayout["signLabels"] = [];
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = polar(rBand, i * 30);
    const [x2, y2] = polar(rOuter, i * 30);
    ticks.push({ x1, y1, x2, y2 });
    const [tx, ty] = polar(rSignText, i * 30 + 15);
    signLabels.push({ x: tx, y: ty, text: SIGN_JA[SIGN_ORDER[i]] });
  }

  // ラベル用マーカー = 点の天体 + (時刻不明の)月(弧の中央角度で配置)
  const markers: { key: string; label: string; lon: number }[] = view.points.map(
    (p) => ({ key: p.key, label: p.label, lon: p.lon }),
  );
  if (view.moonArc) {
    const { startLon, endLon } = view.moonArc;
    const delta = ((endLon - startLon) % 360 + 360) % 360;
    markers.push({ key: "moon", label: "月", lon: (startLon + delta / 2) % 360 });
  }

  const adj = declump(markers, labelGapDeg);
  const dots: WheelLayout["dots"] = [];
  const leaders: WheelLayout["leaders"] = [];
  const bodyLabels: WheelLayout["bodyLabels"] = [];
  markers.forEach((m, i) => {
    const isMoonArc = m.key === "moon" && view.moonArc;
    if (!isMoonArc) {
      const [dx, dy] = polar(rDot, m.lon);
      dots.push({ x: dx, y: dy });
    }
    const [lx, ly] = polar(rLabel, adj[i]);
    const [ax, ay] = polar(rDot - 4, m.lon);
    leaders.push({ x1: ax, y1: ay, x2: lx, y2: ly });
    bodyLabels.push({ x: lx, y: ly, text: m.label });
  });

  // 月の弧(時刻不明): リング上を1°刻みでサンプルした細線 + 両端の小さなキャップ
  let moonPath: string | null = null;
  const moonCaps: WheelLayout["moonCaps"] = [];
  if (view.moonArc) {
    const { startLon, endLon } = view.moonArc;
    const delta = ((endLon - startLon) % 360 + 360) % 360;
    const steps = Math.max(2, Math.ceil(delta));
    const pts: string[] = [];
    for (let k = 0; k <= steps; k++) {
      const lon = startLon + (delta * k) / steps;
      const [x, y] = polar(rDot, lon);
      pts.push(`${k === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    moonPath = pts.join(" ");
    for (const lon of [startLon, endLon]) {
      const [x1, y1] = polar(rDot - 4, lon);
      const [x2, y2] = polar(rDot + 4, lon);
      moonCaps.push({ x1, y1, x2, y2 });
    }
  }

  return { size, stars, aspectLines, circles, ticks, signLabels, dots, leaders, bodyLabels, moonPath, moonCaps };
}
