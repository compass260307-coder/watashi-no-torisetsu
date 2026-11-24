"use client";

import { useEffect } from "react";
import {
  TAKO_ATTENTION_PENDING_KEY,
} from "@/lib/tako-attention";
import { resultInviteCardTakoSeenAtKey } from "@/lib/result-invite-card";
import { readTakoEntry } from "@/lib/tako-entry";
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

    // 結果ページの招待カード (ResultInviteCard) が、友達診断ページを見た直後の人に
    // 続けて出さないようにするための時刻。上の到達計測の判定を巻き込まないよう、別に囲む。
    try {
      localStorage.setItem(resultInviteCardTakoSeenAtKey(ownerToken), String(Date.now()));
    } catch {
      // 残せなくても、招待カード側は「時刻なし」として扱う。
    }

    if (!alreadyTracked) {
      track("tako_viewed", {
        ownerToken,
        inviteCode,
        // entry: どの入口から来たか (src/lib/tako-entry.ts)。セッション内の最初の到達だけ記録する。
        metadata: { attentionPending, entry: readTakoEntry(window.location.search) },
      });
    }
  }, [enabled, inviteCode, ownerToken]);

  return null;
}
