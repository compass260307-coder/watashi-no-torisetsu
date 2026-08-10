"use client";

// 日本語 /me を表示したとき、下部ナビ「友達診断」の赤バッジ
// (TAKO_ATTENTION_PENDING) を ownerToken ごとに1回だけ付与する。
// /tako を見たら TakoViewTracker が pending を消す (従来どおり)。
//
// 経緯: 診断完了時の全員付与 (初期) → 課金完了後のみ (2026-07-20, 旧
// TakoAttentionOnPaid) → **診断完了者全員に再拡大 (2026-08-03)**。
// バイラル課題① (診断完了者の77%が /tako 未到達) の打ち手として、課金有無に
// かかわらず /me 閲覧者全員に1回出す。運命バッジ (UnmeiAttentionOnPaid) は
// 従来どおり課金者のみで変更しない。
// ※ granted マーカーのキー名は旧仕様の "paid_granted" のまま (互換のため。
//    課金者時代に付与済みの人へ二重付与しない)。

import { useEffect } from "react";
import {
  TAKO_ATTENTION_GRANTED_EVENT,
  TAKO_ATTENTION_PENDING_KEY,
  takoAttentionImpressionKey,
  takoAttentionPaidGrantedKey,
} from "@/lib/tako-attention";

export function TakoAttentionOnResult({ ownerToken }: { ownerToken: string }) {
  useEffect(() => {
    try {
      const grantedKey = takoAttentionPaidGrantedKey(ownerToken);
      if (localStorage.getItem(grantedKey) === "1") return;
      localStorage.setItem(grantedKey, "1");
      localStorage.setItem(TAKO_ATTENTION_PENDING_KEY, ownerToken);
      localStorage.removeItem(takoAttentionImpressionKey(ownerToken));
      // BottomNav は pathname 変化でしか再評価しないため、/me 表示中の付与を
      // 同一ページ内で反映させる (loading.tsx コミット時の判定はここより先に走る)。
      window.dispatchEvent(new Event(TAKO_ATTENTION_GRANTED_EVENT));
    } catch {
      // localStorage 不可環境ではバッジなし (実害なし)
    }
  }, [ownerToken]);
  return null;
}
