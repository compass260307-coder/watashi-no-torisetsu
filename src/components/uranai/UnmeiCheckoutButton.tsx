"use client";

import { useState } from "react";
import type { ResultLocale } from "@/i18n/result";
import { track } from "@/lib/track";

const BUTTON_COPY = {
  ja: {
    defaultLabel: "運命の設計図を占う",
    loading: "ひらいています…",
    retry: "もう一度ためす →",
    openError: "うまく開けませんでした。少し待ってからもう一度お試しください。",
    networkError: "通信に失敗しました。電波のいい場所でもう一度お試しください。",
  },
  ko: {
    defaultLabel: "운명의 설계도 보기",
    loading: "불러오는 중…",
    retry: "다시 시도하기 →",
    openError: "결제 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.",
    networkError: "통신에 실패했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
  },
} as const;

export default function UnmeiCheckoutButton({
  ownerToken,
  children,
  launchChat = false,
  tone = "indigo",
  locale = "ja",
}: {
  ownerToken?: string | null;
  children?: React.ReactNode;
  /**
   * true = Stripe リダイレクトの代わりに CustomEvent("unmei-chat-launch") を発火し、
   * 親の UnmeiChatCheckoutGate が全画面チャット決済を立ち上げる (チャット決済フロー)。
   * false = 従来のリダイレクト型 Checkout。
   */
  launchChat?: boolean;
  /** premium は運命の設計図LPのゴールド、indigo は既存画面用。 */
  tone?: "indigo" | "premium";
  locale?: ResultLocale;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = BUTTON_COPY[locale];

  async function handleClick() {
    if (loading) return;

    const metadata = { page: "unmei", product: "premium_bundle", locale };

    // チャット起動モード: 遷移せず親ゲートへ合図するだけ (即時)。
    if (launchChat) {
      track("purchase_cta_clicked", {
        ownerToken: ownerToken ?? null,
        metadata: { ...metadata, ui: "chat_launch" },
      });
      window.dispatchEvent(
        new CustomEvent("unmei-chat-launch", {
          detail: { ownerToken: ownerToken ?? null },
        }),
      );
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
      const res = await fetch("/api/checkout/create-full-access-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_token: ownerToken ?? undefined,
          product: "premium_bundle",
          return_to: "unmei",
          locale,
          paywall_source: "unmei_page",
          paywall_version: "three_course_v6_unmei_chat_credits",
          paywall_placement: "inline",
        }),
      });

      if (!res.ok) {
        setError(copy.openError);
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError(copy.openError);
      setLoading(false);
    } catch {
      setError(copy.networkError);
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
        className={`inline-flex w-full items-center justify-center rounded-full px-9 py-4 text-[15px] font-black text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 md:w-auto md:text-[16px] ${
          tone === "premium"
            ? "bg-[#A36818] shadow-[0_3px_10px_rgba(163,104,24,0.3)] hover:shadow-[0_5px_14px_rgba(163,104,24,0.38)]"
            : "bg-[#5B5BEF] shadow-[0_3px_10px_rgba(91,91,239,0.35)] hover:shadow-[0_5px_14px_rgba(91,91,239,0.4)]"
        }`}
      >
        {loading
          ? copy.loading
          : error
            ? copy.retry
            : (children ?? copy.defaultLabel)}
      </button>
      {error ? <p className="mt-3 text-sm font-bold text-[#E5544B]">{error}</p> : null}
    </div>
  );
}
