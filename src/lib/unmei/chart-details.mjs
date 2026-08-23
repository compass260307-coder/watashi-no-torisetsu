// 出生図「詳細データ一覧」用: 保存済み chart から表示に必要な値を描画時に算出する純関数。
//
// 方針 (houses.mjs と同じ「描画時再計算」・DB変更/再生成不要):
//   - 天体の星座・サイン内度数は保存済み (chart.planets[key] = {sign, degree}) をそのまま使う。
//   - 逆行(R) は未保存 → datetime_utc + 緯度経度からライブラリで再計算 (isRetrograde)。
//     逆行は日付主体なので時刻不明(正午仮定)チャートでも算出できる。
//   - ハウスカスプ12個 + 各天体の所属ハウスは時刻既知(houses_available)のみ。時刻不明は null。
//   - 4区分エレメント(火地風水)は星座から決定的に導出 (10天体をカウント)。
//
// 返り値: { timeUnknown, planets[], extras[](ASC/MC), elements{}, dominant, maxCount, houseCusps[]|null }

import pkg from "circular-natal-horoscope-js";
const { Origin, Horoscope } = pkg;

const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const SIGN_JA = {
  Aries: "牡羊座", Taurus: "牡牛座", Gemini: "双子座", Cancer: "蟹座",
  Leo: "獅子座", Virgo: "乙女座", Libra: "天秤座", Scorpio: "蠍座",
  Sagittarius: "射手座", Capricorn: "山羊座", Aquarius: "水瓶座", Pisces: "魚座",
};
const SIGN_SYMBOL = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
// 星座インデックス%4 → エレメント (牡羊=火, 牡牛=地, 双子=風, 蟹=水, 獅子=火, …)
const ELEMENT_BY_MOD = ["fire", "earth", "air", "water"];

const PLANET_ORDER = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const PLANET_JA = {
  sun: "太陽", moon: "月", mercury: "水星", venus: "金星", mars: "火星",
  jupiter: "木星", saturn: "土星", uranus: "天王星", neptune: "海王星", pluto: "冥王星",
};
const PLANET_SYMBOL = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

function signIndex(sign) {
  return SIGN_ORDER.indexOf(sign);
}
function absLon(sign, degree) {
  const i = signIndex(sign);
  return (i < 0 ? 0 : i * 30) + (typeof degree === "number" ? degree : 0);
}
// 黄経 lon がどのハウスにあるか (cusps は 12個・黄道順)。該当ハウス番号(1-12) or null。
function houseOf(lon, cusps) {
  const L = ((lon % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const a = ((cusps[i] % 360) + 360) % 360;
    const b = ((cusps[(i + 1) % 12] % 360) + 360) % 360;
    const span = ((b - a) % 360 + 360) % 360;
    const off = ((L - a) % 360 + 360) % 360;
    if (off < span) return i + 1;
  }
  return null;
}

// ライブラリを再計算して {retro: {key:bool|null}, cusps: number[]|null} を返す。失敗時は両方 null。
function recompute(chart) {
  const loc = chart.location;
  const lat = loc?.latitude;
  const lng = loc?.longitude;
  if (!chart.datetime_utc || typeof lat !== "number" || typeof lng !== "number") {
    return { retro: null, cusps: null };
  }
  try {
    const utc = new Date(chart.datetime_utc);
    if (Number.isNaN(utc.getTime())) return { retro: null, cusps: null };
    const jst = new Date(utc.getTime() + 9 * 3600 * 1000); // JST 壁時計
    const origin = new Origin({
      year: jst.getUTCFullYear(), month: jst.getUTCMonth(), date: jst.getUTCDate(),
      hour: jst.getUTCHours(), minute: jst.getUTCMinutes(), latitude: lat, longitude: lng,
    });
    const h = new Horoscope({ origin, houseSystem: "placidus", zodiac: "tropical", aspectPoints: [], aspectWithPoints: [], aspectTypes: [] });
    const retro = {};
    for (const k of PLANET_ORDER) {
      const b = h.CelestialBodies?.[k];
      retro[k] = b && typeof b.isRetrograde === "boolean" ? b.isRetrograde : null;
    }
    let cusps = null;
    if (chart.houses_available === true && Array.isArray(h.Houses) && h.Houses.length === 12) {
      const cc = h.Houses.map((hs) => hs?.ChartPosition?.StartPosition?.Ecliptic?.DecimalDegrees);
      if (cc.every((c) => typeof c === "number")) cusps = cc;
    }
    return { retro, cusps };
  } catch {
    return { retro: null, cusps: null };
  }
}

export function computeChartDetails(chart) {
  if (!chart || !chart.planets) return null;
  const timeUnknown = chart.houses_available !== true;
  const { retro, cusps } = recompute(chart);

  const planets = [];
  for (const k of PLANET_ORDER) {
    const p = chart.planets[k];
    if (!p || typeof p.degree !== "number" || !p.sign) continue;
    const idx = signIndex(p.sign);
    const lon = absLon(p.sign, p.degree);
    planets.push({
      key: k,
      symbol: PLANET_SYMBOL[k],
      name: PLANET_JA[k],
      sign: SIGN_JA[p.sign] ?? p.sign,
      signSymbol: idx >= 0 ? SIGN_SYMBOL[idx] : "",
      degree: p.degree,
      element: idx >= 0 ? ELEMENT_BY_MOD[idx % 4] : null,
      retro: retro ? retro[k] : null,
      house: cusps ? houseOf(lon, cusps) : null,
    });
  }

  // ASC / MC (時刻既知時のみ chart に存在)。逆行なし・ハウスは定義上 1 / 10。
  const extras = [];
  if (!timeUnknown) {
    for (const [k, name, symbol, house] of [["asc", "上昇宮", "ASC", 1], ["mc", "天頂", "MC", 10]]) {
      const p = chart[k];
      if (p && typeof p.degree === "number" && p.sign) {
        const idx = signIndex(p.sign);
        extras.push({
          key: k, symbol, name, sign: SIGN_JA[p.sign] ?? p.sign,
          signSymbol: idx >= 0 ? SIGN_SYMBOL[idx] : "", degree: p.degree,
          element: idx >= 0 ? ELEMENT_BY_MOD[idx % 4] : null, retro: null, house,
        });
      }
    }
  }

  // エレメント集計 (10天体)。
  const elements = { fire: 0, earth: 0, air: 0, water: 0 };
  for (const r of planets) if (r.element) elements[r.element] += 1;
  const maxCount = Math.max(elements.fire, elements.earth, elements.air, elements.water);
  const dominant = maxCount > 0
    ? (["fire", "earth", "air", "water"].find((e) => elements[e] === maxCount) ?? null)
    : null;

  // ハウスカスプ一覧 (時刻既知時のみ)。
  const houseCusps = cusps
    ? cusps.map((lon, i) => {
        const n = ((lon % 360) + 360) % 360;
        const si = Math.floor(n / 30) % 12;
        return {
          house: i + 1,
          sign: SIGN_JA[SIGN_ORDER[si]],
          signSymbol: SIGN_SYMBOL[si],
          degree: Math.round((n - si * 30) * 10) / 10,
        };
      })
    : null;

  return { timeUnknown, planets, extras, elements, dominant, maxCount, houseCusps };
}
