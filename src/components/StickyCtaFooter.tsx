// Phase 1.5-α Day 12-Polish-D-A FINAL: 全画面共通の固定 CTA フッター
//
// 設計思想:
//   - 白い矩形バー (床) を全廃。代わりに「フロスト・グラデーション・スクリム」で統一。
//     - 下端は不透明クリーム (#FFF9F0) → ボタン直下のコントラスト確保 (視認性◎)
//     - 上端は完全フェード (transparent) → 矩形の白エッジを作らない
//     - backdrop-blur で grid-bg をふんわりぼかして透けさせる (LP 世界観統一)
//   - LP / 名前入力 / 診断 / friend 評価フロー、全画面でこの 1 部品を使う。
//     Day 12-C3-fix で FriendFlowFloatingCta に行った白背景撤去方針を本部品で正式化。
//
// 使い方:
//   <StickyCtaFooter>
//     <button className={ctaPrimary}>次へ</button>
//   </StickyCtaFooter>
//
//   <StickyCtaFooter>
//     <button className={ctaSecondary}>戻る</button>
//     <button className={ctaPrimary}>次へ</button>
//   </StickyCtaFooter>
//
// 注意:
//   - 本文側に pb-32 程度の下部余白を確保すること (コンテンツが footer に隠れない)
//   - z-50。HamburgerMenu (z-[100] Portal) より下、それ以外より上。

import type { ReactNode } from "react";

export function StickyCtaFooter({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-center gap-3 pt-12 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#FFF9F0]/95 via-[#FFF9F0]/80 to-transparent backdrop-blur-sm">
      {children}
    </div>
  );
}

// ===========================================================================
// 標準 CTA クラス文字列 (全画面でこれを使う)
// ===========================================================================
//
// primary: 主要 CTA (次へ / 結果を見る / 相互理解度を測る / 無料で診断する など)
//   - sunYellow + deepPurple border + 立体シャドウ
//   - active 時に 2px 沈み込み (hover transform は持たない: 触れただけで動かない)
//   - disabled は opacity を落とすだけ。形・枠・シャドウは維持
//
// secondary: 副 CTA (戻る)
//   - 白背景 + deepPurple/40 border
//   - primary と同じ py-4 で高さを揃える
//   - 立体シャドウは持たない (主従関係をはっきりさせる)

export const ctaPrimary =
  "bg-[#FFE993] border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] text-[#3A2D6B] font-black rounded-full px-8 py-4 w-auto max-w-[300px] block disabled:opacity-50 disabled:cursor-not-allowed transition active:translate-y-[2px] active:shadow-[0_2px_0_#3A2D6B] text-center";

export const ctaSecondary =
  "bg-white border-2 border-[#3A2D6B]/40 text-[#3A2D6B] font-bold rounded-full px-6 py-4 w-auto block text-center transition active:translate-y-[2px]";
