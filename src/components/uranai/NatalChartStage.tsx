"use client";

// 出生図ホイールのスクロール演出ステージ (2026-08-05 指示)。
// 「スクロールすると3Dの星が動き、背中を押す言葉が現れる」を、3Dライブラリなしで
// CSS perspective + rAF だけで実装する (サイトの軽量化方針のため Three.js 等は入れない)。
//
// 仕組み:
//   - セクション全体を 260vh にし、中身 (100svh) を sticky で画面に固定。
//     スクロール進行度 p (0→1) を rAF で計算し、各層の style を直接更新する
//     (React の再レンダーは発生させない)。
//   - p に応じて: 寝ていたホイール (rotateX 58°) が起き上がって正面を向く /
//     背景の星2層が異なる速度で流れる (パララックス) / 3つの言葉が順に浮かんで消える /
//     最後に度数一覧がフェードイン。
//   - 起き上がった後 (p>0.62) は、ホバー環境ならポインタ位置でホイールがわずかに傾く。
//   - prefers-reduced-motion: reduce では従来の静的表示 (NatalChartWheel) に
//     CSSだけで切り替える (motion-reduce クラス。JS分岐なし = hydration差分なし)。
//
// SVG 描画は NatalChartWheel の WheelSvg / PlanetList を共有 (見た目の正は一本化)。

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import NatalChartWheel, {
  WheelSvg,
  PlanetList,
} from "@/components/uranai/NatalChartWheel";
import {
  buildChartView,
  layoutWheel,
  makeStarField,
  polar,
  WHEEL,
  type Chart,
  type MoonArc,
} from "@/lib/unmei/chart-view";
import type { ResultLocale } from "@/i18n/result";
import { UNMEI_CHART_COPY } from "@/i18n/unmei";

// 進行度に合わせて順に出す言葉 (中心 p と本文)。装飾ナレーションなので aria-hidden。
const PHRASE_CENTERS = [0.16, 0.4, 0.64] as const;
const PHRASE_HALF_WIDTH = 0.11; // 各言葉が見えている progress 幅 (中心±この値)

// 背景のパララックス星層 (makeStarField = 整数演算PRNGで SSR/CSR ビット一致)
const FAR_STARS = makeStarField(7, 90, 0.22, 0.22); // 奥: 多く・小さく・淡く・遅い
const NEAR_STARS = makeStarField(31, 42, 0.34, 0.4); // 手前: 少なく・大きめ・明るく・速い

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Props = {
  chart: Chart | null | undefined;
  timeUnknown: boolean;
  moonArc: MoonArc | null;
  essence?: string | null;
  locale?: ResultLocale;
};

export default function NatalChartStage({
  chart,
  timeUnknown,
  moonArc,
  essence = null,
  locale = "ja",
}: Props) {
  const copy = UNMEI_CHART_COPY[locale];
  const view = buildChartView(chart, { timeUnknown, moonArc, locale });

  const rootRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const farRef = useRef<SVGSVGElement>(null);
  const nearRef = useRef<SVGSVGElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const phraseRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const pRef = useRef(0); // スクロール進行度 0→1
  // タップで選択中の天体 (詳細カードと強調リングに使う)
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const tiltRef = useRef({ x: 0, y: 0 }); // ポインタ由来の傾き (deg)
  const rafRef = useRef(0);

  // 現在の pRef / tiltRef を DOM に反映 (transform/opacity のみ = 合成レイヤで完結)
  const apply = useCallback(() => {
    rafRef.current = 0;
    const p = pRef.current;

    const wheel = wheelRef.current;
    if (wheel) {
      // 起き上がり: easeOutCubic。p=0 で寝た円盤 (rotateX58°)、p=0.72 で正面。
      const t = clamp(p / 0.72, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      // ポインタの傾きは起き上がりが済んでから効かせる
      const settle = clamp((p - 0.62) / 0.3, 0, 1);
      const rotX = 58 * (1 - e) + tiltRef.current.x * settle;
      const rotY = tiltRef.current.y * settle;
      const rotZ = -12 * (1 - e);
      const scale = 0.86 + 0.14 * e;
      wheel.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`;
    }
    // 星層のパララックス (奥ほど遅い)
    if (farRef.current)
      farRef.current.style.transform = `translateY(${p * -36}px)`;
    if (nearRef.current)
      nearRef.current.style.transform = `translateY(${p * -92}px)`;
    // 言葉: 中心±幅の三角窓でフェード + わずかに上へ抜ける
    PHRASE_CENTERS.forEach((center, i) => {
      const el = phraseRefs.current[i];
      if (!el) return;
      const o = clamp(1 - Math.abs(p - center) / PHRASE_HALF_WIDTH, 0, 1);
      el.style.opacity = String(o);
      el.style.transform = `translateY(${(p - center) * -40}px)`;
    });
    if (listRef.current)
      listRef.current.style.opacity = String(clamp((p - 0.78) / 0.16, 0, 1));
    // スクロールの誘い (ページ先頭になったため復活。すぐ消える)
    if (hintRef.current)
      hintRef.current.style.opacity = String(clamp(1 - p / 0.1, 0, 1));
  }, []);

  const schedule = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(apply);
  }, [apply]);

  // 選択 state の再レンダーで JSX 初期値の transform/opacity に巻き戻るため、
  // 毎レンダー後に現在の進行度から各層のスタイルを同期的に再適用する。
  useLayoutEffect(() => {
    apply();
  });

  useEffect(() => {
    const root = rootRef.current;
    const sticky = stickyRef.current;
    if (!root || !sticky) return;

    const onScroll = () => {
      const rect = root.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      pRef.current = total > 0 ? clamp(-rect.top / total, 0, 1) : 1;
      schedule();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    // ポインタで傾ける (ホバー環境のみ。タッチのスクロールと干渉させない)
    const hoverable = window.matchMedia("(hover: hover)").matches;
    const onMove = (ev: PointerEvent) => {
      const r = sticky.getBoundingClientRect();
      const nx = (ev.clientX - r.left) / r.width - 0.5;
      const ny = (ev.clientY - r.top) / r.height - 0.5;
      tiltRef.current = { x: -ny * 9, y: nx * 12 };
      schedule();
    };
    const onLeave = () => {
      tiltRef.current = { x: 0, y: 0 };
      schedule();
    };
    if (hoverable) {
      sticky.addEventListener("pointermove", onMove);
      sticky.addEventListener("pointerleave", onLeave);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (hoverable) {
        sticky.removeEventListener("pointermove", onMove);
        sticky.removeEventListener("pointerleave", onLeave);
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [schedule]);

  if (!view) return null;
  const L = layoutWheel(view);

  // タップの当たり判定 (天体の位置。時刻不明の月は弧の中央)。座標系は WheelSvg と同じ。
  const hits: { key: string; label: string; x: number; y: number }[] =
    view.points.map((pt) => {
      const [x, y] = polar(WHEEL.rDot, pt.lon);
      return { key: pt.key, label: pt.label, x, y };
    });
  if (view.moonArc) {
    const delta =
      (((view.moonArc.endLon - view.moonArc.startLon) % 360) + 360) % 360;
    const [x, y] = polar(
      WHEEL.rDot,
      (view.moonArc.startLon + delta / 2) % 360,
    );
    hits.push({ key: "moon", label: copy.moon, x, y });
  }
  const selectedHit = hits.find((h) => h.key === selectedKey) ?? null;
  const selectedPos =
    view.listItems.find((it) => it.key === selectedKey)?.text ?? "";

  return (
    <>
      {/* reduced-motion: 演出なしの従来表示。CSSだけで切り替える (hydration差分なし) */}
      <div className="hidden motion-reduce:block">
        <NatalChartWheel
          chart={chart}
          timeUnknown={timeUnknown}
          moonArc={moonArc}
          essence={essence}
          locale={locale}
        />
      </div>

      <section
        ref={rootRef}
        aria-label={copy.label}
        className="relative mt-8 motion-reduce:hidden"
        style={{ height: "260vh" }}
      >
        <div
          ref={stickyRef}
          className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden pb-14"
          style={{
            // ページ全体が夜空になったため (StarBackdrop)、ここは不透明な塗りではなく
            // ホイールの後ろに淡い光だまりだけ足す (境目を作らない)
            background:
              "radial-gradient(circle at 50% 40%, rgba(110,110,190,0.30) 0%, rgba(60,60,120,0.12) 42%, rgba(23,23,46,0) 72%)",
            perspective: "900px",
          }}
        >
          {/* パララックス星層 (奥/手前)。上へ流れても下が切れないよう 115% の高さ */}
          {[
            { ref: farRef, stars: FAR_STARS },
            { ref: nearRef, stars: NEAR_STARS },
          ].map((layer, li) => (
            <svg
              key={li}
              ref={layer.ref}
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid slice"
              className="pointer-events-none absolute left-0 top-0 h-[115%] w-full will-change-transform"
            >
              {layer.stars.map((s, i) => (
                <circle
                  key={i}
                  cx={s.x}
                  cy={s.y}
                  r={s.r}
                  fill="#FFFFFF"
                  fillOpacity={s.o}
                />
              ))}
            </svg>
          ))}

          {/* 言葉 (装飾ナレーション): ホイールの上の固定枠に重ねて出す */}
          <div
            aria-hidden="true"
            className="relative mb-5 h-14 w-full max-w-[560px] px-8"
          >
            {copy.phrases.map((phrase, i) => (
              <p
                key={phrase}
                ref={(el) => {
                  phraseRefs.current[i] = el;
                }}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[17px] font-bold leading-relaxed text-white will-change-transform md:text-[20px]"
                style={{ opacity: 0 }}
              >
                {phrase}
              </p>
            ))}
          </div>

          {/* ホイール本体 (進行度で起き上がる)。中身は back/mid/front の3層を translateZ で
              浮かせて重ねる。傾き (スクロール起き上がり・ポインタ・常時ゆらぎ) のたびに
              層の間で視差が生まれ、1枚のSVGでは出ない本当の奥行きになる (2026-08-05)。
              静止後も .uw-sway がゆっくり揺れ続け、宇宙に浮かんでいる感を保つ。 */}
          <style>{`
            @keyframes uw-sway {
              0%, 100% { transform: rotateX(10deg) rotateY(-4deg); }
              50% { transform: rotateX(5deg) rotateY(4deg); }
            }
            .uw-sway { animation: uw-sway 14s ease-in-out infinite; }
            @keyframes uw-pulse { 0%, 100% { stroke-opacity: 0.9; } 50% { stroke-opacity: 0.3; } }
            .uw-pulse { animation: uw-pulse 1.6s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .uw-sway, .uw-pulse { animation: none; } }
          `}</style>
          <div
            ref={wheelRef}
            className="w-full max-w-[560px] px-4 will-change-transform"
            style={{
              transformStyle: "preserve-3d",
              transform: "rotateX(58deg) rotateZ(-12deg) scale(0.86)",
            }}
          >
            <span className="sr-only">{view.ariaLabel}</span>
            <div
              className="uw-sway relative"
              style={{ transformStyle: "preserve-3d" }}
            >
              <WheelSvg view={view} L={L} layer="back" />
              <div
                className="absolute inset-0"
                style={{ transform: "translateZ(26px)" }}
              >
                <WheelSvg view={view} L={L} essence={essence} layer="mid" />
              </div>
              <div
                className="absolute inset-0"
                style={{ transform: "translateZ(52px)" }}
              >
                <WheelSvg view={view} L={L} layer="front" />
              </div>
              {/* 操作レイヤー (最前面): 透明な当たり判定と選択リング。
                  タップ/クリックで詳細カードに意味と位置を出す (2026-08-05 指示)。 */}
              <div
                className="absolute inset-0"
                style={{ transform: "translateZ(53px)" }}
              >
                <svg
                  viewBox={`0 0 ${L.size} ${L.size}`}
                  width="100%"
                  className="mx-auto block h-auto w-full"
                >
                  {selectedHit && (
                    <circle
                      cx={selectedHit.x}
                      cy={selectedHit.y}
                      r={11.5}
                      fill="none"
                      stroke="#F5D66B"
                      strokeWidth={1.2}
                      className="uw-pulse"
                    />
                  )}
                  {hits.map((h) => (
                    <circle
                      key={h.key}
                      cx={h.x}
                      cy={h.y}
                      r={16}
                      fill="transparent"
                      role="button"
                      tabIndex={0}
                      aria-label={copy.details(h.label)}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setSelectedKey((s) => (s === h.key ? null : h.key))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedKey((s) => (s === h.key ? null : h.key));
                        }
                      }}
                    />
                  ))}
                </svg>
              </div>
            </div>
          </div>

          {/* 度数一覧 (最後にフェードイン。位置は最初から確保してガタつかせない) */}
          {/* スクロールの誘い (最初だけ表示。p が進むと消える) */}
          <div
            ref={hintRef}
            aria-hidden="true"
            className="absolute bottom-44 left-1/2 -translate-x-1/2 text-center text-[12px] font-bold text-white/60"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-1 animate-bounce"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            {copy.scroll}
          </div>

          <div
            ref={listRef}
            className="w-full max-w-[560px] px-4"
            style={{ opacity: 0 }}
          >
            {/* 詳細カード: 選択中の星の意味と位置。未選択時はタップの誘い。
                min-h 固定でタップのたびにレイアウトが跳ねないようにする。 */}
            <div className="mt-5 flex min-h-[76px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center">
              {selectedHit ? (
                <>
                  <p className="text-[14px] font-black tracking-[0.06em] text-[#F5D66B]">
                    {selectedHit.label}
                    {selectedPos && (
                      <span className="ml-2 text-[12.5px] font-bold tracking-normal text-white/75">
                        {selectedPos}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[12.5px] font-bold leading-relaxed text-white/80">
                    {copy.meanings[
                      selectedHit.key as keyof typeof copy.meanings
                    ] ?? ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[12px] font-bold text-white/60">
                    {copy.arrangement}
                  </p>
                  <p className="mt-1 text-[12px] font-bold text-white/45">
                    {copy.touchHint}
                  </p>
                </>
              )}
            </div>
            <PlanetList
              view={view}
              selectedKey={selectedKey}
              onSelect={(k) => setSelectedKey((s) => (s === k ? null : k))}
            />
          </div>
        </div>
      </section>
    </>
  );
}
