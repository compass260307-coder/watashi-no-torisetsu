"use client";

// /unmei のプレミアム決済ゲート。
// 既存CTAとの互換性を保つため CustomEvent 名は "unmei-chat-launch" のままにし、
// 開く内容だけを入力チャットからプレミアム専用課金カードへ切り替える。
// 決済後は /unmei?checkout=success へ戻り、出生情報が未入力なら案内人の質問へ進む。

import { useCallback, useEffect, useRef, useState } from "react";
import { PaywallOverlay } from "@/components/result/PaywallModal";
import type { ResultLocale } from "@/i18n/result";

const UNMEI_PREMIUM_PRODUCTS = ["premium_bundle"] as const;

type Props = {
  purchase: {
    ownerToken: string | null;
    product: "premium_bundle";
  };
  children: React.ReactNode;
  locale?: ResultLocale;
};

export default function UnmeiChatCheckoutGate({
  purchase,
  children,
  locale = "ja",
}: Props) {
  const [open, setOpen] = useState(false);
  const [modalOwnerToken, setModalOwnerToken] = useState<string | null>(
    purchase.ownerToken,
  );
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    previouslyFocusedRef.current?.focus();
  }, []);

  useEffect(() => {
    const onLaunch = (event: Event) => {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const detail = (event as CustomEvent<{ ownerToken?: unknown }>).detail;
      setModalOwnerToken(
        typeof detail?.ownerToken === "string"
          ? detail.ownerToken
          : purchase.ownerToken,
      );
      setOpen(true);
    };
    window.addEventListener("unmei-chat-launch", onLaunch);
    return () => window.removeEventListener("unmei-chat-launch", onLaunch);
  }, [purchase.ownerToken]);

  return (
    <>
      {/* LP はマウントしたまま背面に残し、閉じたときの位置を維持する。 */}
      <div>{children}</div>

      {open ? (
        <PaywallOverlay
          ownerToken={modalOwnerToken ?? undefined}
          locale={locale}
          returnTo="unmei"
          products={UNMEI_PREMIUM_PRODUCTS}
          legacyPlanStyle
          ctaSource="unmei_hero"
          onClose={close}
        />
      ) : null}
    </>
  );
}
