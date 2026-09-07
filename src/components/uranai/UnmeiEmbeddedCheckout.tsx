"use client";

// 以前の運命チャットで使っていた決済形式を、現行の対象商品へ接続して再利用する。
// PayPayを上に置き、「または」の下にStripe Embedded Checkoutを表示する構成。

import { useCallback, useMemo, useRef, useState } from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import type { ResultLocale } from "@/i18n/result";
import { THREE_COURSE_PAYWALL_VERSION } from "@/lib/access-products";
import { getStripeClient } from "@/lib/stripe-client";
import { track } from "@/lib/track";

const CHECKOUT_COPY = {
  ja: {
    error: "決済画面をひらけませんでした。",
    retry: "もう一度ためす",
    preview: "ローカルプレビュー用の決済フォームです",
    email: "メールアドレス",
    card: "カード情報",
    pay: "安全に支払う",
    guarantee: "買い切り・30日間の返金保証つき",
    paypay: "PayPay で払う",
    paypayLoading: "PayPayをひらいています…",
    paypayError: "PayPay をひらけませんでした。もう一度お試しください。",
    or: "または",
  },
  ko: {
    error: "결제 양식을 불러오지 못했어요.",
    retry: "다시 시도하기",
    preview: "로컬 미리보기용 결제 양식입니다",
    email: "이메일 주소",
    card: "카드 정보",
    pay: "안전하게 결제하기",
    guarantee: "일회성 결제 · 30일 환불 보장",
    paypay: "PayPay로 결제하기",
    paypayLoading: "PayPay를 불러오는 중…",
    paypayError: "PayPay를 불러오지 못했어요. 다시 시도해 주세요.",
    or: "또는",
  },
} as const;

function PreviewCheckout({ locale }: { locale: ResultLocale }) {
  const copy = CHECKOUT_COPY[locale];

  return (
    <div className="p-3 sm:p-4">
      <p className="mb-4 rounded-xl bg-[#F5F3FA] px-3 py-2 text-center text-[11px] font-bold text-[#77738A]">
        {copy.preview}
      </p>
      <div className="space-y-3 text-left">
        <div className="text-[12px] font-bold text-[#4B4960]">
          {copy.email}
          <span className="mt-1.5 block h-11 rounded-lg border border-[#C9C7D1] bg-white" />
        </div>
        <div className="text-[12px] font-bold text-[#4B4960]">
          {copy.card}
          <span className="mt-1.5 block h-11 rounded-lg border border-[#C9C7D1] bg-white" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <span className="h-11 rounded-lg border border-[#C9C7D1] bg-white" />
          <span className="h-11 rounded-lg border border-[#C9C7D1] bg-white" />
        </div>
      </div>
      <button
        type="button"
        disabled
        className="mt-5 w-full rounded-xl bg-[#2E2E5C] py-3.5 text-[15px] font-black text-white opacity-80"
      >
        {copy.pay}
      </button>
      <p className="mt-2 text-center text-[11px] font-bold text-[#77738A]">
        {copy.guarantee}
      </p>
    </div>
  );
}

export default function UnmeiEmbeddedCheckout({
  ownerToken,
  product,
  onComplete,
  previewMode = false,
  locale = "ja",
}: {
  ownerToken: string | null;
  product: "full_access" | "premium_bundle";
  onComplete: () => void;
  previewMode?: boolean;
  locale?: ResultLocale;
}) {
  const copy = CHECKOUT_COPY[locale];
  const stripePromise = getStripeClient();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [paypayLoading, setPaypayLoading] = useState(false);
  const [paypayError, setPaypayError] = useState(false);
  const completedRef = useRef(false);

  const checkoutMetadata = useMemo(
    () => ({
      product,
      return_to: "unmei" as const,
      locale,
      paywall_source: "unmei_birth_chat",
      paywall_version: THREE_COURSE_PAYWALL_VERSION,
      paywall_placement: "inline" as const,
      ...(ownerToken ? { owner_token: ownerToken } : {}),
    }),
    [locale, ownerToken, product],
  );

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    try {
      const res = await fetch("/api/checkout/create-full-access-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutMetadata,
          ui_mode: "embedded",
        }),
      });
      if (!res.ok) throw new Error(`checkout session failed: ${res.status}`);
      const data = (await res.json()) as { clientSecret?: unknown };
      if (typeof data.clientSecret !== "string" || !data.clientSecret) {
        throw new Error("checkout client secret missing");
      }
      return data.clientSecret;
    } catch (error) {
      setFailed(true);
      throw error;
    }
  }, [checkoutMetadata]);

  // 旧形式と同じく、Embedded Checkout非対応のPayPayだけはStripe画面へ遷移する。
  const handlePaypay = useCallback(async () => {
    if (paypayLoading || previewMode) return;
    setPaypayLoading(true);
    setPaypayError(false);
    const metadata = {
      page: "unmei",
      product,
      source: "unmei_birth_chat",
      method: "paypay",
      locale,
    };
    track("purchase_cta_clicked", { ownerToken, metadata });
    track("unmei_purchase_start", { ownerToken, metadata });

    try {
      const res = await fetch("/api/checkout/create-full-access-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutMetadata,
          payment_method: "paypay",
        }),
      });
      if (!res.ok) throw new Error(`paypay session failed: ${res.status}`);
      const data = (await res.json()) as { url?: unknown };
      if (typeof data.url !== "string" || !data.url) {
        throw new Error("paypay checkout url missing");
      }
      window.location.href = data.url;
    } catch {
      setPaypayError(true);
      setPaypayLoading(false);
    }
  }, [checkoutMetadata, locale, ownerToken, paypayLoading, previewMode, product]);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    track("unmei_purchase_complete_embedded", {
      ownerToken,
      metadata: {
        page: "unmei",
        product,
        source: "unmei_birth_chat",
        ui: "chat_embedded",
        locale,
      },
    });
    onComplete();
  }, [locale, onComplete, ownerToken, product]);

  const paypayButton =
    locale === "ja" ? (
      <div className="mt-2.5">
        <button
          type="button"
          onClick={handlePaypay}
          disabled={paypayLoading || previewMode}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#E30613] bg-white py-3 text-[14px] font-black text-[#E30613] transition-colors hover:bg-[#FFF4F4] disabled:opacity-60"
        >
          {paypayLoading ? copy.paypayLoading : copy.paypay}
        </button>
        {paypayError ? (
          <p className="mt-2 text-center text-[13px] font-bold text-[#E5544B]">
            {copy.paypayError}
          </p>
        ) : null}
      </div>
    ) : null;

  if (!previewMode && (!stripePromise || failed)) {
    return (
      <div className="rounded-2xl border border-[#E9E9F2] bg-white p-4 text-center">
        <p className="text-[14px] font-bold text-[#2E2E5C]">{copy.error}</p>
        <button
          type="button"
          onClick={() => {
            completedRef.current = false;
            setFailed(false);
            setAttempt((current) => current + 1);
          }}
          className="mt-3 rounded-full bg-[#5B5BEF] px-6 py-2.5 text-[14px] font-bold text-white"
        >
          {copy.retry}
        </button>
        {paypayButton}
      </div>
    );
  }

  return (
    <div className="w-full">
      {paypayButton}
      {locale === "ja" ? (
        <div className="my-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#E9E9F2]" />
          <span className="text-[12px] font-bold text-[#9A9AB5]">{copy.or}</span>
          <span className="h-px flex-1 bg-[#E9E9F2]" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-[#E9E9F2] bg-white p-1.5 shadow-[0_1px_2px_rgba(46,46,92,0.06)]">
        {previewMode ? (
          <PreviewCheckout locale={locale} />
        ) : (
          <EmbeddedCheckoutProvider
            key={attempt}
            stripe={stripePromise}
            options={{ fetchClientSecret, onComplete: handleComplete }}
          >
            <EmbeddedCheckout className="min-h-[360px]" />
          </EmbeddedCheckoutProvider>
        )}
      </div>
    </div>
  );
}
