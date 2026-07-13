"use client";

// 最下部の課金カード (FullAccessPromoCard, #fullaccess-promo) へスムーススクロール
// + 着地パルスするボタン。挙動は深掘りロックタブ (DeepDiveSections) と同一で、
// scroll-to-paywall.ts に集約されたものを使う。
// サーバコンポーネント (/me の解除カード等) から onClick を書けないため切り出し。
//
// source は課金ファネル計測 (paywall_scroll_clicked の metadata.source)。
// どのボタンが課金カードへの誘導に効いているかを見るため、設置場所ごとに一意な値を渡す。

import { scrollToPaywall } from "@/lib/scroll-to-paywall";

interface PaywallScrollButtonProps {
  /** 計測用の設置場所ID (例: urawaza_card / relations_card)。 */
  source: string;
  className?: string;
  children: React.ReactNode;
}

export function PaywallScrollButton({
  source,
  className,
  children,
}: PaywallScrollButtonProps) {
  return (
    <button
      type="button"
      onClick={() => scrollToPaywall(source)}
      className={className}
    >
      {children}
    </button>
  );
}
