"use client";

import {
  TopViewTracker,
  trackTopCta,
} from "@/components/top/TopAnalytics";

export function KoTopViewTracker() {
  return <TopViewTracker locale="ko" />;
}

export function trackKoTopCta() {
  trackTopCta("ko");
}
