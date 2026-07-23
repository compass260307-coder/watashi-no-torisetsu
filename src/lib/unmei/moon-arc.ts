// 時刻不明ユーザーの月の日周移動範囲を算出する (エフェメリスに依存する薄い層)。
// 月は約13°/日で動くため出生時刻が不明だと位置が一点に定まらない。当日 00:00 と 23:59 の
// 月黄経を再計算し、その範囲(弧)を返す。位置を「点」で確定させず「範囲」として示すための入力。

import { computeNatalChart } from "@/lib/ephemeris.mjs";
import { absLon, type Chart, type MoonArc, type Pos } from "./chart-view";

export function computeMoonDailyArc(
  chart: Chart,
  birthDate: string | null | undefined,
): MoonArc | null {
  if (!birthDate) return null;
  const lat = chart?.location?.latitude ?? 35.6895;
  const lng = chart?.location?.longitude ?? 139.6917;
  try {
    const c0 = computeNatalChart({
      dateIso: `${birthDate}T00:00:00+09:00`,
      latitude: lat,
      longitude: lng,
      timeUnknown: true,
    });
    const c1 = computeNatalChart({
      dateIso: `${birthDate}T23:59:00+09:00`,
      latitude: lat,
      longitude: lng,
      timeUnknown: true,
    });
    const s = (c0?.planets as Record<string, Pos> | undefined)?.moon;
    const e = (c1?.planets as Record<string, Pos> | undefined)?.moon;
    if (!s || !e || !s.sign || !e.sign) return null;
    return { startLon: absLon(s), endLon: absLon(e), start: s, end: e };
  } catch {
    return null;
  }
}
