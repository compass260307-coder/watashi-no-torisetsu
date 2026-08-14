"use client";

// dev 限定プレビュー: 自己診断結果と共通の3コース比較カードを単体表示する。
// カードとCTAを入力フローなしで確認するための足場 (?preview=pay)。

import UnmeiHostedCheckoutCard from "@/components/uranai/UnmeiEmbeddedCheckout";

export default function UnmeiPayPreview() {
  return (
    <main className="mx-auto max-w-[480px] px-4 py-10">
      <p className="mb-4 text-center text-sm font-bold text-[#8A8AA3]">
        [dev] 3コース比較カード
      </p>
      <UnmeiHostedCheckoutCard ownerToken={null} previewMode />
    </main>
  );
}
