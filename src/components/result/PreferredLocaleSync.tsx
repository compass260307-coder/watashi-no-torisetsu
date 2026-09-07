"use client";

import { useEffect } from "react";
import type { ResultLocale } from "@/i18n/result";

const SYNCED_PREFERENCE_KEY = "torisetsu_preferred_locale_synced";

export function PreferredLocaleSync({
  ownerToken,
  locale,
}: {
  ownerToken: string;
  locale: ResultLocale;
}) {
  useEffect(() => {
    const preference = `${ownerToken}:${locale}`;
    try {
      if (sessionStorage.getItem(SYNCED_PREFERENCE_KEY) === preference) return;
    } catch {
      // sessionStorage不可でもサーバー同期は継続する。
    }

    const controller = new AbortController();
    void fetch("/api/account/preferred-locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerToken, locale }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) return;
        try {
          sessionStorage.setItem(SYNCED_PREFERENCE_KEY, preference);
        } catch {
          // 保存できなくても言語設定の同期自体は完了している。
        }
      })
      .catch(() => {
        // 言語設定の同期失敗で結果閲覧を止めない。
      });
    return () => controller.abort();
  }, [locale, ownerToken]);

  return null;
}
