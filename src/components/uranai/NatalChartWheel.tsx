// 出生図(ホロスコープ)の可視化。運命の設計図 /unmei の hitokoto 直後・章1の前に置く。
//
// 配色 (紺・黄・白の3色) + 立体化 (光と影だけで奥行き。装飾は足さない):
//   - 背景 = 紺の放射グラデーション (中心が明るく外周が暗い = 見上げるドーム)。
//   - 円/分割線/星座名/天体名/度数一覧 = 白。天体の点 = 黄 (球体風: ハイライト+淡いグロー)。
//   - 外周リングは内側に影を落として浮かせる。円の外側の余白に極小の白い星を散らす。
//   - アスペクト線 = 白 (ASC/MC も対象に含める)。占星術記号は使わず日本語表記。
//   - 時刻不明の月は「点」ではなく「弧」で描き、位置を確定値として偽らない。
//
// アニメーション (CSSのみ・外部ライブラリなし):
//   - 外周リング (星座帯の円と分割線) だけを 90 秒/周でゆっくり回転。
//   - 天体の点/ラベル/アスペクト線/背景の星/星座名は固定。
//   - 星座名は固定(=常に正立)。回すと下半分で逆さになるため、回転群には入れない。
//   - prefers-reduced-motion: reduce では回転を無効化。
//
// サーバーコンポーネント (chart→SVG の純描画・JS不要)。座標計算は chart-view.layoutWheel に集約。

import {
  buildChartView,
  layoutWheel,
  WHEEL,
  type Chart,
  type MoonArc,
} from "@/lib/unmei/chart-view";

const WHITE = "#FFFFFF"; // 線・文字 (天体の点=黄は defs の uw-dot グラデで描く)

type Props = {
  chart: Chart | null | undefined;
  timeUnknown: boolean;
  moonArc: MoonArc | null;
  essence?: string | null; // 中央に置く 32タイプ称号 (例: 寄添者)。無ければ非表示。
};

export default function NatalChartWheel({
  chart,
  timeUnknown,
  moonArc,
  essence = null,
}: Props) {
  const view = buildChartView(chart, { timeUnknown, moonArc });
  if (!view) return null;
  const L = layoutWheel(view);

  return (
    // 紺の色面 (このページで唯一の色面)。枠線・影・角丸は付けない。
    // ★背景グラデは section 側に敷き、SVG 背景は透明にする。こうすると SVG の矩形境界が
    //   消え、ドームがセクション全体で連続する (「明るい四角が浮く」= 2層の主因を解消)。
    <section
      aria-label="出生図"
      className="mt-8 py-12"
      style={{
        background:
          "radial-gradient(circle at 50% 26%, #50508C 0%, #2B2B54 42%, #17172E 74%)",
      }}
    >
      {/* スマホ幅いっぱいまで使う (px-4)。PC は一回り大きく上限 560px。 */}
      <div className="mx-auto max-w-[560px] px-4">
        <svg
          viewBox={`0 0 ${L.size} ${L.size}`}
          width="100%"
          role="img"
          aria-label={view.ariaLabel}
          className="mx-auto block h-auto w-full"
        >
          <defs>
            {/* 被写界深度: 背景の星をごくわずかにぼかす (ピントは手前の天体に) */}
            <filter id="uw-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.45" />
            </filter>
            {/* 天体のドロップシャドウ (点を背景から浮かせる) */}
            <filter id="uw-dot-shadow" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0.5" dy="1.1" stdDeviation="1" floodColor="#0A0A18" floodOpacity="0.6" />
            </filter>
            {/* 天体の球体シェーディング (左上が明るい) */}
            <radialGradient id="uw-dot" cx="35%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#FCEFB4" />
              <stop offset="55%" stopColor="#EDCF62" />
              <stop offset="100%" stopColor="#C7A63C" />
            </radialGradient>
            {/* 天体の淡いグロー (光の滲み) */}
            <radialGradient id="uw-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EDCF62" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#EDCF62" stopOpacity="0" />
            </radialGradient>
          </defs>
          <style>{`
            @keyframes uw-spin { to { transform: rotate(360deg); } }
            .uw-ring { transform-box: fill-box; transform-origin: center; animation: uw-spin 240s linear infinite; }
            @media (prefers-reduced-motion: reduce) { .uw-ring { animation: none; } }
          `}</style>

          {/* 背景は透明: section 側の放射グラデを見せる (SVG の矩形境界を出さない)。 */}

          {/* 背景の星 (最も奥=最も淡い層・固定・ごくわずかにぼかす=被写界深度) */}
          <g filter="url(#uw-blur)">
            {L.stars.map((s, i) => (
              <circle key={`st${i}`} cx={s.x} cy={s.y} r={s.r} fill={WHITE} fillOpacity={s.o} />
            ))}
          </g>

          {/* リング内側影は撤去 (背景の連続性を最優先)。
              明度切り替わり=2層の主因だったため、影ではなくドームの緩やかなグラデと
              リング線の明るさ(下記 0.45)だけで骨格・奥行きを出す。 */}

          {/* アスペクト線 (白・固定): 天体同士の主要角度を結ぶ弦。実データ。奥行き=中間の明るさ。 */}
          {L.aspectLines.map((a, i) => (
            <line
              key={`a${i}`}
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke={WHITE}
              strokeOpacity={0.4}
              strokeWidth={0.6}
            />
          ))}

          {/* 中央の称号 (A案・固定): 「自分だけの図」の主題を中心に据える。
              交差するアスペクト線の上に、小さく・低不透明度の白で。無ければ非表示。 */}
          {essence && (
            <text
              x={WHEEL.cx}
              y={WHEEL.cy}
              fill={WHITE}
              fillOpacity={0.62}
              fontSize={15}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ letterSpacing: "0.08em" }}
            >
              {essence}
            </text>
          )}

          {/* ===== 回転する外周リング (星座帯の円 + 分割線) のみ ===== 奥行き=やや暗い。 */}
          <g className="uw-ring">
            {L.circles.map((c, i) => (
              <circle
                key={`c${i}`}
                cx={WHEEL.cx}
                cy={WHEEL.cy}
                r={c.r}
                fill="none"
                stroke={WHITE}
                strokeOpacity={0.45}
                strokeWidth={1}
              />
            ))}
            {L.ticks.map((t, i) => (
              <line
                key={`t${i}`}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={WHITE}
                strokeOpacity={0.45}
                strokeWidth={1}
              />
            ))}
          </g>

          {/* 星座名 (固定=常に正立・小さく暗く: 奥行き=リングより奥・星より手前) */}
          {L.signLabels.map((s, i) => (
            <text
              key={`s${i}`}
              x={s.x}
              y={s.y}
              fill={WHITE}
              fillOpacity={0.22}
              fontSize={8}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {s.text}
            </text>
          ))}

          {/* 月の弧 (時刻不明時・固定): リング上の細線 + 両端キャップ (白) */}
          {L.moonPath && (
            <path
              d={L.moonPath}
              fill="none"
              stroke={WHITE}
              strokeOpacity={0.9}
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
              stroke={WHITE}
              strokeWidth={1.5}
            />
          ))}

          {/* 引き出し線 (点→ラベル・白・固定) */}
          {L.leaders.map((l, i) => (
            <line
              key={`l${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={WHITE}
              strokeOpacity={0.4}
              strokeWidth={0.75}
            />
          ))}

          {/* 天体の点 (固定・最前面・最も明るい): グロー → 本体(球シェーディング+ドロップシャドウ) → ハイライト */}
          {L.dots.map((d, i) => (
            <g key={`d${i}`}>
              <circle cx={d.x} cy={d.y} r={7} fill="url(#uw-glow)" />
              <circle cx={d.x} cy={d.y} r={3.2} fill="url(#uw-dot)" filter="url(#uw-dot-shadow)" />
              <circle cx={d.x - 1.1} cy={d.y - 1.1} r={1} fill={WHITE} fillOpacity={0.85} />
            </g>
          ))}

          {/* 天体名 (日本語・白・固定・重なり回避済み) */}
          {L.bodyLabels.map((b, i) => (
            <text
              key={`b${i}`}
              x={b.x}
              y={b.y}
              fill={WHITE}
              fontSize={10.5}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {b.text}
            </text>
          ))}
        </svg>

        {/* 図の下の一覧 (正確な度数・凡例・読み上げ補助を兼ねる・白文字) */}
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1.5">
          {view.listItems.map((it) => (
            <div key={it.key} className="flex items-baseline gap-2">
              <dt className="w-12 flex-shrink-0 text-[13px] font-bold text-white">
                {it.label}
              </dt>
              <dd className="text-[13px] text-white/80">{it.text}</dd>
            </div>
          ))}
        </dl>

        {/* 正確さの表明: 時刻不明で月が範囲になっていることの注記 (白) */}
        {view.timeUnknown && (
          <p className="mt-5 text-[12px] leading-relaxed text-white/70">
            出生時刻が分かると、月の位置が一点に定まります。
          </p>
        )}
      </div>
    </section>
  );
}
