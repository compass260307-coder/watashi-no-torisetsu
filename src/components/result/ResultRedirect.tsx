"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResultRedirect({
  locale,
}: {
  locale: "ja" | "en";
}) {
  const router = useRouter();
  const localePrefix = locale === "en" ? "/en" : "";

  useEffect(() => {
    let ownerToken: string | null = null;
    try {
      ownerToken = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // Storage unavailable: send the visitor back through diagnosis.
    }
    router.replace(
      ownerToken
        ? `${localePrefix}/me/${encodeURIComponent(ownerToken)}`
        : `${localePrefix}/diagnosis`,
    );
  }, [localePrefix, router]);

  return (
    <div className="grid-bg flex min-h-screen items-center justify-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#2E2E5C]/20 border-t-[#2E2E5C]"
        role="status"
        aria-label={locale === "en" ? "Loading your result" : "読み込み中"}
      />
    </div>
  );
}
