"use client";

import { useEffect, useState } from "react";

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
    try {
      ownerToken = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // Cookie session の判定へフォールバックする。
    }

    void requestAccess(ownerToken).then((unlocked) => {
      if (!cancelled) setState({ pathname, unlocked });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);

  return enabled && state?.pathname === pathname && state.unlocked;
}
