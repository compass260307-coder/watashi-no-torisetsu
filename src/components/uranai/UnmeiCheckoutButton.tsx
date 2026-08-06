"use client";

import { useState } from "react";
import { track } from "@/lib/track";

export default function UnmeiCheckoutButton({
  ownerToken,
  product = "unmei",
  children = "運命の設計図を占う",
  launchChat = false,
}: {
  ownerToken?: string | null;
  /** unmei=¥1,980 / unmei_upgrade=¥1,480 (完全版保有者のみ。サーバ側で hasFullAccess を検証)。 */
  product?: "unmei" | "unmei_upgrade";
  children?: React.ReactNode;
  /**
   * true = Stripe リダイレクトの代わりに CustomEvent("unmei-chat-launch") を発火し、
   * 親の UnmeiChatCheckoutGate が全画面チャット決済を立ち上げる (チャット決済フロー)。
   * false = 従来のリダイレクト型 Checkout。
   */
  launchChat?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;

    const metadata = { page: "unmei", product };

    // チャット起動モード: 遷移せず親ゲートへ合図するだけ (即時)。
    if (launchChat) {
      track("purchase_cta_clicked", {
        ownerToken: ownerToken ?? null,
        metadata: { ...metadata, ui: "chat_launch" },
      });
      window.dispatchEvent(new CustomEvent("unmei-chat-launch"));
      return;
    }

    setLoading(true);
    setError(null);

    track("purchase_cta_clicked", {
      ownerToken: ownerToken ?? null,
      metadata,
    });
    track("unmei_purchase_start", {
      ownerToken: ownerToken ?? null,
      metadata,
    });

    try {
      const res = await fetch("/api/checkout/create-unmei-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          ownerToken ? { owner_token: ownerToken, product } : { product },
        ),
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
    // SP はボタン全幅 (16P 参考)。PC は auto 幅で保証テキストと横並び
    <div className="w-full md:w-auto">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        // サイト共通のインディゴCTA (LP のアクセント色をインディゴ1色に統一。2026-07-26 指示)
        className="inline-flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-9 py-4 text-[15px] font-black text-white shadow-[0_3px_10px_rgba(91,91,239,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_14px_rgba(91,91,239,0.4)] disabled:opacity-60 md:w-auto md:text-[16px]"
      >
        {loading ? "ひらいています…" : error ? "もう一度ためす →" : children}
      </button>
      {error ? <p className="mt-3 text-sm font-bold text-[#E5544B]">{error}</p> : null}
    </div>
  );
}
