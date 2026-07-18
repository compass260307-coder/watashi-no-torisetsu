"use client";

import { useEffect } from "react";
import type { ResultLocale } from "@/i18n/result";

export function PreferredLocaleSync({
  ownerToken,
  locale,
}: {
  ownerToken: string;
  locale: ResultLocale;
}) {
  useEffect(() => {
    fetch("/api/account/preferred-locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerToken, locale }),
    }).catch(() => {
      // 言語設定の同期失敗で結果閲覧を止めない。
    });
  }, [locale, ownerToken]);

  return null;
}
