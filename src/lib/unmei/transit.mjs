// chosen「④時期」用のトランジット(現在の惑星運行)計算。
//
// 方針(設計書§4 + 追加指示):
//   - 遅い天体=木星(約1年/星座)・土星(約2.5年/星座)のみ使う。月/内惑星は速すぎて時期の目安に不適。
//   - 生成日(nowIso)の木星・土星の現在位置を計算し、本人の太陽/月に対して:
//       (1) 現在その星座を通過中か / (2) 今後入るか(星座イングレス) / (3) 主要アスペクト(0/60/90/120/180)を結ぶか
//     を今後30ヶ月ぶんスキャンして「近い転機」を拾う。
//   - 星座一致だけだと該当しない人が出るため、アスペクトも見る。それでも近接イベントが薄い場合は
//     「次の大きな波は約N年後、それまでは仕込みの時期」と前向きに枠づけ(「何もない」で終わらせない)。
//   - 時期は絶対表記(YYYY年+季節)。ピンポイントの日付は出さない(呼び出し側プロンプトで幅を持たせる)。
//
// トランジット位置は観測地に依存しないが、computeNatalChart が緯度経度を要求するため東京を渡し、
// timeUnknown:true で時刻依存を除外する(木星・土星は日内変化が無視できる)。

import { computeNatalChart } from "../ephemeris.mjs";

const SIGN_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
const SIGN_JA = {
  Aries: "牡羊座", Taurus: "牡牛座", Gemini: "双子座", Cancer: "蟹座",
  Leo: "獅子座", Virgo: "乙女座", Libra: "天秤座", Scorpio: "蠍座",
  Sagittarius: "射手座", Capricorn: "山羊座", Aquarius: "水瓶座", Pisces: "魚座",
};
const ASPECTS = [
  { n: "合", a: 0 },
  { n: "セクスタイル", a: 60 },
  { n: "スクエア", a: 90, hard: true },
  { n: "トライン", a: 120 },
  { n: "オポジション", a: 180, hard: true },
];
const HORIZON_MONTHS = 30;
const STEP_DAYS = 15;
const ASPECT_ORB = 3; // 度。季節ラベル用途なのでやや広め。

function absLon(p) {
  const i = SIGN_ORDER.indexOf(p.sign);
  return (i < 0 ? 0 : i * 30) + (typeof p.degree === "number" ? p.degree : 0);
}
function sep(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
function seasonLabel(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const s = m <= 2 ? "冬" : m <= 5 ? "春" : m <= 8 ? "夏" : m <= 11 ? "秋" : "冬";
  return `${y}年の${s}`;
}
function monthsBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.4));
}
// 木星=拡大/土星=定着。ハードアスペクトは「動機だが過剰注意」寄りに。
function natureOf(planetJa, hard) {
  if (planetJa === "木星") return hard ? "拡大(広げすぎ注意)" : "拡大・追い風";
  return hard ? "試練・定着" : "着実な構築";
}

// 本人の出生図(natalChart) と 生成日(nowIso) から時期のファクトを返す。
export function computeTransitTiming(natalChart, nowIso) {
  const sun = natalChart?.planets?.sun;
  const moon = natalChart?.planets?.moon;
  if (!sun?.sign || !moon?.sign) return null;
  const sunLon = absLon(sun);
  const moonLon = absLon(moon);
  const targets = [
    { ja: "太陽", sign: sun.sign, lon: sunLon },
    { ja: "月", sign: moon.sign, lon: moonLon },
  ];
  const lat = natalChart?.location?.latitude ?? 35.69;
  const lng = natalChart?.location?.longitude ?? 139.69;
  const start = new Date(nowIso);

  // 30ヶ月ぶん 15日ステップでサンプリング(木星・土星を同時取得)。
  const steps = Math.ceil((HORIZON_MONTHS * 30.4) / STEP_DAYS);
  const samples = [];
  for (let i = 0; i <= steps; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * STEP_DAYS);
    const c = computeNatalChart({ dateIso: d.toISOString(), latitude: lat, longitude: lng, timeUnknown: true });
    samples.push({ date: d, jup: c.planets.jupiter, sat: c.planets.saturn });
  }

  const events = [];
  for (const [key, pja] of [["jup", "木星"], ["sat", "土星"]]) {
    // (1) 現在その星座を通過中?
    const cur0 = samples[0][key];
    const hitTarget = targets.find((t) => t.sign === cur0.sign);
    if (hitTarget) {
      let exit = samples[samples.length - 1].date;
      for (let i = 1; i < samples.length; i++) {
        if (samples[i][key].sign !== cur0.sign) { exit = samples[i].date; break; }
      }
      events.push({
        planet: pja, nature: natureOf(pja, false), monthsAway: 0,
        desc: `${pja}があなたの${hitTarget.ja}星座(${SIGN_JA[cur0.sign]})を通過中`,
        whenLabel: `今〜${seasonLabel(exit)}`,
      });
    }
    // (2) イングレス / (3) アスペクト を前方スキャン (各 planet×target×種別で最初の1回)
    const seen = new Set();
    for (let i = 1; i < samples.length; i++) {
      const cur = samples[i][key];
      const prev = samples[i - 1][key];
      const curLon = absLon(cur);
      const prevLon = absLon(prev);
      for (const t of targets) {
        // (2) その星座に入る
        if (cur.sign !== prev.sign && cur.sign === t.sign) {
          const k = `${key}-${t.ja}-ingress`;
          if (!seen.has(k)) {
            seen.add(k);
            events.push({
              planet: pja, nature: natureOf(pja, false), monthsAway: monthsBetween(start, samples[i].date),
              desc: `${pja}があなたの${t.ja}星座(${SIGN_JA[t.sign]})に入る`,
              whenLabel: `${seasonLabel(samples[i].date)}ごろ`,
            });
          }
        }
        // (3) アスペクト(前サンプルとの間でオーブ内に入った最初の点)
        for (const asp of ASPECTS) {
          const k = `${key}-${t.ja}-${asp.a}`;
          if (seen.has(k)) continue;
          const orbNow = Math.abs(sep(curLon, t.lon) - asp.a);
          const orbPrev = Math.abs(sep(prevLon, t.lon) - asp.a);
          if (orbNow <= ASPECT_ORB && orbNow <= orbPrev) {
            seen.add(k);
            events.push({
              planet: pja, nature: natureOf(pja, asp.hard), monthsAway: monthsBetween(start, samples[i].date),
              desc: `${pja}があなたの${t.ja}に${asp.n}(${asp.a}°)を結ぶ`,
              whenLabel: `${seasonLabel(samples[i].date)}ごろ`,
            });
          }
        }
      }
    }
  }

  // 近い順にソートし、通過中を最優先。上位4件に絞る。
  events.sort((a, b) => a.monthsAway - b.monthsAway);
  const top = events.slice(0, 4);

  // 「何もない」で終わらせないための枠づけ。近接イベントが薄い/遠い場合の補助メッセージ。
  const nearest = top[0];
  const jupNow = samples[0].jup;
  const satNow = samples[0].sat;
  // 木星が本人の太陽星座まで何サイン先か(次の大きな拡大の波までの概算年数)。
  const jupToSun = ((SIGN_ORDER.indexOf(sun.sign) - SIGN_ORDER.indexOf(jupNow.sign)) % 12 + 12) % 12;
  let framing;
  if (!nearest) {
    framing = `今後30ヶ月に大きな転機は薄い。次に木星があなたの太陽星座に巡るのは約${jupToSun}年後。今は仕込み(基礎固め)の時期。`;
  } else if (nearest.monthsAway >= 18) {
    framing = `近い大きな波は${nearest.whenLabel}。それまでは仕込み(準備・基礎固め)の時期として使う。`;
  } else {
    framing = `直近の転機は${nearest.whenLabel}。`;
  }

  return {
    asOf: start.toISOString().slice(0, 10),
    transitJupSign: SIGN_JA[jupNow.sign],
    transitSatSign: SIGN_JA[satNow.sign],
    natalSunSign: SIGN_JA[sun.sign],
    natalMoonSign: SIGN_JA[moon.sign],
    events: top,
    framing,
  };
}

// プロンプトに差し込む日本語ブロックを組み立てる。
export function formatTransitBlock(t) {
  if (!t) return "(トランジット計算不可のため、幅を持たせた一般的な時期指示にとどめる)";
  const lines = [
    `生成日: ${t.asOf}`,
    `現在の運行: 木星=${t.transitJupSign} / 土星=${t.transitSatSign}`,
    `本人: 太陽=${t.natalSunSign} / 月=${t.natalMoonSign}`,
    "近い転機(近い順):",
    ...t.events.map((e) => `- 【${e.nature}】${e.desc}（${e.whenLabel}）`),
    `枠づけ: ${t.framing}`,
  ];
  return lines.join("\n");
}
