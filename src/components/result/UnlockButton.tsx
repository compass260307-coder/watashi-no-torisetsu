"use client";

// Phase 1.5-α Day 12-Polish-G: ¥500 解除ボタン (共通の決済トリガー)
//
// 旧 UnlockCta の決済ロジックをそのまま移植し、メイン解除カード (UnlockCard) と
// インライン・ロック (InlineLockCard) の両方から再利用する共通ボタン。
// 見た目は variant で出し分けるだけで、決済フロー・エンドポイント・二重 unlock
// ハンドリング・遷移先はすべて従来 (Day 12-C2) と同一。
//
// フロー (不変):
//   1. クリック → POST /api/checkout/create-perception-unlock-session { perceptionId }
//   2. 成功時: 返却された Stripe Checkout URL に遷移
//   3. 409 already_unlocked: メッセージ + reload で Server 側 isPerceptionUnlocked() 再判定
//   4. 他エラー: メッセージ表示、再試行可能
//
// 触らない: 決済・Stripe・unlock ロジック・エンドポイント・価格 (¥500)。

import { useState } from "react";

type UnlockButtonVariant = "main" | "inline";

interface UnlockButtonProps {
  perceptionId: string;
  label: string;
  variant?: UnlockButtonVariant;
}

const VARIANT_CLASS: Record<UnlockButtonVariant, string> = {
  // sunYellow 標準ボタン (大)
  main: "bg-[#FFE993] text-[#3A2D6B] font-black text-base px-10 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all disabled:opacity-50 disabled:cursor-wait",
  // sunYellow 小 (インライン・ロック用)
  inline:
    "bg-[#FFE993] text-[#3A2D6B] font-black text-xs px-5 py-2 rounded-full border-2 border-[#3A2D6B] shadow-[0_3px_0_#3A2D6B] active:translate-y-0.5 active:shadow-[0_1px_0_#3A2D6B] transition-all disabled:opacity-50 disabled:cursor-wait",
};

export function UnlockButton({
  perceptionId,
  label,
  variant = "main",
}: UnlockButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        "/api/checkout/create-perception-unlock-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perceptionId }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: string;
        code?: string;
      } | null;

      if (res.status === 409 && data?.code === "already_unlocked") {
        setError("既に解除済です。ページを再読み込みします…");
        window.setTimeout(() => window.location.reload(), 1200);
        return;
      }

      if (!res.ok || !data?.url) {
        setError(
          data?.error ?? "決済画面の起動に失敗しました。再度お試しください。",
        );
        return;
      }

      // Stripe Checkout の hosted page へ遷移 (ブラウザ離脱)
      window.location.href = data.url;
    } catch {
      setError("通信エラーが発生しました。再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  const loadingLabel = variant === "main" ? "決済画面へ移動中…" : "移動中…";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={VARIANT_CLASS[variant]}
      >
        {loading ? loadingLabel : label}
      </button>
      {error && (
        <p role="alert" className="text-[#FE3C72] text-xs font-bold mt-3">
          {error}
        </p>
      )}
    </>
  );
}
