"use client";

import { useEffect } from "react";

const STORAGE_PREFIX = "wt_meta_purchase_sent_v1:";

type ClaimResponse = {
  shouldPush?: boolean;
  checkoutSessionId?: string;
  value?: number;
  currency?: string;
};

function storageKey(checkoutSessionId: string): string {
  return `${STORAGE_PREFIX}${checkoutSessionId}`;
}

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
  claimToken,
}: {
  checkoutSessionId: string;
  claimToken: string;
}) {
  useEffect(() => {
    const key = storageKey(checkoutSessionId);
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
        });
      })
      .catch(() => {
        // 計測失敗で購入完了 UX を止めない。未クレームなら再訪時に再試行される。
      });
  }, [checkoutSessionId, claimToken]);

  return null;
}
