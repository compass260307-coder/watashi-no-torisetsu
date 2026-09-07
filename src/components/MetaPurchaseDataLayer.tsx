"use client";

import { useEffect } from "react";

import {
  metaPurchaseStorageKey,
  tiktokPurchaseStorageKey,
  type MetaPurchaseProduct,
} from "@/lib/meta-purchase";

type ClaimResponse = {
  checkoutSessionId?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
};

// Strict Mode のeffect再実行や同一ページ内の複数マウントが、prepare完了前に
// 同じイベントを二重pushするのを防ぐ。
const pendingPurchases = new Set<string>();

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
    // ストレージ不可でも広告側の event_id 重複排除を使えるため継続する。
  }
}

type PurchaseTarget = typeof window & {
  dataLayer?: Array<Record<string, unknown>>;
  ttq?: {
    track?: (
      event: string,
      properties: Record<string, unknown>,
      options: Record<string, unknown>,
    ) => void;
  };
};

async function waitForTikTok(target: PurchaseTarget): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt++) {
    if (typeof target.ttq?.track === "function") return true;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
  }
  return typeof target.ttq?.track === "function";
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
    const metaKey = metaPurchaseStorageKey(product, checkoutSessionId);
    const tiktokKey = tiktokPurchaseStorageKey(product, checkoutSessionId);
    const pendingKey = `${product}:${checkoutSessionId}`;
    if (
      (wasSent(metaKey) && wasSent(tiktokKey)) ||
      pendingPurchases.has(pendingKey)
    ) {
      return;
    }
    pendingPurchases.add(pendingKey);

    void fetch("/api/checkout/meta-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkout_session_id: checkoutSessionId,
        claim_token: claimToken,
        action: "prepare",
      }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ClaimResponse;
      })
      .then(async (claim) => {
        if (!claim) return;
        if (claim.checkoutSessionId !== checkoutSessionId) return;

        const target = window as PurchaseTarget;
        let metaPushed = false;
        if (!wasSent(metaKey)) {
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
          metaPushed = true;
        }

        let tiktokPushed = false;
        if (!wasSent(tiktokKey) && (await waitForTikTok(target))) {
          target.ttq?.track?.(
            "Purchase",
            {
              ...(typeof claim.value === "number"
                ? { value: claim.value }
                : {}),
              ...(typeof claim.currency === "string"
                ? { currency: claim.currency }
                : {}),
              ...(Array.isArray(claim.contentIds) &&
              claim.contentIds.length > 0
                ? {
                    content_type: "product",
                    content_ids: claim.contentIds,
                    contents: claim.contentIds.map((contentId) => ({
                      content_id: contentId,
                      content_type: "product",
                      quantity: 1,
                      ...(typeof claim.value === "number"
                        ? { price: claim.value }
                        : {}),
                    })),
                  }
                : {}),
              ...(typeof claim.contentName === "string"
                ? { description: claim.contentName }
                : {}),
            },
            { event_id: checkoutSessionId },
          );
          tiktokPushed = true;
        }
        if (!metaPushed && !tiktokPushed) return;
        // push が同期的に成功した後、サーバー監査まで保存できた時点でだけ
        // ローカルの再送を止める。ack前にタブが閉じた場合は次回もう一度pushするが、
        // 同じevent_idなので媒体側で重複排除され、監査行も回復する。
        return fetch("/api/checkout/meta-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkout_session_id: checkoutSessionId,
            claim_token: claimToken,
            action: "ack",
            tiktok_pushed: tiktokPushed,
          }),
        })
          .then((response) => {
            if (!response.ok) return;
            if (metaPushed) rememberSent(metaKey);
            if (tiktokPushed) rememberSent(tiktokKey);
          })
          .catch(() => {
            // dataLayerへの受け渡しは完了済み。再訪時に同じevent_idで監査を回復する。
          });
      })
      .catch(() => {
        // 計測失敗で購入完了 UX を止めない。未送信なら再訪時に再試行される。
      })
      .finally(() => {
        pendingPurchases.delete(pendingKey);
      });
  }, [checkoutSessionId, product, claimToken]);

  return null;
}
