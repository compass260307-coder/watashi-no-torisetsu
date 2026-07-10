"use client";

// ¥299 買い切り「フルアクセス(全解放)」の課金導線ボタン。
// クリックで /api/checkout/create-full-access-session を叩き、返ってきた Stripe Checkout
// URL へ遷移する。金額・price はサーバ側 (Price 固定) で決まり、ここからは一切渡さない。
//
// PR2 (サーバゲート) 時点の最小実装。見た目の作り込みは PR3。
// ローディング / エラー表示を持つ (CLAUDE.md: エラー・ローディング・空状態を用意)。
// 既に full の場合 (409 already_full) はページを再読込して本文表示へ戻す。

import { useState } from "react";

export function FullAccessCta({
  children = "¥299で全部よむ",
}: {
  children?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/create-full-access-session", {
        method: "POST",
      });
      // 既に課金済み → 本文が見られる状態なので再読込。
      if (res.status === 409) {
        window.location.reload();
        return;
      }
      if (!res.ok) {
        setError("うまく開けませんでした。少し待ってからもう一度お試しください。");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("うまく開けませんでした。少し待ってからもう一度お試しください。");
      setLoading(false);
    } catch {
      setError("通信に失敗しました。電波のいい場所でもう一度お試しください。");
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex items-center justify-center w-full bg-[#2E2E5C] text-white font-black text-base px-6 py-3.5 rounded-full shadow-[0_4px_0_#1b1b3e] hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-[0_0_0_#1b1b3e] transition-all disabled:opacity-60 disabled:pointer-events-none"
      >
        {loading ? "ひらいています…" : children}
      </button>
      {error && (
        <p className="mt-3 text-center text-[13px] font-bold text-[#E5544B]">
          {error}
        </p>
      )}
    </div>
  );
}
