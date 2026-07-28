"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

type UnmeiViewEvent = "unmei_lp_view" | "unmei_reading_view";

export default function UnmeiViewTracker({
  eventName,
  ownerToken = null,
  state,
  product,
}: {
  eventName: UnmeiViewEvent;
  ownerToken?: string | null;
  state?: string;
  product?: string;
}) {
  useEffect(() => {
    track(eventName, {
      ownerToken,
      metadata: {
        page: "unmei",
        ...(state ? { state } : {}),
        ...(product ? { product } : {}),
      },
    });
  }, [eventName, ownerToken, product, state]);

  return null;
}
