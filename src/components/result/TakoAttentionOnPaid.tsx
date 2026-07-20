"use client";

// 課金 (full_access) 済みの /me を表示したとき、下部ナビ「友達診断」の
// 赤バッジ (TAKO_ATTENTION_PENDING) を1回だけ付与する。
// 2026-07-20 変更: 旧仕様は自己診断完了時に全員へ付与していたが、
// 「自己診断の課金まで終わった人」だけに出す (親 /me が paid のときだけマウントする)。
// 付与は ownerToken ごとに1回 (granted マーカー)。/tako を見たら
// TakoViewTracker が pending を消す (従来どおり)。

import { useEffect } from "react";
import {
  TAKO_ATTENTION_PENDING_KEY,
  takoAttentionImpressionKey,
  takoAttentionPaidGrantedKey,
} from "@/lib/tako-attention";

export function TakoAttentionOnPaid({ ownerToken }: { ownerToken: string }) {
  useEffect(() => {
    try {
      const grantedKey = takoAttentionPaidGrantedKey(ownerToken);
      if (localStorage.getItem(grantedKey) === "1") return;
      localStorage.setItem(grantedKey, "1");
      localStorage.setItem(TAKO_ATTENTION_PENDING_KEY, ownerToken);
      localStorage.removeItem(takoAttentionImpressionKey(ownerToken));
    } catch {
      // localStorage 不可環境ではバッジなし (実害なし)
    }
  }, [ownerToken]);
  return null;
}
