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
//   - カード直下に「押して奥をチラ見」ピルを常時表示 (発見性)。押している間だけ
//     カード全体(背景＋中身)を opacity 0 へフェード + わずかに縮小し、奥を素で見せる。
//     指を離すと がっつり(白0.9)戻る。
//   - ★横スワイプ検知は廃止。実機(iOS)で touch-action/pointercancel/斜め開始により
//     ほぼ発火せず、かつ発見されにくかったため。押下ジェスチャは軸判定もスクロール競合も
//     無く堅牢 (ピルは touch-action:none で自前処理)。
//   - opacity はカード“自要素”に効かせる(--peek-opacity を継承)。祖先 opacity だと
//     backdrop-filter を持つカードの中身が WebKit で濃いまま残る癖があるため。
//   - prefers-reduced-motion: 退避無効(ピルも出さない)。sticky はレイアウトなので維持。
//   - ?peek=1 (dev限定): 退避状態を静的描画するスクショ確認用。

import { useEffect, useRef, type ReactNode } from "react";
import { TakoRewardBackdrop } from "./TakoRewardBackdrop";

const PEEK_EASE = 0.2; // 目標値への追従係数 (押下/解放時のなめらかさ)
const PEEK_FADE = 1.0; // 退避時の最大フェード (opacity 1 → 0。手前をまるごと消して奥だけに)
const PEEK_SHRINK = 0.05; // 退避時の最大縮小 (scale 1 → 1-0.05)
const PEEK_BLUR_MAX = 24; // フロストの blur(px)。退避量に比例して 0 へ減衰し、奥を素で見せる。

const NAVY = "#2E2E5C";

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
  const peekBtnRef = useRef<HTMLButtonElement>(null);

  const state = useRef({ curPeek: 0, pressed: false });

  useEffect(() => {
    const front = frontRef.current;
    const btn = peekBtnRef.current;
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
    if (reduced) {
      applyFront(previewPeek ? 1 : 0);
      // 退避無効の環境では操作子(ピル)も出さない。
      if (btn) btn.style.display = "none";
      return;
    }

    if (previewPeek) state.current.curPeek = 1;

    let raf = 0;
    const press = (e: PointerEvent) => {
      state.current.pressed = true;
      // 指がボタン外へ出ても pointerup を取りこぼさないよう捕捉。
      try {
        btn?.setPointerCapture(e.pointerId);
      } catch {
        /* capture 不可環境は無視 */
      }
    };
    const release = () => {
      state.current.pressed = false;
    };

    if (btn) {
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointercancel", release);
      btn.addEventListener("pointerleave", release);
    }

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

    return () => {
      cancelAnimationFrame(raf);
      if (btn) {
        btn.removeEventListener("pointerdown", press);
        btn.removeEventListener("pointerup", release);
        btn.removeEventListener("pointercancel", release);
        btn.removeEventListener("pointerleave", release);
      }
    };
  }, []);

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
          奥への背景スクロールを妨げず、カード/ピルだけ pointer-events-auto。 ===== */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="sticky top-0 flex h-[100dvh] flex-col items-center justify-center gap-3 px-4">
          <div
            ref={frontRef}
            className="pointer-events-auto w-full max-w-[400px] [will-change:transform]"
          >
            {children}
          </div>

          {/* 退避トリガ: 押している間だけ奥をチラ見。常時表示で発見性を確保。 */}
          <button
            ref={peekBtnRef}
            type="button"
            aria-label="押している間、奥の結果をチラ見できます"
            className="pointer-events-auto inline-flex select-none items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-black shadow-[0_6px_18px_rgba(46,46,92,0.14)] ring-1 ring-black/[0.06] [touch-action:none] active:scale-95"
            style={{ background: "rgba(255,255,255,0.92)", color: NAVY }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            押して奥をチラ見
          </button>
        </div>
      </div>
    </div>
  );
}
