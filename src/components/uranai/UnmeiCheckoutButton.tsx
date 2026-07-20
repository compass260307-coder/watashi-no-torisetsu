"use client";

import { useState } from "react";
import { track } from "@/lib/track";

export default function UnmeiCheckoutButton({
  ownerToken,
  children = "運命の設計図を占う",
}: {
  ownerToken?: string | null;
  children?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);

    track("purchase_cta_clicked", {
      ownerToken: ownerToken ?? null,
      metadata: { page: "unmei" },
    });

    try {
      const res = await fetch("/api/checkout/create-unmei-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ownerToken ? { owner_token: ownerToken, product: "unmei" } : { product: "unmei" }),
      });

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
        className="inline-flex items-center justify-center rounded-full bg-[#F2B33D] px-5 py-3 font-black text-[#1A1A1A] disabled:opacity-60"
      >
        {loading ? "ひらいています…" : error ? "もう一度ためす →" : children}
      </button>
      {error ? <p className="mt-3 text-sm font-bold text-[#E5544B]">{error}</p> : null}
    </div>
  );
}
