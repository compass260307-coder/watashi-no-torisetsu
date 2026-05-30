"use client";

// Phase 1.5-α Day 12-C3: /friend/[inviteCode] の intro 画面下に常時固定する CTA バー
//
// 既存 components/FloatingCTABar.tsx (LP 用、4 状態) とは別物。
// このコンポーネントは intro 画面でのみ表示し、評価フロー (scale/choice/consent) に
// 入ったら親側で条件分岐により非表示にする (本コンポーネントは表示制御を持たない)。
//
// iOS safe-area 対応: padding-bottom に env(safe-area-inset-bottom) を加算 (style 属性で)。

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
      className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-sm border-t border-[#0094D8]/20 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="max-w-[480px] mx-auto px-4 py-3">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="w-full bg-[#FFE993] text-[#3A2D6B] font-black text-base px-8 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {children ?? label} →
        </button>
      </div>
    </div>
  );
}
