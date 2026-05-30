"use client";

// Phase 1.5-α Day 12-C2: 評価 1 件ごとの ¥500 ロック解除ボタン
//
// 親 (/evaluate/result/[perceptionId]/page.tsx) は Server Component のため、
// fetch + state を伴うこのボタンを Client に切り出す。
//
// フロー:
//   1. クリック → POST /api/checkout/create-perception-unlock-session { perceptionId }
//   2. 成功時: 返却された Stripe Checkout URL に遷移
//   3. 二重 unlock (409 already_unlocked): エラーメッセージ表示 + 同ページ reload で
//      Server 側の isPerceptionUnlocked() 再判定により解除済表示に切り替わる
//   4. 他のエラー: メッセージ表示、再試行可能
//
// 触らない:
//   - 既存 /api/checkout/create-session (真のトリセツ経路、本 PR 影響なし)
//   - /checkout/success ページ (本 PR では perception_id クエリ付きで戻すだけ)

import { useState } from "react";

interface UnlockCtaProps {
  perceptionId: string;
}

export function UnlockCta({ perceptionId }: UnlockCtaProps) {
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
        // 再読み込みで Server が isPerceptionUnlocked() を再評価 → 解除済表示へ
        window.setTimeout(() => window.location.reload(), 1200);
        return;
      }

      if (!res.ok || !data?.url) {
        setError(data?.error ?? "決済画面の起動に失敗しました。再度お試しください。");
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

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black text-base px-10 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? "決済画面へ移動中…" : "¥500 で今すぐ解除"}
      </button>
      {error && (
        <p
          role="alert"
          className="text-[#FE3C72] text-xs font-bold mt-3"
        >
          {error}
        </p>
      )}
    </div>
  );
}
