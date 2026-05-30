"use client";

// Phase 1.5-α Day 12-C3: /friend/[inviteCode] の intro 画面下に常時固定する CTA バー
// Phase 1.5-α Day 12-C3-fix: 白背景バーを撤去、ボタン単体を浮かせる方式に統一
//   (LP の FloatingCTABar.tsx line 106 と同じレイアウトパターン)
//
// 既存 components/FloatingCTABar.tsx (LP 用、4 状態) とは別物。
// このコンポーネントは intro 画面でのみ表示し、評価フロー (scale/choice/consent) に
// 入ったら親側で条件分岐により非表示にする (本コンポーネントは表示制御を持たない)。
//
// レイアウト方針 (LP と統一):
//   - 白背景バー / 上方向シャドウ / バー全体の padding は持たない
//   - ボタン自体を fixed で画面下中央に浮かせる (bottom-4 で画面下から 16px)
//   - 横は端から 16px 余白 + max-w-[480px] (LP と同一の幅制限)
//   - 背景の grid-bg が CTA 周辺まで透けて見える
//
// iOS safe-area 対応: padding-bottom に env(safe-area-inset-bottom) を加算
//   (bottom-4 と組み合わせて safe-area インセット下端も加味)。

import type { ReactNode } from "react";

interface FriendFlowFloatingCtaProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  children?: ReactNode;
}

export function FriendFlowFloatingCta({
  onClick,
  disabled = false,
  label = "相互理解度を測る",
  children,
}: FriendFlowFloatingCtaProps) {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[480px] z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full bg-[#FFE993] text-[#3A2D6B] font-black text-base px-8 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {children ?? label} →
      </button>
    </div>
  );
}
