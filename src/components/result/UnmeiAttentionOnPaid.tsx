"use client";

// 課金 (full_access) 済みの /me を表示したとき、下部ナビ「運命」の
// 赤バッジ (UNMEI_ATTENTION_PENDING) を1回だけ付与する。
// 友達診断バッジ (TakoAttentionOnPaid) と同時に出す (2026-07-27 指示)。
// 付与は ownerToken ごとに1回 (granted マーカー)。/unmei を見たら
// UnmeiAttentionClear が pending を消す。

import { useEffect } from "react";
import {
  UNMEI_ATTENTION_PENDING_KEY,
  unmeiAttentionImpressionKey,
  unmeiAttentionPaidGrantedKey,
} from "@/lib/unmei-attention";

export function UnmeiAttentionOnPaid({ ownerToken }: { ownerToken: string }) {
  useEffect(() => {
    try {
      const grantedKey = unmeiAttentionPaidGrantedKey(ownerToken);
      if (localStorage.getItem(grantedKey) === "1") return;
      localStorage.setItem(grantedKey, "1");
      localStorage.setItem(UNMEI_ATTENTION_PENDING_KEY, ownerToken);
      localStorage.removeItem(unmeiAttentionImpressionKey(ownerToken));
    } catch {
      // localStorage 不可環境ではバッジなし (実害なし)
    }
  }, [ownerToken]);
  return null;
}
