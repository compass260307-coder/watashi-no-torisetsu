// Phase 1.5-α Day 12-Polish-D-A FINAL + variant 化: 全画面共通の固定 CTA フッター
//
// 設計思想:
//   - 白い矩形バー (床) を全廃。代わりに「フロスト・グラデーション・スクリム」で統一。
//     - 下端は不透明クリーム (#FFF9F0) → ボタン直下のコントラスト確保 (視認性◎)
//     - 上端は完全フェード (transparent) → 矩形の白エッジを作らない
//   - LP / 名前入力 / 診断 / friend 評価フロー、全画面でこの 1 部品を使う。
//
// variant (画面の性質で 2 種類):
//   - "scrim" (既定): 半透明クリーム + grid-bg ぼかし透過 + 上端マスクフェード
//     用途: footer 直上に回答や選択肢が来ない画面
//           (LP / 名前入力 / friend intro·consent·error / NameOverlay)
//   - "solid": 不透明クリーム (下 60% ベタ) + 上端羽根フェード、ぼかしフィルタなし
//     用途: footer 直上に回答 / 選択肢が来る画面
//           (診断 50 問 ScaleScreen / friend スケール ScaleScreen)
//     "solid" の理由: scrim の半透明 + blur だと、ボタン裏に回答の○が霧がかって
//     透けて見えてしまい、ごちゃつく。不透明クリームならボタン裏でブロックされる。
//
// レイアウト:
//   - 背景レイヤー (絶対配置 inset-0) にだけ blur / mask を当てる。
//   - ボタンは前面レイヤーで常に不透明 (マスク非対象)。
//
// 使い方:
//   <StickyCtaFooter>
//     <button className={ctaPrimary}>次へ</button>
//   </StickyCtaFooter>
//
//   <StickyCtaFooter variant="solid">
//     <button className={ctaSecondary}>戻る</button>
//     <button className={ctaPrimary}>次へ</button>
//   </StickyCtaFooter>
//
// 注意:
//   - 本文側に pb-32 程度の下部余白を確保 (コンテンツが footer に隠れない)
//   - z-50。HamburgerMenu (z-[100] Portal) より下、それ以外より上。

import type { ReactNode } from "react";

type Variant = "scrim" | "solid" | "white";

const bgClass: Record<Variant, string> = {
  // scrim: 半透明クリーム + blur + 上端マスクフェードで blur 上端の薄い線も消す
  scrim:
    "bg-gradient-to-t from-[#FFF9F0]/95 via-[#FFF9F0]/80 to-transparent backdrop-blur-sm " +
    "[mask-image:linear-gradient(to_top,#000_55%,transparent)] " +
    "[-webkit-mask-image:linear-gradient(to_top,#000_55%,transparent)]",
  // solid: 下 60% ベタの不透明クリーム + 上 40% フェード。blur なし。
  solid: "bg-gradient-to-t from-[#FFF9F0] from-[60%] to-transparent",
  // white: solid の白背景版。白基調ページ (トップ準拠デザインの /diagnosis) 用。
  white: "bg-gradient-to-t from-white from-[60%] to-transparent",
};

export function StickyCtaFooter({
  children,
  variant = "scrim",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 pt-12 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* 背景レイヤー (ボタンの裏)。mask / ぼかしはここだけに効かせる */}
      <div aria-hidden className={`absolute inset-0 ${bgClass[variant]}`} />
      {/* 前面: 主要 CTA (常に不透明・マスク非対象) */}
      <div className="relative flex items-center justify-center gap-3">
        {children}
      </div>
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
