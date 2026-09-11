"use client";

import { useEffect, useRef } from "react";
import type { ResultLocale } from "@/i18n/result";
import { track } from "@/lib/track";

type TopLocale = ResultLocale | "en";

export function TopViewTracker({ locale }: { locale: TopLocale }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("top_viewed", { metadata: { locale, page: "top" } });
  }, [locale]);

  return null;
}

export function trackTopCta(locale: TopLocale) {
  track("top_cta_clicked", {
    metadata: { locale, page: "top", destination: "diagnosis" },
  });
}
