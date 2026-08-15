"use client";

// 運命の設計図チャットの最終購入カード。
// 自己診断結果などと同じ3コース比較を再利用し、価格・特典・CTA・計測の
// 仕様がページごとにずれないようにする。

import { SelfAccessPlanCarousel } from "@/components/result/SelfAccessPlanCarousel";
import type { ResultLocale } from "@/i18n/result";

export default function UnmeiHostedCheckoutCard({
  ownerToken,
  previewMode = false,
  locale = "ja",
}: {
  ownerToken: string | null;
  /** ローカルUI確認用。購入ボタンを押してもAPIや計測を呼ばない。 */
  previewMode?: boolean;
  locale?: ResultLocale;
}) {
  return (
    <SelfAccessPlanCarousel
      ownerToken={ownerToken ?? undefined}
      anchorId="unmei-chat-plans"
      ctaSource="unmei_birth_chat"
      frameless
      returnTo="unmei"
      defaultProduct="premium_bundle"
      previewMode={previewMode}
      locale={locale}
    />
  );
}
