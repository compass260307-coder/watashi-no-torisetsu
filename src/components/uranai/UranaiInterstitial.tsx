"use client";

import React, { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";

type Props = {
  ownerToken?: string | null;
  ownerId?: string | null;
  typeName?: string | null;
  hasPaid?: boolean;
};

const STORAGE_KEY = "uranai_interstitial_shown";

function isoNow() {
  try {
    return new Date().toISOString();
  } catch {
    return String(Date.now());
  }
}

function CharacterPreview({ typeName }: { typeName?: string | null }) {
  const label = (typeName ?? "あなたのタイプ").trim() || "あなたのタイプ";
  const initial = label
    .split(/[\s　]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0))
    .join("")
    .slice(0, 2) || "?";

  return (
    <div className="flex flex-col items-center gap-4 rounded-[24px] border border-white/20 bg-white/10 p-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-white/30 bg-gradient-to-br from-[#F2B33D] via-[#E7DCFB] to-[#8B8FD3] text-2xl font-black text-[#1A1A1A] shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
        {initial}
      </div>
      <div className="text-center sm:text-left">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#D6D6E8]">
          キャラプレビュー
        </p>
        <p className="mt-1 text-lg font-black text-white">{label}</p>
        <p className="mt-1 text-sm text-[#D6D6E8]">
          まだ見ぬ一面を、運命の設計図と一緒に。
        </p>
      </div>
    </div>
  );
}

export default function UranaiInterstitial({
  ownerToken,
  ownerId,
  typeName,
  hasPaid,
}: Props) {
  const debugMode = process.env.NEXT_PUBLIC_URANAI_DEBUG === "true";
  const [visible, setVisible] = useState(false);
  const [disabled, setDisabled] = useState(() => {
    if (typeof window === "undefined") return false;
    if (process.env.NEXT_PUBLIC_URANAI_DEBUG === "true") return false;
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  });
  const stopTimerRef = useRef<number | null>(null);
  // In debug mode, skip the purchased-user (hasPaid / hasFullAccess) exclusion
  // so the interstitial always shows. Production behavior is unchanged because
  // debugMode is false there.
  const isDisabled = disabled || (Boolean(hasPaid) && !debugMode);

  function reachedThreshold() {
    try {
      const doc = document.documentElement;
      const scrollY = window.scrollY || window.pageYOffset;
      const viewportHeight = window.innerHeight || doc.clientHeight || 0;
      const paywall = document.getElementById("fullaccess-promo");

      if (paywall) {
        const paywallTop = paywall.getBoundingClientRect().top + window.scrollY;
        const leadDistance = Math.max(240, viewportHeight * 0.35);
        const threshold = Math.max(0, paywallTop - leadDistance);
        return scrollY >= threshold;
      }

      const docH = Math.max(doc.scrollHeight, doc.offsetHeight);
      const half = docH * 0.5;
      return scrollY >= half;
    } catch {
      return false;
    }
  }

  function handleScrollStopped() {
    if (visible || isDisabled) return;
    if (reachedThreshold()) {
      // show once
      setVisible(true);
      track("uranai_interstitial_view", {
        ownerToken: ownerToken ?? null,
        metadata: { ownerId: ownerId ?? null },
      });
    }
  }

  // check localStorage + server-side flag
  useEffect(() => {
    if (typeof window === "undefined" || !ownerToken || isDisabled) return;

    // ask server if already recorded
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/uranai-interstitial/status?ownerToken=${encodeURIComponent(
          ownerToken,
        )}`);
        if (!res.ok || cancelled) return;
        const j = await res.json();
        if (j?.shown && !debugMode) setDisabled(true);
      } catch {
        /* noop */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerToken, isDisabled, debugMode]);

  useEffect(() => {
    if (isDisabled) return;

    const onScroll = () => {
      // mark scrolling and debounce stop
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(() => {
        handleScrollStopped();
      }, 300) as unknown as number;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // also check immediately in case page is already scrolled
    const initialCheck = window.setTimeout(() => {
      handleScrollStopped();
    }, 0);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener("scroll", onScroll);
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisabled]);

  async function markShownServer() {
    if (!ownerToken) return;
    try {
      await fetch("/api/uranai-interstitial/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken }),
      });
    } catch {
      // ignore
    }
  }

  function close() {
    setVisible(false);
    if (!debugMode) {
      try {
        localStorage.setItem(STORAGE_KEY, isoNow());
      } catch {
        /* noop */
      }
    }
    markShownServer();
    track("uranai_interstitial_close", {
      ownerToken: ownerToken ?? null,
      metadata: { ownerId: ownerId ?? null },
    });
    setDisabled(true);
  }

  function onCta() {
    track("uranai_interstitial_cta", {
      ownerToken: ownerToken ?? null,
      metadata: { ownerId: ownerId ?? null },
    });
    // mark shown as user saw
    if (!debugMode) {
      try {
        localStorage.setItem(STORAGE_KEY, isoNow());
      } catch {}
    }
    markShownServer();
    // navigate
    const url =
      (typeof process !== "undefined" &&
        process.env.NEXT_PUBLIC_UNMEI_URL) ||
      "/unmei";
    window.location.href = url;
  }

  if (isDisabled) return null;
  if (!visible) return null;

  // Simple accessible overlay implementation (visuals simplified)
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-[#0D1330]"
    >
      <div className="absolute inset-0" aria-hidden="true" />
      <div className="relative mx-4 max-w-[720px] rounded-2xl bg-transparent p-4 text-white">
        <button
          aria-label="閉じる"
          onClick={close}
          className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/40 text-white"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          ×
        </button>

        <div className="space-y-4 rounded-2xl bg-gradient-to-b from-[#0D1330] to-[#131A3A] p-6">
          <div className="inline-flex items-center gap-3">
            <span className="rounded-full bg-[#E7DCFB] px-3 py-1 text-sm font-bold text-[#2E2E5C]">
              ホロスコープ占い × 性格診断
            </span>
            {debugMode && (
              <span className="rounded-full border border-[#F2B33D]/60 bg-[#F2B33D]/20 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-[#F8D68A]">
                DEBUG
              </span>
            )}
          </div>

          <CharacterPreview typeName={typeName} />

          <h3 className="mt-2 text-2xl font-black leading-tight">
            {typeName ? `${typeName}のあなたが\n生まれた瞬間の空` : "あなたが生まれた瞬間の空"}
          </h3>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-lg font-bold">運命の設計図 ¥1,980</p>
            </div>
            <div>
              <button
                onClick={onCta}
                className="rounded-full bg-[#F2B33D] px-4 py-2 font-black text-[#1A1A1A]"
              >
                運命の設計図を占う
              </button>
            </div>
          </div>

          <p className="text-xs text-[#D6D6E8]">エンタメコンテンツです・出生データは鑑定の計算のみに使用</p>
        </div>
      </div>
    </div>
  );
}
