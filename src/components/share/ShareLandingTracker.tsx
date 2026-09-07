"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

const DIAGNOSIS_PATH = /^\/(?:ko\/)?diagnosis\/?$/;

/** `/share/[code]` の有効なキャラクター共有ページへの到達を記録する。 */
export function ShareLandingTracker({
  inviteCode,
  channel,
}: {
  inviteCode: string;
  channel?: string;
}) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("share_landing_viewed", {
      inviteCode,
      metadata: {
        kind: "character",
        channel: channel || "unknown",
      },
    });
  }, [channel, inviteCode]);

  // /share には専用CTA以外にも、共通ヘッダー/フッターの
  // 「性格診断テスト」リンクがある。そこから進むと旧実装では
  // CTA 0人 → 診断開始 N人となっていたため、この着地ページ内の
  // すべての自己診断遷移を捕捉する。専用CTAは各コンポーネントが
  // source 付きで計測するので、data 属性で二重発火を避ける。
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.dataset.shareDiagnosisTracked === "true") return;

      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        !DIAGNOSIS_PATH.test(destination.pathname)
      ) {
        return;
      }

      const source = link.closest("header")
        ? "global_header"
        : link.closest("footer")
          ? "global_footer"
          : "share_navigation";
      track("share_to_diagnosis_clicked", {
        inviteCode,
        metadata: { kind: "character", source },
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [inviteCode]);

  return null;
}
