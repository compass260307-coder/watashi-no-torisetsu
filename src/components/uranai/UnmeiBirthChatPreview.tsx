"use client";

import UnmeiBirthChat from "@/components/uranai/UnmeiBirthChat";
import type { ResultLocale } from "@/i18n/result";

// サーバーのプレビューページからイベント関数を渡さずに済むよう、
// ローカル確認専用のクライアント境界を小さく切り出す。
export default function UnmeiBirthChatPreview({
  locale = "ja",
}: {
  locale?: ResultLocale;
}) {
  return (
    <>
      <div className="bg-[#FFF6DF] px-4 py-2 text-center text-[11px] font-black tracking-[0.06em] text-[#8A5B17]">
        {locale === "ko"
          ? "LOCAL PREVIEW · 저장 및 결제는 실행되지 않습니다"
          : "LOCAL PREVIEW ・ 保存や決済は実行されません"}
      </div>
      <UnmeiBirthChat
        onSaved={() => undefined}
        mode="purchase"
        ownerToken={null}
        previewMode
        locale={locale}
      />
    </>
  );
}
