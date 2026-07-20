// エフェメリス計算の自動テスト。
//   実行: node scripts/ephemeris-test.mjs   (npm run ephemeris:test)
//
// 1) フィクスチャ(2004-04-26 02:00 JST 北九州)が既知の期待値を許容誤差内で再現するか。
// 2) 別の日付(2000-01-01 12:00 東京)でも妥当な値が出るか(星座・度数の範囲を検証)。

import { computeNatalChart } from "../src/lib/ephemeris.mjs";

const DEG_TOL = 0.6; // 度数の許容誤差
let failed = false;

function approxEqual(a, b, tol = DEG_TOL) {
  return typeof a === "number" && Math.abs(a - b) <= tol;
}
function assert(label, cond, detail) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failed = true;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ===== 1) フィクスチャ再現テスト =====
console.log("[1] fixture 2004-04-26 02:00 JST 北九州");
{
  const chart = computeNatalChart({
    dateIso: "2004-04-26T02:00:00+09:00",
    latitude: 33.8833,
    longitude: 130.8758,
  });
  const p = chart.planets ?? {};
  assert("source is real ephemeris", chart.source === "circular-natal-horoscope-js", chart.source);
  assert("houses_available", chart.houses_available === true);
  assert("太陽 = 牡牛座 ~5.8°", p.sun?.sign === "Taurus" && approxEqual(p.sun?.degree, 5.8), JSON.stringify(p.sun));
  assert("月 = 蟹座 ~13.4°", p.moon?.sign === "Cancer" && approxEqual(p.moon?.degree, 13.4), JSON.stringify(p.moon));
  assert("ASC = 水瓶座 ~16.4°", chart.asc?.sign === "Aquarius" && approxEqual(chart.asc?.degree, 16.4), JSON.stringify(chart.asc));
  assert("MC = 射手座 ~2.0°", chart.mc?.sign === "Sagittarius" && approxEqual(chart.mc?.degree, 2.0), JSON.stringify(chart.mc));
}

// ===== 2) 別日付の妥当性テスト =====
// 2000-01-01 12:00 JST 東京。天文暦上、太陽は山羊座 ~10° 付近(元日は山羊座9〜11°)。
console.log("[2] 2000-01-01 12:00 JST 東京");
{
  const chart = computeNatalChart({
    dateIso: "2000-01-01T12:00:00+09:00",
    latitude: 35.6895,
    longitude: 139.6917,
  });
  const p = chart.planets ?? {};
  const validSign = (s) =>
    [
      "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
      "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
    ].includes(s);
  const validDeg = (d) => typeof d === "number" && d >= 0 && d < 30;

  assert("source is real ephemeris", chart.source === "circular-natal-horoscope-js");
  assert("10天体すべて算出", Object.keys(p).length === 10, `count=${Object.keys(p).length}`);
  assert("全天体が有効な星座・度数", Object.values(p).every((x) => validSign(x.sign) && validDeg(x.degree)));
  assert("太陽 = 山羊座 ~10°(元日)", p.sun?.sign === "Capricorn" && approxEqual(p.sun?.degree, 10, 1.5), JSON.stringify(p.sun));
  assert("ASC/MC が有効", chart.asc && chart.mc && validSign(chart.asc.sign) && validSign(chart.mc.sign), JSON.stringify({ asc: chart.asc, mc: chart.mc }));
}

// ===== 3) 時刻不明時は ASC/MC を出さない =====
console.log("[3] time unknown → ASC/MC 非出力・houses_available=false");
{
  const chart = computeNatalChart({
    dateIso: "2000-01-01T12:00:00+09:00",
    latitude: 35.6895,
    longitude: 139.6917,
    timeUnknown: true,
  });
  assert("houses_available=false", chart.houses_available === false);
  assert("ASC 非出力", chart.asc === undefined);
  assert("MC 非出力", chart.mc === undefined);
  assert("天体は算出される", !!chart.planets?.sun);
}

if (failed) {
  console.error("\nephemeris test: FAIL");
  process.exit(2);
} else {
  console.log("\nephemeris test: PASS");
  process.exit(0);
}
