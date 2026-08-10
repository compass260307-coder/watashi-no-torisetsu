"use client";

// 評価送信後ページ (FriendIndividualGuide) を見た「まだ自己診断していない人」へ、
// 下部ナビ「自己診断」の赤バッジ (ME_ATTENTION_PENDING) を付与する。
// 「友達のために回答した → 次は自分の番」という文脈がある訪問者だけに出す
// (未診断者全員に出すとただの広告になり、バッジの信頼性が下がる 2026-08-04 指示)。
// 診断済み (owner_token あり) には付与しない。解除は BottomNav 側
// (タブタップ / /diagnosis 到達 / 診断完了) が担う。

import { useEffect } from "react";
import { ME_ATTENTION_PENDING_KEY } from "@/lib/me-attention";

export function MeAttentionOnGuide() {
  useEffect(() => {
    try {
      if (localStorage.getItem("torisetsu_owner_token")) return;
      localStorage.setItem(ME_ATTENTION_PENDING_KEY, "1");
    } catch {
      // localStorage 不可環境ではバッジなし (実害なし)
    }
  }, []);
  return null;
}
