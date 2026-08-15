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
  polar,
  WHEEL,
  type Chart,
  type ChartView,
  type MoonArc,
  type WheelLayout,
} from "@/lib/unmei/chart-view";
import type { ResultLocale } from "@/i18n/result";
import { UNMEI_CHART_COPY } from "@/i18n/unmei";

const WHITE = "#FFFFFF"; // 線・文字 (天体の点=黄は defs の uw-dot グラデで描く)

type Props = {
  chart: Chart | null | undefined;
  timeUnknown: boolean;
  moonArc: MoonArc | null;
  essence?: string | null; // 中央に置く 32タイプ称号 (例: 寄添者)。無ければ非表示。
  locale?: ResultLocale;
};

export default function NatalChartWheel({
  chart,
  timeUnknown,
  moonArc,
  essence = null,
  locale = "ja",
}: Props) {
  const view = buildChartView(chart, { timeUnknown, moonArc, locale });
  if (!view) return null;
  const L = layoutWheel(view);

  return (
    // 紺の色面 (このページで唯一の色面)。枠線・影・角丸は付けない。
    // ★背景グラデは section 側に敷き、SVG 背景は透明にする。こうすると SVG の矩形境界が
    //   消え、ドームがセクション全体で連続する (「明るい四角が浮く」= 2層の主因を解消)。
    <section
      aria-label={UNMEI_CHART_COPY[locale].label}
      className="mt-8 py-12"
      style={{
        background:
          "radial-gradient(circle at 50% 26%, #50508C 0%, #2B2B54 42%, #17172E 74%)",
      }}
    >
      {/* スマホ幅いっぱいまで使う (px-4)。PC は一回り大きく上限 560px。 */}
      <div className="mx-auto max-w-[560px] px-4">
        <WheelSvg view={view} L={L} essence={essence} />
        <PlanetList view={view} />
      </div>
    </section>
  );
}

// SVG 本体。静的表示 (上の default) とスクロール演出ステージ (NatalChartStage) で共有する
// 純描画部品。ここには "use client" を付けない (サーバでもクライアントでも描ける)。
//
// layer: ステージ側で3D視差を出すためのレイヤー分割 (2026-08-05)。
//   - "all"   = 全部を1枚で描く (静的表示用。従来どおり)
//   - "back"  = 背景の星 + 回転リング + 星座名 (最奥)
//   - "mid"   = アスペクト線 + 中央の称号 + 月の弧 (中間)
//   - "front" = 引き出し線 + 天体の点 + 天体名 (最前面)
//   3枚を同じ位置に重ね translateZ をずらすと、傾けたとき層の間に本当の奥行きが出る。
//   defs の id は layer ごとに変える (同一ドキュメント内で id が衝突するため)。
export type WheelLayer = "all" | "back" | "mid" | "front";

export function WheelSvg({
  view,
  L,
  essence = null,
  layer = "all",
}: {
  view: ChartView;
  L: WheelLayout;
  essence?: string | null;
  layer?: WheelLayer;
}) {
  const show = (l: Exclude<WheelLayer, "all">) => layer === "all" || layer === l;
  const idp = `uw-${layer}`; // defs id の衝突回避 (レイヤー3枚が同居するため)
  const copy = UNMEI_CHART_COPY[view.locale];

  // 太陽・月だけのラベル位置 (軌道の少し外側・同じ角度)。時刻不明の月は弧の中央。
  const keyLabels: { key: string; label: string; x: number; y: number }[] =
    view.points
      .filter((pt) => pt.key === "sun" || pt.key === "moon")
      .map((pt) => {
        const [x, y] = polar(WHEEL.rDot + 17, pt.lon);
        return { key: pt.key, label: pt.label, x, y };
      });
  if (view.moonArc) {
    const delta =
      (((view.moonArc.endLon - view.moonArc.startLon) % 360) + 360) % 360;
    const [x, y] = polar(
      WHEEL.rDot + 17,
      (view.moonArc.startLon + delta / 2) % 360,
    );
    keyLabels.push({ key: "moon", label: copy.moon, x, y });
  }
  const a11y =
    layer === "all"
      ? ({ role: "img", "aria-label": view.ariaLabel } as const)
      : ({ "aria-hidden": true } as const);

  return (
    <svg
      viewBox={`0 0 ${L.size} ${L.size}`}
      width="100%"
      className="mx-auto block h-auto w-full"
      {...a11y}
    >
      <defs>
        {/* 被写界深度: 背景の星をごくわずかにぼかす (ピントは手前の天体に) */}
        <filter id={`${idp}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.45" />
        </filter>
        {/* 天体のドロップシャドウ (点を背景から浮かせる) */}
        <filter id={`${idp}-dot-shadow`} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0.5" dy="1.1" stdDeviation="1" floodColor="#0A0A18" floodOpacity="0.6" />
        </filter>
        {/* 天体の球体シェーディング (左上が明るい) */}
        <radialGradient id={`${idp}-dot`} cx="35%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#FCEFB4" />
          <stop offset="55%" stopColor="#EDCF62" />
          <stop offset="100%" stopColor="#C7A63C" />
        </radialGradient>
        {/* 天体の淡いグロー (光の滲み) */}
        <radialGradient id={`${idp}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EDCF62" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#EDCF62" stopOpacity="0" />
        </radialGradient>
        {/* 月の銀シェーディング + 白系グロー (太陽=金 / 月=銀 の描き分け) */}
        <radialGradient id={`${idp}-moon`} cx="35%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#DDE2F0" />
          <stop offset="100%" stopColor="#A7B0CC" />
        </radialGradient>
        <radialGradient id={`${idp}-glow-cool`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#DDE2F0" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#DDE2F0" stopOpacity="0" />
        </radialGradient>
        {/* 中央称号の金 (上が明るい箔押し風。ベタ塗りの金は安く見えるため) */}
        <linearGradient id={`${idp}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F9EBB0" />
          <stop offset="55%" stopColor="#EDD174" />
          <stop offset="100%" stopColor="#C9A63E" />
        </linearGradient>
      </defs>
      {show("back") && (
        <style>{`
          @keyframes uw-spin { to { transform: rotate(360deg); } }
          .uw-ring { transform-box: fill-box; transform-origin: center; animation: uw-spin 240s linear infinite; }
          @media (prefers-reduced-motion: reduce) { .uw-ring { animation: none; } }
        `}</style>
      )}

      {/* 背景は透明: 外側の夜空を見せる (SVG の矩形境界を出さない)。 */}

      {/* ===== back: 背景の星 + 外周リング + 点線の軌道 =====
          2026-08-05 簡素化: 星座帯 (2重円・12分割線・星座名) とアスペクト線を撤去し、
          「細い外周リング + 文字盤風の短いティック + 天体が乗る点線の軌道」だけにする。
          情報としての正確さは下の度数一覧が担保する (見た目はシンプル、意味は失わない)。 */}
      {show("back") && (
        <>
          {/* 背景の星 (最も奥=最も淡い層・固定・ごくわずかにぼかす=被写界深度) */}
          <g filter={`url(#${idp}-blur)`}>
            {L.stars.map((s, i) => (
              <circle key={`st${i}`} cx={s.x} cy={s.y} r={s.r} fill={WHITE} fillOpacity={s.o} />
            ))}
          </g>

          {/* 回転する外周リング: 細い円 + 時計の文字盤風の短いティック12本 */}
          <g className="uw-ring">
            <circle
              cx={WHEEL.cx}
              cy={WHEEL.cy}
              r={WHEEL.rOuter}
              fill="none"
              stroke={WHITE}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
            {Array.from({ length: 12 }, (_, i) => {
              const [x1, y1] = polar(WHEEL.rOuter - 7, i * 30);
              const [x2, y2] = polar(WHEEL.rOuter, i * 30);
              return (
                <line
                  key={`t${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={WHITE}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
              );
            })}
          </g>

          {/* 天体が乗る軌道 (点線・固定)。「点がこの軌道上の位置にある」と一目で伝える */}
          <circle
            cx={WHEEL.cx}
            cy={WHEEL.cy}
            r={WHEEL.rDot}
            fill="none"
            stroke={WHITE}
            strokeOpacity={0.25}
            strokeWidth={1}
            strokeLinecap="round"
            strokeDasharray="0.5 6"
          />
        </>
      )}

      {/* ===== mid: アスペクト線 + 中央の称号 + 月の弧 ===== */}
      {show("mid") && (
        <>
          {/* アスペクト線は撤去 (2026-08-05 簡素化: 線の網が「複雑な図」に見える主因だった) */}

          {/* 中央の称号: 図の主題。明朝体 + 箔押し風の金グラデで上質に立てる
              (太ゴシック+ベタ塗り金+✦は「ださい」ため廃止 / 2026-08-05 指示)。
              上の小さなラベルは「この言葉が何なのか」の説明も兼ねる。無ければ非表示。 */}
          {essence && (
            <>
              <text
                x={WHEEL.cx}
                y={WHEEL.cy - 22}
                fill={WHITE}
                fillOpacity={0.48}
                fontSize={7.5}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ letterSpacing: "0.34em" }}
              >
                {copy.titleLabel}
              </text>
              <text
                x={WHEEL.cx}
                y={WHEEL.cy + 5}
                fill={`url(#${idp}-gold)`}
                fontSize={23}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ letterSpacing: "0.22em" }}
              >
                {essence}
              </text>
            </>
          )}

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
        </>
      )}

      {/* ===== front: 天体の点 + 太陽/月だけのラベル =====
          2026-08-05 簡素化: 引き出し線と9天体全部のラベルをやめ、誰でも分かる
          「太陽」「月」だけ金文字で添える (全天体の詳細は下の度数一覧で読める)。 */}
      {show("front") && (
        <>
          {/* 天体の点 (最前面・最も明るい)。2026-08-05: 種類で描き分けて一目で区別できるように。
              太陽=最大+十字の光条 / 月=銀の球 / 上昇宮・天頂=金の環 (天体ではなく方角のため) /
              他の惑星=金の球。L.dots[i] は view.points[i] と同順 (layoutWheel の構築順)。 */}
          {L.dots.map((d, i) => {
            const key = view.points[i]?.key ?? "";
            const isSun = key === "sun";
            const isMoon = key === "moon";
            const isAngle = key === "asc" || key === "mc";
            const r = isSun ? 6.2 : isMoon ? 5.4 : isAngle ? 3.4 : 4.8;
            const glowR = isSun ? 14 : isMoon ? 11 : isAngle ? 7 : 9.5;
            return (
              <g key={`d${i}`}>
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={glowR}
                  fill={`url(#${idp}-${isMoon ? "glow-cool" : "glow"})`}
                />
                {isSun && (
                  <g
                    stroke="#F5D66B"
                    strokeOpacity={0.55}
                    strokeWidth={0.8}
                    strokeLinecap="round"
                  >
                    <line x1={d.x - 10.5} y1={d.y} x2={d.x + 10.5} y2={d.y} />
                    <line x1={d.x} y1={d.y - 10.5} x2={d.x} y2={d.y + 10.5} />
                  </g>
                )}
                {isAngle ? (
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={r}
                    fill="none"
                    stroke="#F5D66B"
                    strokeOpacity={0.9}
                    strokeWidth={1.4}
                    filter={`url(#${idp}-dot-shadow)`}
                  />
                ) : (
                  <>
                    <circle
                      cx={d.x}
                      cy={d.y}
                      r={r}
                      fill={`url(#${idp}-${isMoon ? "moon" : "dot"})`}
                      filter={`url(#${idp}-dot-shadow)`}
                    />
                    <circle
                      cx={d.x - r * 0.32}
                      cy={d.y - r * 0.32}
                      r={r * 0.3}
                      fill={WHITE}
                      fillOpacity={0.85}
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* 太陽・月のラベル (金・軌道の少し外側)。時刻不明の月は弧の中央に添える */}
          {keyLabels.map((k) => (
            <text
              key={k.key}
              x={k.x}
              y={k.y}
              fill="#F5D66B"
              fillOpacity={0.95}
              fontSize={11}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ letterSpacing: "0.1em" }}
            >
              {k.label}
            </text>
          ))}
        </>
      )}
    </svg>
  );
}

// 図の下の一覧 (正確な度数・凡例・読み上げ補助を兼ねる・白文字)。WheelSvg と同じく共有部品。
// 一覧行の頭に置くミニアイコン。盤面の描き分け (太陽=金+光条 / 月=銀 / 上昇宮・天頂=金の環 /
// 惑星=金の球) と同じ意匠にして、一覧が凡例を兼ねるようにする (2026-08-05 デザイン統一)。
function BodyMark({ bodyKey }: { bodyKey: string }) {
  const isSun = bodyKey === "sun";
  const isMoon = bodyKey === "moon";
  const isAngle = bodyKey === "asc" || bodyKey === "mc";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="flex-shrink-0">
      {isSun && (
        <g stroke="#F5D66B" strokeOpacity={0.7} strokeWidth={0.8} strokeLinecap="round">
          <line x1="0.8" y1="6" x2="11.2" y2="6" />
          <line x1="6" y1="0.8" x2="6" y2="11.2" />
        </g>
      )}
      {isAngle ? (
        <circle cx="6" cy="6" r="3.4" fill="none" stroke="#F5D66B" strokeWidth="1.3" />
      ) : (
        <>
          <circle cx="6" cy="6" r={isSun ? 3.4 : 3} fill={isMoon ? "#DDE2F0" : "#EDCF62"} />
          <circle cx="4.9" cy="4.9" r="1" fill="#FFFFFF" fillOpacity="0.85" />
        </>
      )}
    </svg>
  );
}

// onSelect を渡すと各行がボタンになり、盤面のタップと同じ選択操作ができる
// (静的表示では渡さない = ただの一覧)。selectedKey の行は金でハイライト。
export function PlanetList({
  view,
  onSelect,
  selectedKey = null,
}: {
  view: ChartView;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
}) {
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-0.5">
        {view.listItems.map((it) => {
          const selected = selectedKey === it.key;
          const row = (
            <>
              <BodyMark bodyKey={it.key} />
              <span
                className={`text-[12.5px] font-bold tracking-[0.04em] ${
                  selected ? "text-[#F5D66B]" : "text-white"
                }`}
              >
                {it.label}
              </span>
              {/* 点線リーダー (名前と値を目次風に結ぶ) */}
              <span
                aria-hidden="true"
                className="mx-0.5 flex-1 translate-y-[3px] border-b border-dotted border-white/25"
              />
              <span className="text-right text-[12.5px] font-bold text-white/70">
                {it.text}
              </span>
            </>
          );
          const rowCls = `flex w-full items-center gap-2 rounded-lg px-2 py-[7px] text-left ${
            selected ? "bg-white/[0.08]" : ""
          }`;
          return onSelect ? (
            <button
              key={it.key}
              type="button"
              onClick={() => onSelect(it.key)}
              className={rowCls}
            >
              {row}
            </button>
          ) : (
            <div key={it.key} className={rowCls}>
              {row}
            </div>
          );
        })}
      </div>

      {/* 正確さの表明: 時刻不明で月が範囲になっていることの注記 (白) */}
      {view.timeUnknown && (
        <p className="mt-5 text-[12px] leading-relaxed text-white/70">
          {UNMEI_CHART_COPY[view.locale].timeUnknownNote}
        </p>
      )}
    </>
  );
}
