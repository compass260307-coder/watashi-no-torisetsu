"use client";

// 友達診断 (/tako) の解放購入ボタン (tako_unlock)。
// POST /api/checkout/create-tako-unlock-session → Stripe Checkout へ遷移。
// 価格はサーバ側で決定される (このコンポーネントは表示だけ)。

import { useState } from "react";

export function TakoUnlockButton({
  ownerToken,
  label = "今すぐロックを解除",
}: {
  ownerToken: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/create-tako-unlock-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        code?: string;
      };
      if (res.status === 409 && json.code === "already_unlocked") {
        // 既に解放済み (別タブで購入完了など) → リロードで解放状態を反映
        window.location.reload();
        return;
      }
      if (!res.ok || !json.url) {
        setError("決済ページを開けませんでした。少し待ってもう一度どうぞ。");
        setLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("決済ページを開けませんでした。少し待ってもう一度どうぞ。");
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4] disabled:opacity-60"
      >
        {loading ? "決済ページへ移動中…" : label}
      </button>
      {error && (
        <p className="mt-2 text-[11px] font-bold text-[#F25E62]">{error}</p>
      )}
    </div>
  );
}
