// 出生図「詳細データ一覧」(分かる人向けの本格データ)。
// 鑑定文の下に、native <details> で折りたたみ (デフォルト閉じ)。JS 不要。
// 紺+金+白の夜空トーン (出生図ホイールと同系)。描画時再計算なので DB 変更不要。
// 3ブロック: ①天体表(記号・星座・度数・R・所属ハウス) ②エレメント集計 ③ハウスカスプ表。
// 時刻不明ユーザーはハウス系が null → 所属ハウス列は「—」、カスプ表は注記に差し替え。

import { computeChartDetails } from "@/lib/unmei/chart-details.mjs";
import type { Chart } from "@/lib/unmei/chart-view";

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

const ELEMENT_JA: Record<string, string> = { fire: "火", earth: "地", air: "風", water: "水" };
const ELEMENT_ORDER = ["fire", "earth", "air", "water"] as const;

function PlanetRow({ r }: { r: Row }) {
  return (
    <tr className="border-t border-white/10">
      <td className="whitespace-nowrap py-1.5 pr-2">
        <span className="mr-1 text-[15px]" style={{ color: GOLD }}>{r.symbol}</span>
        <span className="text-white">{r.name}</span>
      </td>
      <td className="whitespace-nowrap py-1.5 pr-2 text-white/85">
        <span className="mr-0.5" style={{ color: GOLD }}>{r.signSymbol}</span>
        {r.sign}
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

export default function UnmeiChartDetails({ chart }: { chart?: Chart | null }) {
  if (!chart) return null;
  const details = computeChartDetails(chart) as Details | null;
  if (!details || details.planets.length === 0) return null;

  const { planets, extras, elements, maxCount, houseCusps, timeUnknown } = details;
  // 最多エレメント (同数タイは複数)。強調・注記の両方に使う。
  const tops = maxCount > 0 ? ELEMENT_ORDER.filter((e) => elements[e] === maxCount) : [];

  return (
    <section aria-label="あなたの出生図データ" className="mx-auto mt-8 max-w-[640px] px-6">
      <div
        className="overflow-hidden rounded-2xl px-5 pb-6 pt-5 text-[13px]"
        style={{ background: "radial-gradient(circle at 50% -10%,#26264c,#16162e)" }}
      >
        {/* セクション見出し (常時展開・折りたたみは廃止)。円で全体像→表で詳細の流れ。 */}
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-white">
          <span style={{ color: GOLD }}>✦</span>
          あなたの出生図データ
        </h2>

        <div className="text-[13px]">
          {/* ① 天体表 */}
          <h3 className="mb-1 mt-5 text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
            天体
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-white/45">
                  <th className="py-1 pr-2 font-normal">天体</th>
                  <th className="py-1 pr-2 font-normal">星座</th>
                  <th className="py-1 pr-2 text-right font-normal">度数</th>
                  <th className="py-1 text-center font-normal">R</th>
                  <th className="py-1 text-center font-normal">室</th>
                </tr>
              </thead>
              <tbody>
                {planets.map((r) => <PlanetRow key={r.key} r={r} />)}
                {extras.map((r) => <PlanetRow key={r.key} r={r} />)}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            R = 逆行 / 室 = 天体のあるハウス{timeUnknown ? "（出生時刻不明のため非表示）" : ""}
          </p>

          {/* ② エレメント集計 */}
          <h3 className="mb-2 mt-6 text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
            エレメント（火地風水）
          </h3>
          <div className="space-y-1.5">
            {ELEMENT_ORDER.map((e) => {
              const count = elements[e];
              const isDom = tops.includes(e);
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={e} className="flex items-center gap-2">
                  <span className="w-4 text-center text-white/80">{ELEMENT_JA[e]}</span>
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
              {tops.length === 1 ? "いちばん強いのは" : "強いのは"}
              <span className="mx-0.5 font-bold" style={{ color: GOLD }}>
                {tops.map((e) => ELEMENT_JA[e]).join("・")}
              </span>
              の性質です。
            </p>
          )}

          {/* ③ ハウスカスプ表 */}
          <h3 className="mb-2 mt-6 text-[12px] font-bold tracking-wide" style={{ color: GOLD }}>
            ハウスカスプ
          </h3>
          {houseCusps ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  {houseCusps.map((c) => (
                    <tr key={c.house} className="border-t border-white/10">
                      <td className="w-12 whitespace-nowrap py-1.5 pr-2 text-white/60">第{c.house}室</td>
                      <td className="whitespace-nowrap py-1.5 pr-2 text-white/85">
                        <span className="mr-0.5" style={{ color: GOLD }}>{c.signSymbol}</span>
                        {c.sign}
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
              出生時刻を入れると表示されます。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
