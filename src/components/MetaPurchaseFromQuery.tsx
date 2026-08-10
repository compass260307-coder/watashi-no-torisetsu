"use client";

// 静的ページの決済着地 (?paid=1&session_id=) 用の Meta Purchase 計測。
//
// サーバレンダリングで claim token を埋め込めないページ (/aisho) から使う。
// claim token を /api/checkout/meta-purchase-token で取得し、あとは通常の
// MetaPurchaseDataLayer (DB 一意クレーム → dataLayer push) に委ねる。
// useSearchParams を使うため、<Suspense> 配下でマウントすること。

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import {
  isCheckoutSessionId,
  wasAnyMetaPurchaseSent,
  type MetaPurchaseProduct,
} from "@/lib/meta-purchase";

type TokenResponse = {
  checkoutSessionId?: string;
  product?: MetaPurchaseProduct;
  claimToken?: string;
};

export function MetaPurchaseFromQuery() {
  const searchParams = useSearchParams();
  const paid = searchParams.get("paid") === "1";
  const sessionId = searchParams.get("session_id") ?? "";

  const [claim, setClaim] = useState<{
    product: MetaPurchaseProduct;
    claimToken: string;
  } | null>(null);

  useEffect(() => {
    if (!paid || !isCheckoutSessionId(sessionId)) return;
    // 送信済み (どの商品でも) なら token 取得の API を打たない (再訪・リロード対策)。
    if (wasAnyMetaPurchaseSent(sessionId)) return;

    void fetch("/api/checkout/meta-purchase-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkout_session_id: sessionId }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as TokenResponse;
      })
      .then((data) => {
        if (
          !data ||
          data.checkoutSessionId !== sessionId ||
          typeof data.claimToken !== "string" ||
          typeof data.product !== "string"
        ) {
          return;
        }
        setClaim({ product: data.product, claimToken: data.claimToken });
      })
      .catch(() => {
        // 計測失敗でページ表示は止めない。未クレームなら再訪時に再試行される。
      });
  }, [paid, sessionId]);

  if (!claim) return null;
  return (
    <MetaPurchaseDataLayer
      checkoutSessionId={sessionId}
      product={claim.product}
      claimToken={claim.claimToken}
    />
  );
}
