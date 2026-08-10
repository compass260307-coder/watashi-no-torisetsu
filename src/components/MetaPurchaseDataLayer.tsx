"use client";

import { useEffect } from "react";

import {
  metaPurchaseStorageKey,
  type MetaPurchaseProduct,
} from "@/lib/meta-purchase";

type ClaimResponse = {
  shouldPush?: boolean;
  checkoutSessionId?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
};

function wasSent(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberSent(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // DB の一意クレームが主の重複防止なので、ストレージ不可でも継続する。
  }
}

export function MetaPurchaseDataLayer({
  checkoutSessionId,
  product,
  claimToken,
}: {
  checkoutSessionId: string;
  product: MetaPurchaseProduct;
  claimToken: string;
}) {
  useEffect(() => {
    const key = metaPurchaseStorageKey(product, checkoutSessionId);
    if (wasSent(key)) return;

    void fetch("/api/checkout/meta-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkout_session_id: checkoutSessionId,
        claim_token: claimToken,
      }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ClaimResponse;
      })
      .then((claim) => {
        if (!claim) return;

        // サーバーが既に同じ Session を処理済みなら、このブラウザでも
        // 再確認しないよう記憶する。
        if (!claim.shouldPush) {
          rememberSent(key);
          return;
        }
        if (claim.checkoutSessionId !== checkoutSessionId || wasSent(key)) {
          return;
        }

        // React Strict Mode や同時マウントでも二重 push しないよう、
        // dataLayer より先にローカルの送信済みフラグを立てる。
        rememberSent(key);
        const target = window as typeof window & {
          dataLayer?: Array<Record<string, unknown>>;
        };
        target.dataLayer = target.dataLayer ?? [];
        target.dataLayer.push({
          event: "meta_purchase",
          event_id: checkoutSessionId,
          checkout_session_id: checkoutSessionId,
          ...(typeof claim.value === "number" ? { value: claim.value } : {}),
          ...(typeof claim.currency === "string"
            ? { currency: claim.currency }
            : {}),
          ...(Array.isArray(claim.contentIds) && claim.contentIds.length > 0
            ? { content_ids: claim.contentIds }
            : {}),
          ...(typeof claim.contentName === "string"
            ? { content_name: claim.contentName }
            : {}),
        });
      })
      .catch(() => {
        // 計測失敗で購入完了 UX を止めない。未クレームなら再訪時に再試行される。
      });
  }, [checkoutSessionId, product, claimToken]);

  return null;
}
