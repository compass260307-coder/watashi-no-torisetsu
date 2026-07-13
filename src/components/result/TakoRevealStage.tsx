"use client";

// 三層ゲートの“器” = 擬似ビューポート。奥(報酬)/スクリム/手前(カウンター)を内包する。
//
// レイアウト方針 (spec 準拠):
//   - position:fixed は使わない。root は position:relative + overflow:hidden。
//     奥/スクリム/手前は position:absolute or relative で内包する。
//   - 奥はスナップショット相当の軽量ダミーDOM(TakoRewardBackdrop)。動かすのは transform だけ
//     (重い再描画を避け、実機60fpsを狙う)。
//
// パララックス (“気配”程度。主導線はCTA):
//   - 背景ドラッグで奥だけが動く。手前カードはごく僅か追従 (奥:手前 = 1:0.2)。
//   - 可動域は小さくクランプ。離すと中央へ軽く戻る。無操作時にごく僅かな自動ドリフト。
//   - transform は rAF で ref に直接書き込む (Reactの再描画を挟まず滑らかに)。
//   - CTA など data-no-drag 要素の上ではドラッグを開始しない (タップ競合回避)。
//   - prefers-reduced-motion: 自動ドリフト停止 + パララックス無効 (完全静止)。
//
// 段階リビール: answered を奥(TakoRewardBackdrop)とスクリム濃度へ渡し、
//   カウントが増えるほど奥が晴れる。3人到達は親側の分岐で解放後ページに切り替わる。

import { useEffect, useRef, type ReactNode } from "react";
import { TakoRewardBackdrop } from "./TakoRewardBackdrop";

const MAX_X = 22; // 奥レイヤーの水平可動域(px)
const MAX_Y = 30; // 奥レイヤーの垂直可動域(px)
const DRAG_GAIN = 0.4; // 指移動→奥移動の減衰 (気配程度)
const FRONT_RATIO = 0.2; // 手前カードの追従比
const EASE = 0.12; // current→target の追従イージング
const DRIFT_X = 7; // 自動ドリフト振幅(px)
const DRIFT_Y = 5;

function clamp(v: number, max: number) {
  return Math.max(-max, Math.min(max, v));
}

// answered から手前カードの可読性を担保するスクリム濃度 (少人数ほど濃い)。
function scrimOpacity(answered: number, threshold: number): number {
  const t = threshold > 0 ? Math.min(1, Math.max(0, answered / threshold)) : 0;
  return Number((0.55 * (1 - t) + 0.1).toFixed(3));
}

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
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);

  // rAF で読み書きする可変状態 (再描画を挟まない)。
  const state = useRef({
    curX: 0,
    curY: 0,
    targetX: 0,
    targetY: 0,
    // pending: pointerdown 済みだが横ドラッグ確定前 / dragging: 横ドラッグ確定後。
    pending: false,
    dragging: false,
    startPX: 0,
    startPY: 0,
    startTX: 0,
    startTY: 0,
    pointerId: -1,
  });

  useEffect(() => {
    const root = rootRef.current;
    const back = backRef.current;
    const front = frontRef.current;
    if (!root || !back || !front) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      // 完全静止: transform は 0 のまま、ドラッグも張らない。
      back.style.transform = "translate3d(0,0,0)";
      front.style.transform = "translate3d(0,0,0)";
      return;
    }

    let raf = 0;
    let start = 0;

    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // CTA など操作要素の上ではドラッグ開始しない (タップ優先)。
      if (target && target.closest("[data-no-drag]")) return;
      const s = state.current;
      // まだ握らない(pending)。横移動が縦を上回って初めて dragging へ昇格させ、
      // 縦スクロール意図のジェスチャは奪わない (touch-action: pan-y と併せてページ縦スクロール優先)。
      s.pending = true;
      s.dragging = false;
      s.pointerId = e.pointerId;
      s.startPX = e.clientX;
      s.startPY = e.clientY;
      s.startTX = s.targetX;
      s.startTY = s.targetY;
    };
    const onMove = (e: PointerEvent) => {
      const s = state.current;
      if (e.pointerId !== s.pointerId) return;
      const dx = e.clientX - s.startPX;
      const dy = e.clientY - s.startPY;
      if (s.pending && !s.dragging) {
        // 判定前: 縦優勢なら諦める(スクロール優先)、横優勢が閾値超えでドラッグ確定。
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
      s.targetX = clamp(s.startTX + dx * DRAG_GAIN, MAX_X);
      s.targetY = clamp(s.startTY + dy * DRAG_GAIN, MAX_Y);
    };
    const onUp = (e: PointerEvent) => {
      const s = state.current;
      if (e.pointerId !== s.pointerId) return;
      s.pending = false;
      s.dragging = false;
      s.pointerId = -1;
      // ターゲットを中央へ (rAF が滑らかに戻す)。
      s.targetX = 0;
      s.targetY = 0;
    };

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);

    const tick = (ts: number) => {
      if (!start) start = ts;
      const s = state.current;
      // 無操作時のごく僅かな自動ドリフト (生きてる感)。
      if (!s.dragging) {
        const t = (ts - start) / 1000;
        s.targetX = Math.sin(t * 0.5) * DRIFT_X;
        s.targetY = Math.cos(t * 0.37) * DRIFT_Y;
      }
      s.curX += (s.targetX - s.curX) * EASE;
      s.curY += (s.targetY - s.curY) * EASE;
      back.style.transform = `translate3d(${s.curX.toFixed(2)}px, ${s.curY.toFixed(2)}px, 0)`;
      front.style.transform = `translate3d(${(s.curX * FRONT_RATIO).toFixed(2)}px, ${(s.curY * FRONT_RATIO).toFixed(2)}px, 0)`;
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
      className="relative isolate mx-auto w-full max-w-[600px] overflow-hidden rounded-[32px] touch-pan-y select-none"
      style={{ background: "#F4F5FB" }}
    >
      {/* ===== 奥(報酬)レイヤー: 器より少し大きく敷き、transform で気配だけ動かす ===== */}
      <div
        ref={backRef}
        className="absolute -inset-10 z-0 overflow-hidden will-change-transform"
        style={{ transform: "translate3d(0,0,0)" }}
      >
        <div className="h-full overflow-hidden pt-10">
          <TakoRewardBackdrop answered={answered} threshold={threshold} />
        </div>
      </div>

      {/* ===== 中間(スクリム): 手前の可読性を担保。少人数ほど濃い ===== */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: `linear-gradient(180deg, rgba(244,245,251,${scrimOpacity(answered, threshold)}) 0%, rgba(244,245,251,${Math.min(1, scrimOpacity(answered, threshold) + 0.15)}) 100%)`,
          transition: "background 0.5s ease",
        }}
        aria-hidden="true"
      />

      {/* ===== 手前(主役): カウンターカード。ごく僅かに追従 ===== */}
      <div
        ref={frontRef}
        className="relative z-20 px-4 py-12 md:px-8 md:py-14 will-change-transform"
        style={{ transform: "translate3d(0,0,0)" }}
      >
        <div className="mx-auto max-w-[460px]">{children}</div>
      </div>
    </div>
  );
}
