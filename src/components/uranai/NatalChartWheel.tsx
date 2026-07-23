// 出生図(ホロスコープ)の可視化。運命の設計図 /unmei の hitokoto 直後・章1の前に置く。
//
// 視覚言語 (厳守):
//   - 既存の淡い色面の上に、細い線・点・ラベルのみ。ネイビー単色。
//   - カード/枠線/影/グラデ/星屑/魔法陣などの装飾は一切なし (色面と本文だけの世界観)。
//   - 占星術記号は使わず日本語表記。星座名も日本語。配置と度数は chart のまま正確に。
//   - 時刻不明の月は「点」ではなく「弧」で描き、位置を確定値として偽らない。
//
// サーバーコンポーネント (chart→SVG の純描画・JS不要)。座標計算は chart-view.layoutWheel に集約。

import {
  buildChartView,
  layoutWheel,
  WHEEL,
  type Chart,
  type MoonArc,
} from "@/lib/unmei/chart-view";

const INK = "#2E2E5C"; // ブランドネイビー(全要素この単色で濃淡のみ)

type Props = {
  chart: Chart | null | undefined;
  timeUnknown: boolean;
  moonArc: MoonArc | null;
};

export default function NatalChartWheel({ chart, timeUnknown, moonArc }: Props) {
  const view = buildChartView(chart, { timeUnknown, moonArc });
  if (!view) return null;
  const L = layoutWheel(view);

  return (
    // 淡い色面の帯 (章バンドと同じトーン体系)。枠線・影・角丸は付けない。
    <section
      aria-label="出生図"
      className="mt-8 py-10"
      style={{ backgroundColor: "#F3EFFB" }}
    >
      <div className="mx-auto max-w-[420px] px-6">
        <svg
          viewBox={`0 0 ${L.size} ${L.size}`}
          width="100%"
          role="img"
          aria-label={view.ariaLabel}
          className="mx-auto block h-auto w-full"
        >
          {/* 外周円・星座帯の内側円 (細線) */}
          {L.circles.map((c, i) => (
            <circle
              key={`c${i}`}
              cx={WHEEL.cx}
              cy={WHEEL.cy}
              r={c.r}
              fill="none"
              stroke={INK}
              strokeOpacity={0.28}
              strokeWidth={1}
            />
          ))}
          {/* 12星座の分割線 */}
          {L.ticks.map((t, i) => (
            <line
              key={`t${i}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={INK}
              strokeOpacity={0.28}
              strokeWidth={1}
            />
          ))}
          {/* 星座名 (日本語・セクター中央) */}
          {L.signLabels.map((s, i) => (
            <text
              key={`s${i}`}
              x={s.x}
              y={s.y}
              fill={INK}
              fillOpacity={0.75}
              fontSize={9}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {s.text}
            </text>
          ))}
          {/* 月の弧 (時刻不明時): リング上の細線 + 両端キャップ */}
          {L.moonPath && (
            <path
              d={L.moonPath}
              fill="none"
              stroke={INK}
              strokeOpacity={0.85}
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}
          {L.moonCaps.map((c, i) => (
            <line
              key={`mc${i}`}
              x1={c.x1}
              y1={c.y1}
              x2={c.x2}
              y2={c.y2}
              stroke={INK}
              strokeWidth={1.5}
            />
          ))}
          {/* 引き出し線 (点→ラベル) */}
          {L.leaders.map((l, i) => (
            <line
              key={`l${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={INK}
              strokeOpacity={0.35}
              strokeWidth={0.75}
            />
          ))}
          {/* 天体の点 (正確な黄経位置) */}
          {L.dots.map((d, i) => (
            <circle key={`d${i}`} cx={d.x} cy={d.y} r={2.6} fill={INK} />
          ))}
          {/* 天体名 (日本語・重なり回避済み) */}
          {L.bodyLabels.map((b, i) => (
            <text
              key={`b${i}`}
              x={b.x}
              y={b.y}
              fill={INK}
              fontSize={10.5}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {b.text}
            </text>
          ))}
        </svg>

        {/* 図の下の一覧 (正確な度数・凡例・読み上げ補助を兼ねる) */}
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1.5">
          {view.listItems.map((it) => (
            <div key={it.key} className="flex items-baseline gap-2">
              <dt className="w-12 flex-shrink-0 text-[13px] font-bold text-[#2E2E5C]">
                {it.label}
              </dt>
              <dd className="text-[13px] text-[#2E2E5C]/80">{it.text}</dd>
            </div>
          ))}
        </dl>

        {/* 正確さの表明: 時刻不明で月が範囲になっていることの注記 */}
        {view.timeUnknown && (
          <p className="mt-5 text-[12px] leading-relaxed text-[#2E2E5C]/60">
            出生時刻が分かると、月の位置が一点に定まります。
          </p>
        )}
      </div>
    </section>
  );
}
