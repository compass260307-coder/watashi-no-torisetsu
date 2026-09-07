"use client";

// /unmei のチャット決済ゲート。
// LP の「設計図を作成する」から、出生情報チャット → 対象商品の購入へ進む。
// LP は未課金でも閲覧でき、購入済みユーザーの鑑定表示はサーバ側の分岐を維持する。

import { useEffect, useState } from "react";
import UnmeiClient from "@/components/uranai/UnmeiClient";
import type { ResultLocale } from "@/i18n/result";

type Props = {
  purchase: {
    ownerToken: string | null;
    product: "full_access" | "premium_bundle";
  };
  children: React.ReactNode;
  locale?: ResultLocale;
  /** devプレビューでは保存・計測・決済を実行しない。 */
  previewMode?: boolean;
};

export default function UnmeiChatCheckoutGate({
  purchase,
  children,
  locale = "ja",
  previewMode = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [chatOwnerToken, setChatOwnerToken] = useState<string | null>(
    purchase.ownerToken,
  );
  const [chatProduct, setChatProduct] = useState(purchase.product);

  useEffect(() => {
    const onLaunch = (event: Event) => {
      const detail = (
        event as CustomEvent<{ ownerToken?: unknown; product?: unknown }>
      ).detail;
      setChatOwnerToken(
        typeof detail?.ownerToken === "string"
          ? detail.ownerToken
          : purchase.ownerToken,
      );
      setChatProduct(
        detail?.product === "full_access" ||
          detail?.product === "premium_bundle"
          ? detail.product
          : purchase.product,
      );
      setOpen(true);
    };
    window.addEventListener("unmei-chat-launch", onLaunch);
    return () => window.removeEventListener("unmei-chat-launch", onLaunch);
  }, [purchase.ownerToken, purchase.product]);

  // LP の途中でCTAを押しても、チャットは先頭から始める。
  useEffect(() => {
    if (open) window.scrollTo({ top: 0, behavior: "auto" });
  }, [open]);

  return (
    <>
      {/* LP はマウントしたまま隠し、LP閲覧イベントの二重送信を防ぐ。 */}
      <div className={open ? "hidden" : undefined}>{children}</div>

      {open ? (
        <UnmeiClient
          initialState="no_birth"
          purchase={{ ownerToken: chatOwnerToken, product: chatProduct }}
          locale={locale}
          previewMode={previewMode}
        />
      ) : null}
    </>
  );
}
