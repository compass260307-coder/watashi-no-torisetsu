"use client";

import { useEffect, useRef } from "react";
import type { ResultLocale } from "@/i18n/result";
import { track } from "@/lib/track";

export function TopViewTracker({ locale }: { locale: ResultLocale }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("top_viewed", { metadata: { locale, page: "top" } });
  }, [locale]);

  return null;
}

export function trackTopCta(locale: ResultLocale) {
  track("top_cta_clicked", {
    metadata: { locale, page: "top", destination: "diagnosis" },
  });
}
