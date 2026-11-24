"use client";

import { useEffect, useState } from "react";
import { SESSION_MARKER_COOKIE_NAME } from "@/lib/session-constants";

type AccessState = {
  pathname: string;
  unlocked: boolean;
};

const pendingByIdentity = new Map<string, Promise<boolean>>();

function requestAccess(ownerToken: string | null): Promise<boolean> {
  const identity = ownerToken ?? "session";
  const pending = pendingByIdentity.get(identity);
  if (pending) return pending;

  const query = ownerToken
    ? `?owner_token=${encodeURIComponent(ownerToken)}`
    : "";
  const request = fetch(`/api/aisho/access${query}`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return false;
      const data = (await response.json()) as { unlocked?: boolean };
      return data.unlocked === true;
    })
    .catch(() => false);
  pendingByIdentity.set(identity, request);
  return request;
}

/**
 * この端末にログインの目印 (cookie) があるか。読めないときは「あるかもしれない」として true。
 * 目印は 2026-09-10 から発行しているので、それより前にログインしたままの端末では false になる。
 */
function hasSessionMarker(): boolean {
  try {
    return document.cookie
      .split(";")
      .some((part) => part.trim() === `${SESSION_MARKER_COOKIE_NAME}=1`);
  } catch {
    return true;
  }
}

/** 未確認・未購入は false に倒し、相性診断への導線を表示しない。 */
export function useAishoNavigationAccess(
  pathname: string,
  enabled = true,
): boolean {
  const [state, setState] = useState<AccessState | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let ownerToken: string | null = null;
    let storageReadable = true;
    try {
      ownerToken = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // Cookie session の判定へフォールバックする。
      storageReadable = false;
    }

    // 診断もログインもしていない端末は、問い合わせても必ず false。APIを呼ばずに済ませる
    // (メニューの導線を出すかどうかだけの判定。相性ページの入口は useAishoEntryAccess が別に確かめる)。
    if (storageReadable && !ownerToken && !hasSessionMarker()) return;

    void requestAccess(ownerToken).then((unlocked) => {
      if (!cancelled) setState({ pathname, unlocked });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);

  return enabled && state?.pathname === pathname && state.unlocked;
}

export type AishoEntryAccess = {
  /** true=相性を開ける本人 / false=未課金と確定 / null=確認中、または通信失敗で確認できなかった。 */
  unlocked: boolean | null;
  /** この端末に残っている本人のトークン（診断済みの目印）。 */
  ownerToken: string | null;
};

const ENTRY_ACCESS_PENDING: AishoEntryAccess = { unlocked: null, ownerToken: null };

/**
 * 相性ページの入口用。ナビ用の useAishoNavigationAccess と違い、「未課金と確定」と
 * 「確認できなかった」を分ける（通信失敗で課金済みの人を追い出さないため）。
 */
export function useAishoEntryAccess(enabled: boolean): AishoEntryAccess {
  const [state, setState] = useState<AishoEntryAccess>(ENTRY_ACCESS_PENDING);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let ownerToken: string | null = null;
    try {
      ownerToken = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // Cookie session の判定へフォールバックする。
    }
    const query = ownerToken ? `?owner_token=${encodeURIComponent(ownerToken)}` : "";
    fetch(`/api/aisho/access${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { unlocked?: boolean };
        return data.unlocked === true;
      })
      .catch(() => null)
      .then((unlocked) => {
        if (!cancelled) setState({ unlocked, ownerToken });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return enabled ? state : ENTRY_ACCESS_PENDING;
}
