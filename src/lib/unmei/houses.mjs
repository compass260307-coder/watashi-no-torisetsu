// 出生図ホイールのハウス分割線用: Placidus 12ハウスのカスプ黄経を「描画時に」再計算する。
//
// 方針:
//   - 保存済み chart には ASC/MC しか無く、12カスプは保持していない。そこで chart の
//     datetime_utc + location からライブラリで再計算する(既存チャートにも即反映・再生成不要)。
//   - 日本出生前提(JST)。datetime_utc(UTC) に +9h して壁時計(JST)の年月日時分を復元し Origin に渡す。
//   - 時刻不明(houses_available !== true)や情報不足のときは null(=分割線を引かない)。
//   - House1(index0) = ASC、House10(index9) = MC。返すのは 12個の黄経(0〜360)。

import pkg from "circular-natal-horoscope-js";

const { Origin, Horoscope } = pkg;

export function computePlacidusHouses(chart) {
  if (!chart || chart.houses_available !== true) return null;
  const loc = chart.location;
  const lat = loc?.latitude;
  const lng = loc?.longitude;
  if (!chart.datetime_utc || typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }
  try {
    const utc = new Date(chart.datetime_utc);
    if (Number.isNaN(utc.getTime())) return null;
    // JST 壁時計 = UTC + 9h。getUTC* で JST の年月日時分を取り出す。
    const jst = new Date(utc.getTime() + 9 * 3600 * 1000);
    const origin = new Origin({
      year: jst.getUTCFullYear(),
      month: jst.getUTCMonth(), // 0-based
      date: jst.getUTCDate(),
      hour: jst.getUTCHours(),
      minute: jst.getUTCMinutes(),
      latitude: lat,
      longitude: lng,
    });
    const h = new Horoscope({
      origin,
      houseSystem: "placidus",
      zodiac: "tropical",
      aspectPoints: [],
      aspectWithPoints: [],
      aspectTypes: [],
    });
    if (!Array.isArray(h.Houses) || h.Houses.length !== 12) return null;
    const cusps = h.Houses.map(
      (hs) => hs?.ChartPosition?.StartPosition?.Ecliptic?.DecimalDegrees,
    );
    if (cusps.some((c) => typeof c !== "number")) return null;
    return cusps; // [12] 黄経。index0=House1(ASC)
  } catch {
    return null;
  }
}
