"use client";

import { useEffect, useRef } from "react";
import { trackX, X_DIAGNOSIS_PENDING_PREFIX, type XEventParams } from "@/lib/xPixel";

const sentEvents = new Set<string>();

export function XTrack({ eventId, params, requireDiagnosisCompletion = false }: {
  eventId: string;
  params: XEventParams;
  requireDiagnosisCompletion?: boolean;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || typeof window.twq !== "function") return;
    const key = `wt_x_sent_v1:${eventId}:${params.conversion_id}`;
    if (sentEvents.has(key)) return;
    // Page-independent key: the same Stripe session stays claimed across
    // client navigation, full page loads and reloads within this tab.
    try {
      if (sessionStorage.getItem(key) === "1") return;
    } catch {
      // Fall back to the existing persistent and in-memory guards.
    }
    try {
      if (localStorage.getItem(key) === "1") return;
    } catch {
      // In-memory deduplication still covers Strict Mode and remounts.
    }
    if (requireDiagnosisCompletion) {
      // Only the tab that successfully saved this diagnosis may consume the marker.
      // Missing/expired storage fails closed, including shared result links.
      try {
        const markerKey = X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
        const savedAt = Number(sessionStorage.getItem(markerKey));
        const age = Date.now() - savedAt;
        if (!savedAt || age < 0 || age > 10 * 60 * 1000) return;
        sessionStorage.removeItem(markerKey);
      } catch {
        return;
      }
    }
    sent.current = true;
    sentEvents.add(key);
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage restrictions must not interrupt the purchase completion page.
    }
    trackX(eventId, params);
    try {
      localStorage.setItem(key, "1");
    } catch {
      // The conversion_id is also stable for advertising-side deduplication.
    }
  }, [eventId, params, requireDiagnosisCompletion]);
  return null;
}
