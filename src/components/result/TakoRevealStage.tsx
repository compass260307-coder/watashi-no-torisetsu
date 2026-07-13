"use client";

// 三層ゲートの“器” = 擬似ビューポート。奥(報酬)/手前(カウンター)を内包する。
//
// レイアウト方針 (spec 準拠):
//   - position:fixed は使わない。root は position:relative + overflow:hidden。
//     奥/手前は position:absolute or relative で内包する。
//   - 奥はスナップショット相当の軽量ダミーDOM(TakoRewardBackdrop)。動かすのは transform だけ。
//
// 可読性(スクリム)の考え方 ★2026-07-13 修正:
//   旧: 奥全体に inset-0 の半透明スクリムを敷いていた → 奥が完全に潰れて「?の気配」が消えた。
//   新: スクリムは廃止し、手前カード自体を「フロスト(backdrop-blur + 半透明白)」にする。
//     → カードの“下だけ”奥がぼやけて可読性を確保し、カードの“外側”では奥がちゃんと見える。
//     さらにカードは奥ページより小さくし、上下左右に奥が覗く余白を必ず残す(min-h + 中央寄せ)。
//
// パララックス (“気配”程度。主導線はCTA):
//   - 背景ドラッグで奥だけが動く。手前カードはごく僅か追従 (奥:手前 = 1:0.2)。
//   - transform を rAF で ref に直接書き込む。CTA など data-no-drag 上ではドラッグ開始しない。
//   - prefers-reduced-motion: 自動ドリフト停止 + パララックス無効 (完全静止)。

import { useEffect, useRef, type ReactNode } from "react";
import { TakoRewardBackdrop } from "./TakoRewardBackdrop";

const MAX_X = 20; // 奥レイヤーの水平可動域(px)
const MAX_Y = 26; // 奥レイヤーの垂直可動域(px)
const DRAG_GAIN = 0.4; // 指移動→奥移動の減衰 (気配程度)
const FRONT_RATIO = 0.2; // 手前カードの追従比
const EASE = 0.12; // current→target の追従イージング
const DRIFT_X = 6; // 自動ドリフト振幅(px)
const DRIFT_Y = 4;

function clamp(v: number, max: number) {
  return Math.max(-max, Math.min(max, v));
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
      back.style.transform = "translate3d(0,0,0)";
      front.style.transform = "translate3d(0,0,0)";
      return;
    }

    let raf = 0;
    let start = 0;

    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-no-drag]")) return;
      const s = state.current;
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
        // 縦優勢ならスクロール優先で諦める、横優勢が閾値超えでドラッグ確定。
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
      className="relative isolate mx-auto flex min-h-[780px] w-full max-w-[560px] items-center overflow-hidden rounded-[32px] touch-pan-y select-none md:min-h-[820px]"
      style={{ background: "#EEF0FA" }}
    >
      {/* ===== 奥(報酬)レイヤー: 器より少し大きく敷き、transform で気配だけ動かす。
          スクリムは廃止。カードの外側では奥(=?の並んだ結果ページ)がそのまま見える。 ===== */}
      <div
        ref={backRef}
        className="absolute -inset-6 z-0 overflow-hidden will-change-transform"
        style={{ transform: "translate3d(0,0,0)" }}
      >
        <div className="h-full overflow-hidden pt-6">
          <TakoRewardBackdrop answered={answered} threshold={threshold} />
        </div>
      </div>

      {/* ===== 手前(主役): カウンターカード。奥より小さく中央に浮かせ、上下左右に奥を覗かせる。
          カード自身がフロスト(半透明白 + backdrop-blur)なので、カードの下だけ奥がぼやけて
          可読性を担保し、カード越しにも“?の気配”が透ける。 ===== */}
      <div
        ref={frontRef}
        className="relative z-20 w-full px-4 py-10 will-change-transform md:px-6"
      >
        <div className="mx-auto max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
