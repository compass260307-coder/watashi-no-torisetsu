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
export type ChartView = {
  timeUnknown: boolean;
  points: WheelBody[]; // 点で描く天体 (時刻不明時は月を含まない)
  moonArc: MoonArc | null; // 時刻不明時の月の範囲 (弧)
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

  const ariaLabel =
    "出生図。" + listItems.map((it) => `${it.label} ${it.text}`).join("、");
  return { timeUnknown, points, moonArc, listItems, ariaLabel };
}

// ===== SVG レイアウト (純幾何・React とダンプで共有) =====

export const WHEEL = {
  size: 340,
  cx: 170,
  cy: 170,
  rOuter: 150, // 外周円
  rBand: 120, // 星座帯の内側境界円
  rSignText: 135, // 星座名の半径
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

  return { size, circles, ticks, signLabels, dots, leaders, bodyLabels, moonPath, moonCaps };
}
