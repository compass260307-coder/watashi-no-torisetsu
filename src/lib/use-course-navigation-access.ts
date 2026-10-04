"use client";

import { useEffect, useState } from "react";
import { FULL_ACCESS_INVALIDATED_EVENT, FULL_ACCESS_UPDATED_EVENT, requestFullAccessStatus } from "./full-access-status-client";
import type { FullAccessStatus } from "./full-access-status";
export { requestFullAccessStatus } from "./full-access-status-client";
export type { FullAccessStatus } from "./full-access-status";

export type CourseNavigationAccess = {
  ownerToken: string;
  astrologer: boolean;
  unmei: boolean;
  tarot: boolean;
};

/** 表示専用。Checkoutとコンテンツのサーバー認可は毎回DBで判定する。 */
export function useFullAccessStatus(ownerToken: string | null): FullAccessStatus | null {
  const [state, setState] = useState<{ ownerToken: string; access: FullAccessStatus } | null>(null);
  useEffect(() => {
    if (!ownerToken) return;
    let cancelled = false;
    let sequence = 0;
    const load = () => {
      const attempt = ++sequence;
      void requestFullAccessStatus(ownerToken).then((access) => {
        if (!cancelled && attempt === sequence && access) setState({ ownerToken, access });
      });
    };
    const invalidate = () => {
      sequence += 1;
      setState(null);
      // ユーザー切替/リセット後に古いtokenを再fetchしない。
      try { if (localStorage.getItem("torisetsu_owner_token") !== ownerToken) return; } catch { /* noop */ }
      load();
    };
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ ownerToken: string; access: FullAccessStatus }>).detail;
      if (!cancelled && detail.ownerToken === ownerToken) setState(detail);
    };
    load();
    window.addEventListener(FULL_ACCESS_INVALIDATED_EVENT, invalidate);
    window.addEventListener(FULL_ACCESS_UPDATED_EVENT, update);
    return () => {
      cancelled = true;
      window.removeEventListener(FULL_ACCESS_INVALIDATED_EVENT, invalidate);
      window.removeEventListener(FULL_ACCESS_UPDATED_EVENT, update);
    };
  }, [ownerToken]);
  return ownerToken && state?.ownerToken === ownerToken ? state.access : null;
}

export function useCourseNavigationAccess(ownerToken: string | null): CourseNavigationAccess | null {
  const access = useFullAccessStatus(ownerToken);
  return ownerToken && access ? { ownerToken, astrologer: access.astrologer, unmei: access.unmei, tarot: access.tarot } : null;
}
