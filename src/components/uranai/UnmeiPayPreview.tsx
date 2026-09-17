"use client";

// dev 限定プレビュー: チャット内決済フォームを単体表示する。
// 出生情報の入力フローなしで配置を確認するための足場 (?preview=pay)。

import UnmeiEmbeddedCheckout from "@/components/uranai/UnmeiEmbeddedCheckout";
import type { AppResultLocale } from "@/i18n/result";

export default function UnmeiPayPreview({
  locale = "ja",
}: {
  locale?: AppResultLocale;
}) {
  return (
    <main className="mx-auto max-w-[480px] px-4 py-10">
      <p className="mb-4 text-center text-sm font-bold text-[#8A8AA3]">
        {locale === "en"
          ? "[dev] Embedded checkout"
          : locale === "ko"
            ? "[dev] 채팅 결제 양식"
            : "[dev] チャット内決済フォーム"}
      </p>
      <UnmeiEmbeddedCheckout
        ownerToken={null}
        product="full_access"
        onComplete={() => undefined}
        locale={locale}
        previewMode
      />
    </main>
  );
}
