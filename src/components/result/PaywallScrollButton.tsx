"use client";

// 最下部の課金カード (FullAccessPromoCard, #fullaccess-promo) へスムーススクロール
// + 着地パルスするボタン。挙動は深掘りロックタブ (DeepDiveSections) と同一で、
// scroll-to-paywall.ts に集約されたものを使う。
// サーバコンポーネント (/me の解除カード等) から onClick を書けないため切り出し。

import { scrollToPaywall } from "@/lib/scroll-to-paywall";

interface PaywallScrollButtonProps {
  className?: string;
  children: React.ReactNode;
}

export function PaywallScrollButton({
  className,
  children,
}: PaywallScrollButtonProps) {
  return (
    <button type="button" onClick={scrollToPaywall} className={className}>
      {children}
    </button>
  );
}
