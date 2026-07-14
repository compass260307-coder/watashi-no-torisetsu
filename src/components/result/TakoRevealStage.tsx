"use client";

// 三層ゲートの“器”。奥(結果ページの長いダミー)を敷き、手前カウンターカードを sticky で
// 画面中央に留める。スクロールすると奥だけが流れ、手前カード(CTA)は常に画面内に残る。
//
// レイアウト:
//   - root: 全幅(full-bleed)・relative。position:fixed は使わない。
//   - 奥: 通常フローで敷き、セクションの高さ(=結果ページ全長)を決める (z-0)。
//   - 手前: absolute inset-0 の overlay 内で position:sticky。100dvh の枠に中央寄せ。
//     → スクロール中カードは画面中央に留まり、CTA が常に見える。
//
// 操作:
//   - 縦スクロール = 奥(結果ページ)が流れる (主動線)。touch-action: pan-y で native スクロール。
//   - 横ドラッグ = 手前カードをフェード+わずかに縮小して退避 → 奥を“即覗く”(副次)。
//     縦優勢はスクロールに譲り、横優勢でだけ退避を発火。CTA(data-no-drag)上では発火しない。
//   - ★性能優先: sticky+backdrop-blur が重い場合、退避を最初に捨てる(scroll性能 > 退避)。
//   - prefers-reduced-motion: 退避無効(カード常時くっきり)。sticky はレイアウトなので維持。
//   - ?peek=1 (dev限定): 退避状態を静的描画するスクショ確認用。

import { useEffect, useRef, type ReactNode } from "react";
import { TakoRewardBackdrop } from "./TakoRewardBackdrop";

const PEEK_TRAVEL = 90; // このドラッグ距離(px)で退避が最大に
const PEEK_EASE = 0.18;
const PEEK_FADE = 0.97; // 退避時の最大フェード (opacity 1 → 0.03。ほぼ完全に消す)
const PEEK_SHRINK = 0.05; // 退避時の最大縮小 (scale 1 → 1-0.05)
const PEEK_BLUR_MAX = 24; // フロストの blur(px)。退避量に比例して 0 へ減衰し、奥を素で見せる。

interface TakoRevealStageProps {
  answered: number;
  threshold: number;
  /** 手前(主役)レイヤー = カウンターカード。 */
  children: ReactNode;
}

export function TakoRevealStage({
  answered,
  threshold,
  children,
}: TakoRevealStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);

  const state = useRef({
    curPeek: 0,
    dragMag: 0,
    pending: false,
    dragging: false,
    startPX: 0,
    startPY: 0,
    pointerId: -1,
  });

  useEffect(() => {
    const root = rootRef.current;
    const front = frontRef.current;
    if (!root || !front) return;

    const previewPeek =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("peek") === "1";

    const applyFront = (peek: number) => {
      front.style.opacity = (1 - peek * PEEK_FADE).toFixed(3);
      front.style.transform = `scale(${(1 - peek * PEEK_SHRINK).toFixed(4)})`;
      // ★退避に応じてフロストの blur も 0 へ減衰 (カード領域の奥を素でくっきり見せる)。
      //   カードは --peek-blur を参照して backdrop-filter を効かせる (TakoShareGate)。
      front.style.setProperty(
        "--peek-blur",
        `${(PEEK_BLUR_MAX * (1 - peek)).toFixed(1)}px`,
      );
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      applyFront(previewPeek ? 1 : 0);
      return;
    }

    if (previewPeek) state.current.curPeek = 1;

    let raf = 0;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-no-drag]")) return;
      const s = state.current;
      s.pending = true;
      s.dragging = false;
      s.dragMag = 0;
      s.pointerId = e.pointerId;
      s.startPX = e.clientX;
      s.startPY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      const s = state.current;
      if (e.pointerId !== s.pointerId) return;
      const dx = e.clientX - s.startPX;
      const dy = e.clientY - s.startPY;
      if (s.pending && !s.dragging) {
        // 縦優勢はスクロールへ譲る。横優勢が閾値超えで退避ドラッグ確定。
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
          s.pending = false;
          return;
        }
        if (Math.abs(dx) > 6) {
          s.dragging = true;
          try {
            root.setPointerCapture(e.pointerId);
          } catch {
            /* capture 不可環境は無視 */
          }
        } else {
          return;
        }
      }
      if (!s.dragging) return;
      s.dragMag = Math.hypot(dx, dy);
    };
    const onUp = (e: PointerEvent) => {
      const s = state.current;
      if (e.pointerId !== s.pointerId) return;
      s.pending = false;
      s.dragging = false;
      s.dragMag = 0;
      s.pointerId = -1;
    };

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);

    const tick = () => {
      const s = state.current;
      const target = previewPeek
        ? 1
        : s.dragging
          ? Math.min(1, s.dragMag / PEEK_TRAVEL)
          : 0;
      s.curPeek += (target - s.curPeek) * PEEK_EASE;
      applyFront(s.curPeek);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative isolate w-screen ml-[calc(50%-50vw)] touch-pan-y select-none"
      style={{ background: "#F6F7F9" }}
    >
      {/* ===== 奥(結果ページの長いダミー): 通常フローでセクション高さを決める ===== */}
      <div className="relative z-0">
        <TakoRewardBackdrop answered={answered} threshold={threshold} />
      </div>

      {/* ===== 手前(主役): sticky で画面中央に留まる。overlay は pointer-events-none にして
          奥への背景ドラッグも root が拾えるようにし、カードだけ pointer-events-auto。 ===== */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="sticky top-0 flex h-[100dvh] items-center justify-center px-4">
          <div
            ref={frontRef}
            className="pointer-events-auto w-full max-w-[400px] [will-change:transform,opacity]"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
