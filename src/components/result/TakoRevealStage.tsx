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
// 退避(奥をチラ見):
//   - カード内(TakoShareGate)に「押して奥をチラ見」ピルを常時表示。押している間だけ
//     カード全体(背景＋中身)を opacity 0 へフェード + わずかに縮小し、奥を素で見せる。
//     指を離すと がっつり(白0.9)戻る。
//   - ★横スワイプ検知は廃止(実機iOSで touch-action/pointercancel/斜め開始によりほぼ
//     不発、かつ発見されにくかった)。押下ジェスチャは軸判定もスクロール競合も無く堅牢。
//   - ★ピルは “カード内” に置く。カードは画面内に必ず収まる主役なので、端末サイズや下部
//     固定ナビに隠れない(カード直下に浮かせる案は小型端末でナビ裏に回り込むため不採用)。
//     押下ハンドラは PeekContext 経由でこの器の rAF を駆動する。
//   - opacity はカード“自要素”に効かせる(--peek-opacity を継承)。祖先 opacity だと
//     backdrop-filter を持つカードの中身が WebKit で濃いまま残る癖があるため。
//   - prefers-reduced-motion: 退避無効(ピルも出さない)。sticky はレイアウトなので維持。
//   - ?peek=1 (dev限定): 退避状態を静的描画するスクショ確認用。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { TakoRewardBackdrop } from "./TakoRewardBackdrop";

const PEEK_EASE = 0.2; // 目標値への追従係数 (押下/解放時のなめらかさ)
const PEEK_FADE = 1.0; // 退避時の最大フェード (opacity 1 → 0。手前をまるごと消して奥だけに)
const PEEK_SHRINK = 0.05; // 退避時の最大縮小 (scale 1 → 1-0.05)
const PEEK_BLUR_MAX = 24; // フロストの blur(px)。退避量に比例して 0 へ減衰し、奥を素で見せる。

/** 退避トリガ(カード内ピル)から器の rAF を駆動するための橋渡し。 */
export interface TakoPeekControl {
  onPeekStart: (e: ReactPointerEvent) => void;
  onPeekEnd: () => void;
  /** reduced-motion 等で退避無効のとき true。ピルは描画しない。 */
  hidden: boolean;
}

const PeekContext = createContext<TakoPeekControl | null>(null);

/** カード側(TakoShareGate)が退避ピルを描画・接続するためのフック。 */
export function useTakoPeek(): TakoPeekControl | null {
  return useContext(PeekContext);
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
  const frontRef = useRef<HTMLDivElement>(null);
  const state = useRef({ curPeek: 0, pressed: false });
  // 退避無効(reduced-motion)ならピルを隠す。初期は表示、マウント後に確定。
  const [peekHidden, setPeekHidden] = useState(false);

  const onPeekStart = useCallback((e: ReactPointerEvent) => {
    state.current.pressed = true;
    // 指がピル外へ出ても pointerup を取りこぼさないよう捕捉。
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture 不可環境は無視 */
    }
  }, []);
  const onPeekEnd = useCallback(() => {
    state.current.pressed = false;
  }, []);

  useEffect(() => {
    const front = frontRef.current;
    if (!front) return;

    const previewPeek =
      process.env.NODE_ENV !== "production" &&
      new URLSearchParams(window.location.search).get("peek") === "1";

    const applyFront = (peek: number) => {
      front.style.transform = `scale(${(1 - peek * PEEK_SHRINK).toFixed(4)})`;
      // opacity と blur の2値をカード“自身”へ custom property で渡す(継承)。
      //   --peek-opacity (1→0): カード全体(背景＋中身)をまるごとフェード。
      //   --peek-blur (24→0): フロストを解いて奥を素にする。
      front.style.setProperty(
        "--peek-opacity",
        (1 - peek * PEEK_FADE).toFixed(3),
      );
      front.style.setProperty(
        "--peek-blur",
        `${(PEEK_BLUR_MAX * (1 - peek)).toFixed(1)}px`,
      );
    };

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    setPeekHidden(reduced);
    if (reduced) {
      applyFront(previewPeek ? 1 : 0);
      return;
    }

    if (previewPeek) state.current.curPeek = 1;

    let raf = 0;
    const tick = () => {
      const s = state.current;
      const target = previewPeek ? 1 : s.pressed ? 1 : 0;
      s.curPeek += (target - s.curPeek) * PEEK_EASE;
      // 目標にほぼ到達したら値を確定 (浮動小数の尾を切って完全な 0/1 に落とす)。
      if (Math.abs(target - s.curPeek) < 0.001) s.curPeek = target;
      applyFront(s.curPeek);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  const peekValue = useMemo<TakoPeekControl>(
    () => ({ onPeekStart, onPeekEnd, hidden: peekHidden }),
    [onPeekStart, onPeekEnd, peekHidden],
  );

  return (
    <div
      className="relative isolate w-screen ml-[calc(50%-50vw)] select-none"
      style={{ background: "#F6F7F9" }}
    >
      {/* ===== 奥(結果ページの長いダミー): 通常フローでセクション高さを決める ===== */}
      <div className="relative z-0">
        <TakoRewardBackdrop answered={answered} threshold={threshold} />
      </div>

      {/* ===== 手前(主役): sticky で画面中央に留まる。overlay は pointer-events-none にして
          奥への背景スクロールを妨げず、カードだけ pointer-events-auto。 ===== */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="sticky top-0 flex h-[100dvh] items-center justify-center px-4">
          <div
            ref={frontRef}
            className="pointer-events-auto w-full max-w-[400px] [will-change:transform]"
          >
            <PeekContext.Provider value={peekValue}>
              {children}
            </PeekContext.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}
