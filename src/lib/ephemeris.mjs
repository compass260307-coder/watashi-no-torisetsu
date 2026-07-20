// エフェメリス計算 (西洋占星術ネイタルチャート)。
//
// ライブラリ選定 (指示書③ ①): circular-natal-horoscope-js を採用。
//   - 純JS・データファイル/ネイティブバイナリ不要 → Vercel サーバレスで動作。
//   - 緯度経度から政治的タイムゾーン(+歴史的サマータイム)を導出し UTC を算出。
//     日本の出生地なら JST として扱われる(指示書③: 日本出生前提でJST固定)。
//   - フィクスチャ(2004-04-26 02:00 JST 北九州)で
//     太陽=牡牛5.8° / 月=蟹13.4° / ASC=水瓶16.4° / MC=射手2.0° を許容誤差内で再現することを
//     scripts/ephemeris-test.mjs で検証。
//
// 入力: dateIso(出生日時。JST オフセット付き ISO)、latitude/longitude、timeUnknown。
//   - timeUnknown=true のとき: 正午仮定で天体のみ算出し、ASC/MC は出さず houses_available=false。
// 出力(chart JSON): 太陽〜冥王星の星座・サイン内度数、ASC/MC(時刻既知時)。

import pkg from "circular-natal-horoscope-js";

const { Origin, Horoscope } = pkg;

// dateIso("YYYY-MM-DDThh:mm...") から「現地の暦上の時刻」成分を取り出す。
// circular-natal-horoscope-js は現地時刻を受け取り、緯度経度からタイムゾーンを導出するため、
// ここでは UTC 変換せず壁時計の値をそのまま渡す(オフセットはライブラリが座標から再導出)。
function parseLocalParts(dateIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(dateIso));
  if (!m) throw new Error(`invalid dateIso: ${dateIso}`);
  return {
    year: Number(m[1]),
    month: Number(m[2]) - 1, // 0-indexed (0=1月)
    date: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
}

// サイン内度数 (0〜30) に丸める。DecimalDegrees は黄道絶対経度 (0〜360)。
function positionOf(body) {
  const abs = body?.ChartPosition?.Ecliptic?.DecimalDegrees;
  const sign = body?.Sign?.label;
  if (typeof abs !== "number" || !sign) return null;
  const within = ((abs % 30) + 30) % 30;
  return { sign, degree: Math.round(within * 10) / 10 };
}

const PLANET_KEYS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];

export function computeNatalChart({ dateIso, latitude, longitude, timeUnknown = false }) {
  const parts = parseLocalParts(dateIso);
  const lat = typeof latitude === "number" ? latitude : 35.6895; // 東京フォールバック
  const lng = typeof longitude === "number" ? longitude : 139.6917;

  const origin = new Origin({
    year: parts.year,
    month: parts.month,
    date: parts.date,
    hour: parts.hour,
    minute: parts.minute,
    latitude: lat,
    longitude: lng,
  });

  const horoscope = new Horoscope({
    origin,
    houseSystem: "placidus",
    zodiac: "tropical",
    aspectPoints: [],
    aspectWithPoints: [],
    aspectTypes: [],
  });

  const planets = {};
  for (const key of PLANET_KEYS) {
    const pos = positionOf(horoscope.CelestialBodies?.[key]);
    if (pos) planets[key] = pos;
  }

  const utc =
    origin.utcTime?.toISOString?.() ?? new Date(dateIso).toISOString();

  const chart = {
    source: "circular-natal-horoscope-js",
    datetime_utc: utc,
    location: { latitude: lat, longitude: lng },
    houses_available: !timeUnknown,
    planets,
  };

  // 時刻既知のときのみ ASC/MC を出す (時刻不明ではハウス計算が無意味)。
  if (!timeUnknown) {
    const asc = positionOf(horoscope.Ascendant);
    const mc = positionOf(horoscope.Midheaven);
    if (asc) chart.asc = asc;
    if (mc) chart.mc = mc;
  }

  return chart;
}
