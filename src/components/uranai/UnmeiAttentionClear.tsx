"use client";

// /unmei を表示したら下部ナビ「運命」の赤バッジ (UNMEI_ATTENTION_PENDING) を
// 解除する (一度きり・再表示なし)。友達診断の TakoViewTracker と同じ役割。
// /unmei はどの状態 (ティーザー/入力/生成中/鑑定) でも「見た」扱いにするため
// layout.tsx にマウントする。

import { useEffect } from "react";
import { UNMEI_ATTENTION_PENDING_KEY } from "@/lib/unmei-attention";

export function UnmeiAttentionClear() {
  useEffect(() => {
    try {
      localStorage.removeItem(UNMEI_ATTENTION_PENDING_KEY);
    } catch {
      // localStorage 不可環境は何もしない
    }
  }, []);
  return null;
}
