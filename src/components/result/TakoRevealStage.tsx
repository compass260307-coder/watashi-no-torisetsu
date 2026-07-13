"use client";

// 三層ゲートの“器” = 擬似ビューポート。奥(報酬)/手前(カウンター)を内包する。
//
// レイアウト方針:
//   - position:fixed は使わない。root は position:relative + overflow:hidden。
//   - 奥はスナップショット相当の軽量ダミーDOM(TakoRewardBackdrop)。動かすのは transform だけ。
//
// パララックス + 手前の退避 (★2026-07-14 追加):
//   - 背景ドラッグで奥だけが動く (パララックス)。手前カードはごく僅か追従 (奥:手前 = 1:0.2)。
//   - ★ドラッグ中は手前カードをフェード + わずかに縮小して退避させ、奥の結果ページ(?だらけ)を
//     しっかり覗ける状態にする (「覗けるけど読めない」焦らし)。指を離すとすっと戻る。
//     手前=可読性レイヤー(フロスト)なので、退避＝スクリムも薄まる。
//   - transform/opacity は rAF で ref に直接書き込む。CTA など data-no-drag 上ではドラッグ非開始。
//   - prefers-reduced-motion: パララックス無効 + 退避無効 (カードは常時表示)。
//   - ?peek=1 (dev のみ): 退避状態を静的に描画してスクショ確認できるようにする。

import { useEffect, useRef, type ReactNode } from "react";
import { TakoRewardBackdrop } from "./TakoRewardBackdrop";

const MAX_X = 20; // 奥レイヤーの水平可動域(px)
const MAX_Y = 26; // 奥レイヤーの垂直可動域(px)
const DRAG_GAIN = 0.4; // 指移動→奥移動の減衰 (気配程度)
const FRONT_RATIO = 0.2; // 手前カードの追従比
const EASE = 0.12; // パララックスの追従イージング
const DRIFT_X = 6; // 自動ドリフト振幅(px)
const DRIFT_Y = 4;
const PEEK_TRAVEL = 90; // このドラッグ距離(px)で退避が最大に
const PEEK_EASE = 0.18; // 退避の追従イージング (パララックスより少し速く)
const PEEK_FADE = 0.9; // 退避時の最大フェード量 (opacity 1 → 1-0.9)
const PEEK_SHRINK = 0.05; // 退避時の最大縮小量 (scale 1 → 1-0.05)

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
    curPeek: 0, // 0=通常 / 1=退避
    dragMag: 0, // 現ドラッグの移動距離(px)
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

    // dev のみ: ?peek=1 で退避状態を静的表示 (スクショ確認用)。本番は無効。
    const previewPeek =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("peek") === "1";

    const applyFront = (peek: number, followX: number, followY: number) => {
      const scale = 1 - peek * PEEK_SHRINK;
      front.style.opacity = (1 - peek * PEEK_FADE).toFixed(3);
      front.style.transform = `translate3d(${followX.toFixed(2)}px, ${followY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      // 退避もパララックスも無効 (カードは常時くっきり表示)。
      back.style.transform = "translate3d(0,0,0)";
      applyFront(0, 0, 0);
      return;
    }

    if (previewPeek) state.current.curPeek = 1;

    let raf = 0;
    let start = 0;

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
      s.dragMag = Math.hypot(dx, dy);
      s.targetX = clamp(s.startTX + dx * DRAG_GAIN, MAX_X);
      s.targetY = clamp(s.startTY + dy * DRAG_GAIN, MAX_Y);
    };
    const onUp = (e: PointerEvent) => {
      const s = state.current;
      if (e.pointerId !== s.pointerId) return;
      s.pending = false;
      s.dragging = false;
      s.dragMag = 0;
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

      // 退避量: ドラッグ距離に比例 (指で引くほど退避)。離すと 0 へ戻る。
      const peekTarget = previewPeek
        ? 1
        : s.dragging
          ? Math.min(1, s.dragMag / PEEK_TRAVEL)
          : 0;
      s.curPeek += (peekTarget - s.curPeek) * PEEK_EASE;

      back.style.transform = `translate3d(${s.curX.toFixed(2)}px, ${s.curY.toFixed(2)}px, 0)`;
      applyFront(s.curPeek, s.curX * FRONT_RATIO, s.curY * FRONT_RATIO);
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
      // full-bleed: 器を viewport 全幅に広げ、画面のどこでも奥(結果ページ)が透ける状態に。
      className="relative isolate flex min-h-[780px] w-screen ml-[calc(50%-50vw)] items-center overflow-hidden touch-pan-y select-none md:min-h-[820px]"
      style={{ background: "#F6F7F9" }}
    >
      {/* ===== 奥(報酬)レイヤー: 器より少し大きく敷き、transform で気配だけ動かす。 ===== */}
      <div
        ref={backRef}
        className="absolute -inset-6 z-0 overflow-hidden will-change-transform"
        style={{ transform: "translate3d(0,0,0)" }}
      >
        <div className="h-full overflow-hidden pt-6">
          <TakoRewardBackdrop answered={answered} threshold={threshold} />
        </div>
      </div>

      {/* ===== 手前(主役): カウンターカード。ドラッグ中はフェード+縮小で退避し奥を覗かせる。 ===== */}
      <div
        ref={frontRef}
        className="relative z-20 w-full px-4 py-10 [will-change:transform,opacity] md:px-6"
      >
        <div className="mx-auto max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
