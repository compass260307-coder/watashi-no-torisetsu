"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    gtag?: (
      command: "config" | "event" | "set" | "consent" | "js",
      targetId: string | Date,
      params?: Record<string, unknown>,
    ) => void;
    dataLayer?: unknown[];
  }
}

// Next.js App Router の SPA 遷移を計測。
// 初回ロードは GoogleAnalytics の config で送信され、
// 以降の pathname / searchParams 変化ごとに gtag('config') を再送する。
export default function GoogleAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const isProduction = process.env.NODE_ENV === "production";

  useEffect(() => {
    if (!isProduction || !gaId || typeof window === "undefined") return;
    if (!window.gtag) return;

    const queryString = searchParams.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;

    window.gtag("config", gaId, { page_path: url });
  }, [pathname, searchParams, gaId, isProduction]);

  return null;
}
