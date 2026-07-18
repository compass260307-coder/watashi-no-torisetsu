"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

export function KoTopViewTracker() {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("top_viewed", { metadata: { locale: "ko", page: "top" } });
  }, []);

  return null;
}

export function trackKoTopCta() {
  track("top_cta_clicked", {
    metadata: { locale: "ko", page: "top", destination: "diagnosis" },
  });
}
