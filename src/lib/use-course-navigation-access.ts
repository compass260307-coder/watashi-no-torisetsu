"use client";

import { useEffect, useState } from "react";

export type CourseNavigationAccess = {
  ownerToken: string;
  astrologer: boolean;
  unmei: boolean;
  tarot: boolean;
};

type CourseAccessFlags = Omit<CourseNavigationAccess, "ownerToken">;

export type FullAccessStatus = CourseAccessFlags & {
  selfReport: boolean;
  full: boolean;
  friend: boolean;
  premiumBundle: boolean;
};

const RESOLVED_CACHE_TTL_MS = 30_000;
const pendingByOwnerToken = new Map<
  string,
  Promise<FullAccessStatus | null>
>();
const resolvedByOwnerToken = new Map<
  string,
  { access: FullAccessStatus; expiresAt: number }
>();

/**
 * 同じ画面にあるナビ・課金カード・価格CTAの権限確認を1リクエストへ束ねる。
 * 決済直後のポーリングは最新値が必要なので、この短期キャッシュを使わない。
 */
export function requestFullAccessStatus(
  ownerToken: string,
): Promise<FullAccessStatus | null> {
  const resolved = resolvedByOwnerToken.get(ownerToken);
  if (resolved && resolved.expiresAt > Date.now()) {
    return Promise.resolve(resolved.access);
  }
  if (resolved) resolvedByOwnerToken.delete(ownerToken);

  const pending = pendingByOwnerToken.get(ownerToken);
  if (pending) return pending;

  const request = fetch(
    `/api/checkout/full-access-status?owner_token=${encodeURIComponent(ownerToken)}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      if (!response.ok) throw new Error("access status request failed");
      const data = (await response.json()) as {
        selfReport?: boolean;
        full?: boolean;
        friend?: boolean;
        premiumBundle?: boolean;
        astrologer?: boolean;
        unmei?: boolean;
        tarot?: boolean;
      };
      const access = {
        selfReport: data.selfReport === true,
        full: data.full === true,
        friend: data.friend === true,
        premiumBundle: data.premiumBundle === true,
        astrologer: data.astrologer === true,
        unmei: data.unmei === true,
        tarot: data.tarot === true,
      };
      resolvedByOwnerToken.set(ownerToken, {
        access,
        expiresAt: Date.now() + RESOLVED_CACHE_TTL_MS,
      });
      return access;
    })
    .catch(() => null)
    .finally(() => {
      pendingByOwnerToken.delete(ownerToken);
    });

  pendingByOwnerToken.set(ownerToken, request);
  return request;
}

/** 未確認・未購入は null に倒し、占い系ナビをロック表示にする。 */
export function useCourseNavigationAccess(
  ownerToken: string | null,
): CourseNavigationAccess | null {
  const [state, setState] = useState<CourseNavigationAccess | null>(null);

  useEffect(() => {
    if (!ownerToken) return;

    let cancelled = false;
    void requestFullAccessStatus(ownerToken).then((access) => {
      if (!cancelled) {
        setState({
          ownerToken,
          astrologer: access?.astrologer === true,
          unmei: access?.unmei === true,
          tarot: access?.tarot === true,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ownerToken]);

  return ownerToken && state?.ownerToken === ownerToken ? state : null;
}
