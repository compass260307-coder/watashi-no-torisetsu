// 出生図「詳細データ一覧」(分かる人向けの本格データ)。
// 鑑定文の下に、native <details> で折りたたみ (デフォルト閉じ)。JS 不要。
// 紺+金+白の夜空トーン (出生図ホイールと同系)。描画時再計算なので DB 変更不要。
// 3ブロック: ①天体表(記号・星座・度数・R・所属ハウス) ②エレメント集計 ③ハウスカスプ表。
// 時刻不明ユーザーはハウス系が null → 所属ハウス列は「—」、カスプ表は注記に差し替え。

import { computeChartDetails } from "@/lib/unmei/chart-details.mjs";
import type { Chart } from "@/lib/unmei/chart-view";
import type { ResultLocale } from "@/i18n/result";

const GOLD = "#EDCF62";

type Row = {
  key: string; symbol: string; name: string; sign: string; signSymbol: string;
  degree: number; element: string | null; retro: boolean | null; house: number | null;
};
type Cusp = { house: number; sign: string; signSymbol: string; degree: number };
type Details = {
  timeUnknown: boolean; planets: Row[]; extras: Row[];
  elements: { fire: number; earth: number; air: number; water: number };
  dominant: string | null; maxCount: number; houseCusps: Cusp[] | null;
};

const ELEMENT_LABELS: Record<ResultLocale, Record<string, string>> = {
  ja: { fire: "火", earth: "地", air: "風", water: "水" },
  ko: { fire: "불", earth: "흙", air: "바람", water: "물" },
};
const ELEMENT_ORDER = ["fire", "earth", "air", "water"] as const;

const KO_PLANET_NAMES: Record<string, string> = {
  太陽: "태양",
  月: "달",
  水星: "수성",
  金星: "금성",
  火星: "화성",
  木星: "목성",
  土星: "토성",
  天王星: "천왕성",
  海王星: "해왕성",
  冥王星: "명왕성",
  上昇宮: "상승궁",
  天頂: "중천",
};

const KO_SIGN_NAMES: Record<string, string> = {
  牡羊座: "양자리",
  牡牛座: "황소자리",
  双子座: "쌍둥이자리",
  蟹座: "게자리",
  獅子座: "사자자리",
  乙女座: "처녀자리",
  天秤座: "천칭자리",
  蠍座: "전갈자리",
  射手座: "사수자리",
  山羊座: "염소자리",
  水瓶座: "물병자리",
  魚座: "물고기자리",
};

const COPY = {
  ja: {
    aria: "あなたの出生図データ",
    title: "あなたの出生図データ",
    planets: "天体",
    planet: "天体",
    sign: "星座",
    degree: "度数",
    house: "室",
    legend: (timeUnknown: boolean) =>
      `R = 逆行 / 室 = 天体のあるハウス${timeUnknown ? "（出生時刻不明のため非表示）" : ""}`,
    elements: "エレメント（火地風水）",
    cusps: "ハウスカスプ",
    houseNumber: (house: number) => `第${house}室`,
    noHouses: "出生時刻を入れると表示されます。",
  },
  ko: {
    aria: "나의 출생 차트 데이터",
    title: "나의 출생 차트 데이터",
    planets: "천체",
    planet: "천체",
    sign: "별자리",
    degree: "각도",
    house: "하우스",
    legend: (timeUnknown: boolean) =>
      `R = 역행 / 하우스 = 천체가 있는 하우스${timeUnknown ? " (출생 시간을 몰라 표시하지 않음)" : ""}`,
    elements: "원소 (불·흙·바람·물)",
    cusps: "하우스 커스프",
    houseNumber: (house: number) => `${house}하우스`,
    noHouses: "출생 시간을 입력하면 확인할 수 있어요.",
  },
} as const;

function localizedName(value: string, locale: ResultLocale) {
  return locale === "ko" ? (KO_PLANET_NAMES[value] ?? value) : value;
}

function localizedSign(value: string, locale: ResultLocale) {
  return locale === "ko" ? (KO_SIGN_NAMES[value] ?? value) : value;
}

function PlanetRow({ r, locale }: { r: Row; locale: ResultLocale }) {
  return (
    <tr className="border-t border-white/10">
      <td className="whitespace-nowrap py-1.5 pr-2">
        <span className="mr-1 text-[15px]" style={{ color: GOLD }}>{r.symbol}</span>
        <span className="text-white">{localizedName(r.name, locale)}</span>
      </td>
      <td className="whitespace-nowrap py-1.5 pr-2 text-white/85">
        <span className="mr-0.5" style={{ color: GOLD }}>{r.signSymbol}</span>
        {localizedSign(r.sign, locale)}
      </td>
      <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums text-white/85">
        {r.degree.toFixed(1)}°
      </td>
      <td className="w-7 py-1.5 text-center">
        {r.retro === true ? (
          <span className="font-bold" style={{ color: "#FF9E9E" }}>R</span>
        ) : (
          <span className="text-white/25">·</span>
        )}
      </td>
      <td className="w-9 py-1.5 text-center tabular-nums text-white/85">
        {r.house != null ? r.house : "—"}
      </td>
    </tr>
  );
}

export default function UnmeiChartDetails({
  chart,
  locale = "ja",
}: {
  chart?: Chart | null;
  locale?: ResultLocale;
}) {
  if (!chart) return null;
  const details = computeChartDetails(chart) as Details | null;
  if (!details || details.planets.length === 0) return null;

  const { planets, extras, elements, maxCount, houseCusps, timeUnknown } = details;
  const copy = COPY[locale];
  const elementLabels = ELEMENT_LABELS[locale];
  // 最多エレメント (同数タイは複数)。強調・注記の両方に使う。
  const tops = maxCount > 0 ? ELEMENT_ORDER.filter((e) => elements[e] === maxCount) : [];

  return (
    <section aria-label={copy.aria} className="mx-auto mt-8 max-w-[640px] px-6">
      <div
        className="overflow-hidden rounded-2xl px-5 pb-6 pt-5 text-[13px]"
        style={{ background: "radial-gradient(circle at 50% -10%,#26264c,#16162e)" }}
      >
        {/* セクション見出し (常時展開・折りたたみは廃止)。円で全体像→表で詳細の流れ。 */}
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-white">
          <span style={{ color: GOLD }}>✦</span>
          {copy.title}
        </h2>

        <div className="text-[13px]">
          {/* ① 天体表 */}
          <h3 className="mb-1 mt-5 text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
            {copy.planets}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-white/45">
                  <th className="py-1 pr-2 font-normal">{copy.planet}</th>
                  <th className="py-1 pr-2 font-normal">{copy.sign}</th>
                  <th className="py-1 pr-2 text-right font-normal">{copy.degree}</th>
                  <th className="py-1 text-center font-normal">R</th>
                  <th className="py-1 text-center font-normal">{copy.house}</th>
                </tr>
              </thead>
              <tbody>
                {planets.map((r) => <PlanetRow key={r.key} r={r} locale={locale} />)}
                {extras.map((r) => <PlanetRow key={r.key} r={r} locale={locale} />)}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            {copy.legend(timeUnknown)}
          </p>

          {/* ② エレメント集計 */}
          <h3 className="mb-2 mt-6 text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
            {copy.elements}
          </h3>
          <div className="space-y-1.5">
            {ELEMENT_ORDER.map((e) => {
              const count = elements[e];
              const isDom = tops.includes(e);
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={e} className="flex items-center gap-2">
                  <span className="w-8 text-center text-white/80">{elementLabels[e]}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: GOLD,
                        opacity: isDom ? 1 : 0.4,
                      }}
                    />
                  </div>
                  <span className="w-4 text-right tabular-nums text-white/80">{count}</span>
                </div>
              );
            })}
          </div>
          {tops.length > 0 && (
            <p className="mt-2 text-[12px] text-white/70">
              {locale === "ko"
                ? "가장 강한 원소는 "
                : tops.length === 1
                  ? "いちばん強いのは"
                  : "強いのは"}
              <span className="mx-0.5 font-bold" style={{ color: GOLD }}>
                {tops
                  .map((e) => elementLabels[e])
                  .join(locale === "ko" ? "·" : "・")}
              </span>
              {locale === "ko" ? "의 성질이에요." : "の性質です。"}
            </p>
          )}

          {/* ③ ハウスカスプ表 */}
          <h3 className="mb-2 mt-6 text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
            {copy.cusps}
          </h3>
          {houseCusps ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  {houseCusps.map((c) => (
                    <tr key={c.house} className="border-t border-white/10">
                      <td className="w-16 whitespace-nowrap py-1.5 pr-2 text-white/60">{copy.houseNumber(c.house)}</td>
                      <td className="whitespace-nowrap py-1.5 pr-2 text-white/85">
                        <span className="mr-0.5" style={{ color: GOLD }}>{c.signSymbol}</span>
                        {localizedSign(c.sign, locale)}
                      </td>
                      <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-white/85">
                        {c.degree.toFixed(1)}°
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg bg-white/5 px-3 py-3 text-[12px] leading-relaxed text-white/55">
              {copy.noHouses}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
