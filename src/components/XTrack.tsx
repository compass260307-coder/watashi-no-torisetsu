"use client";

import { useEffect } from "react";
import { trackXEventsOnce, type XEventParams } from "@/lib/xPixel";

export function XTrack({ eventIds, params, requireDiagnosisCompletion = false }: {
  eventIds: readonly string[];
  params: XEventParams;
  requireDiagnosisCompletion?: boolean;
}) {
  const eventIdsKey = eventIds.join(",");
  const { conversion_id: conversionId, value, currency } = params;
  useEffect(() => {
    if (!eventIdsKey || !conversionId) return;
    let active = true;
    let attempts = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const send = async () => {
      const complete = await trackXEventsOnce(
        eventIdsKey.split(","),
        {
          conversion_id: conversionId,
          ...(value !== undefined ? { value } : {}),
          ...(currency !== undefined ? { currency } : {}),
        },
        requireDiagnosisCompletion,
        () => active,
      );
      // Covers a delayed twq loader or a temporarily failing destination.
      if (active && !complete && ++attempts < 20) {
        timeout = setTimeout(() => { void send(); }, 250);
      }
    };
    void send();
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [eventIdsKey, conversionId, value, currency, requireDiagnosisCompletion]);
  return null;
}
