"use client";

import { useEffect } from "react";
import {
  TAKO_ATTENTION_PENDING_KEY,
} from "@/lib/tako-attention";
import { track } from "@/lib/track";

const TAKO_VIEWED_SESSION_PREFIX = "wt_tako_viewed_session_v1:";

export function TakoViewTracker({
  ownerToken,
  inviteCode,
  enabled = true,
}: {
  ownerToken: string;
  inviteCode: string;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;

    let attentionPending = false;
    let alreadyTracked = false;
    try {
      attentionPending =
        localStorage.getItem(TAKO_ATTENTION_PENDING_KEY) === ownerToken;
      if (attentionPending) {
        localStorage.removeItem(TAKO_ATTENTION_PENDING_KEY);
      }

      const viewedKey = `${TAKO_VIEWED_SESSION_PREFIX}${ownerToken}`;
      alreadyTracked = sessionStorage.getItem(viewedKey) === "1";
      if (!alreadyTracked) sessionStorage.setItem(viewedKey, "1");
    } catch {
      // Storage が使えない環境でも到達イベント自体は送る。
    }

    if (!alreadyTracked) {
      track("tako_viewed", {
        ownerToken,
        inviteCode,
        metadata: { attentionPending },
      });
    }
  }, [enabled, inviteCode, ownerToken]);

  return null;
}
