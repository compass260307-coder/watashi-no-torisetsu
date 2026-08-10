"use client";

// チャット内の Embedded Checkout (2026-08-06)。ページ離脱なしで /unmei の決済を完結する。
// create-unmei-session を ui_mode:'embedded' で叩いて client_secret を取得し、
// Stripe の Embedded Checkout をチャットのカードにマウントする。
// 決済完了 (onComplete) は Stripe が検知 → 親へ通知。実際の解放・鑑定生成は webhook 側。
//
// publishable key 未設定やセッション作成失敗時はエラー表示 + リトライ (購入導線を黙って
// 止めない)。この component は購入フロー (UnmeiPurchaseFlow) からのみ使う。

import { useCallback, useRef, useState } from "react";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { getStripeClient } from "@/lib/stripe-client";
import { track } from "@/lib/track";

type Product = "unmei" | "unmei_upgrade";

export default function UnmeiEmbeddedCheckout({
  product,
  ownerToken,
  onComplete,
}: {
  product: Product;
  ownerToken: string | null;
  onComplete: () => void;
}) {
  const stripePromise = getStripeClient();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // リトライで Provider を作り直す key
  const [paypayLoading, setPaypayLoading] = useState(false);
  const [paypayError, setPaypayError] = useState(false);
  const completedRef = useRef(false);

  // Stripe に渡す client_secret の取得関数。Provider が呼ぶ。
  // 失敗時は自前の fallback (リトライ) に切り替えてから再throw する。
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    try {
      const res = await fetch("/api/checkout/create-unmei-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ui_mode: "embedded",
          product,
          ...(ownerToken ? { owner_token: ownerToken } : {}),
        }),
      });
      if (!res.ok) throw new Error(`checkout session failed: ${res.status}`);
      const data = (await res.json()) as { clientSecret?: string };
      if (!data.clientSecret) throw new Error("no client secret");
      return data.clientSecret;
    } catch (e) {
      setFailed(true);
      throw e;
    }
  }, [product, ownerToken]);

  // PayPay は embedded_page が非対応のため、専用のリダイレクト決済 (ホスト画面) へ飛ばす。
  // card/Link は上の Embedded Checkout のまま。完了処理は webhook + success_url 側で共通。
  const handlePaypay = useCallback(async () => {
    if (paypayLoading) return;
    setPaypayLoading(true);
    setPaypayError(false);
    const metadata = { page: "unmei", product, method: "paypay" };
    track("purchase_cta_clicked", { ownerToken: ownerToken ?? null, metadata });
    track("unmei_purchase_start", { ownerToken: ownerToken ?? null, metadata });
    try {
      const res = await fetch("/api/checkout/create-unmei-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method: "paypay",
          product,
          ...(ownerToken ? { owner_token: ownerToken } : {}),
        }),
      });
      if (!res.ok) throw new Error(`paypay session failed: ${res.status}`);
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("no url");
      window.location.href = data.url;
    } catch {
      // 失敗しても card 埋め込みは生きているので、軽いエラー表示に留める。
      setPaypayError(true);
      setPaypayLoading(false);
    }
  }, [ownerToken, product, paypayLoading]);

  // PayPay ボタン (埋め込み成功時は下に併置 / 失敗時は代替導線として単独表示)。
  const paypayButton = (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={handlePaypay}
        disabled={paypayLoading}
        className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[#E30613] bg-white py-3 text-[14px] font-black text-[#E30613] transition-colors hover:bg-[#FFF4F4] disabled:opacity-60"
      >
        {paypayLoading ? "PayPayをひらいています…" : "PayPay で払う"}
      </button>
      {paypayError ? (
        <p className="mt-2 text-center text-[13px] font-bold text-[#E5544B]">
          PayPay をひらけませんでした。もう一度お試しください。
        </p>
      ) : null}
    </div>
  );

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    track("unmei_purchase_complete_embedded", {
      ownerToken: ownerToken ?? null,
      metadata: { page: "unmei", product, ui: "chat_embedded" },
    });
    onComplete();
  }, [onComplete, ownerToken, product]);

  // publishable key 未設定 or セッション作成失敗
  if (!stripePromise || failed) {
    return (
      <div className="rounded-2xl border border-[#E9E9F2] bg-white p-4 text-center">
        <p className="text-[14px] font-bold text-[#2E2E5C]">
          決済画面をひらけませんでした。
        </p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
          className="mt-3 rounded-full bg-[#5B5BEF] px-6 py-2.5 text-[14px] font-bold text-white"
        >
          もう一度ためす
        </button>
        {/* card 埋め込みが開けなくても PayPay は使えるので代替導線として出す */}
        {paypayButton}
      </div>
    );
  }

  return (
    <div>
      {/* PayPay は決済フォームが長く下に埋もれるため上に置く (express 決済の定石)。
          embedded_page が PayPay 非対応なので、ここだけホスト画面へ遷移する。
          カード / Apple Pay / Link は下の Embedded Checkout がそのまま扱う。 */}
      {paypayButton}
      <div className="my-3 flex items-center gap-3">
        <span className="h-px flex-1 bg-[#E9E9F2]" />
        <span className="text-[12px] font-bold text-[#9A9AB5]">または</span>
        <span className="h-px flex-1 bg-[#E9E9F2]" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#E9E9F2] bg-white p-1.5 shadow-[0_1px_2px_rgba(46,46,92,0.06)]">
        <EmbeddedCheckoutProvider
          key={attempt}
          stripe={stripePromise}
          options={{ fetchClientSecret, onComplete: handleComplete }}
        >
          <EmbeddedCheckout className="min-h-[360px]" />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
