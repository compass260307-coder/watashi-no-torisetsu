import type { FullAccessStatus } from "./full-access-status";
import { SESSION_MARKER_COOKIE_NAME, SESSION_ACCESS_CACHE_COOKIE_NAME } from "./session-constants";

export const FULL_ACCESS_INVALIDATED_EVENT = "torisetsu:full-access-invalidated";
export const FULL_ACCESS_UPDATED_EVENT = "torisetsu:full-access-updated";
const CACHE_KEY = "torisetsu_full_access_status_v1";
const CHANGE_KEY = "torisetsu_full_access_changed_v1";
const OWNER_KEY = "torisetsu_owner_token";
const TTL_MS = 5 * 60_000;
type Cached = { ownerToken: string; scope: string; access: FullAccessStatus; expiresAt: number };
type Pending = { ownerToken: string; fresh: boolean; controller: AbortController; promise: Promise<FullAccessStatus | null> };
const cachedByOwner = new Map<string, Cached>();
const pendingByOwner = new Map<string, Pending>();
const serialByOwner = new Map<string, number>();
let activeScope: string | null = null;
let generation = 0;
let initialized = false;
let purchaseReturnHandled = "";
let lastFreshSignature = "";

function scope(): string {
  try {
    const marker = document.cookie.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_MARKER_COOKIE_NAME}=`)) ?? "";
    const sessionGeneration = document.cookie.split(";").map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_ACCESS_CACHE_COOKIE_NAME}=`)) ?? "";
    return JSON.stringify([localStorage.getItem(OWNER_KEY), marker, sessionGeneration, localStorage.getItem(CHANGE_KEY)]);
  } catch {
    return "storage-unavailable";
  }
}

function clear(ownerToken?: string) {
  if (ownerToken) {
    serialByOwner.set(ownerToken, (serialByOwner.get(ownerToken) ?? 0) + 1);
    cachedByOwner.delete(ownerToken);
    pendingByOwner.get(ownerToken)?.controller.abort();
    pendingByOwner.delete(ownerToken);
  } else {
    generation += 1;
    cachedByOwner.clear();
    for (const request of pendingByOwner.values()) request.controller.abort();
    pendingByOwner.clear();
    serialByOwner.clear();
  }
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* memory-only fallback */ }
}

/** リセット/ログアウトや決済で使う。古い進行中fetchも結果を保存できなくする。 */
export function invalidateFullAccessStatus(broadcast = true) {
  clear();
  if (broadcast) {
    try { localStorage.setItem(CHANGE_KEY, `${Date.now()}:${Math.random()}`); } catch { /* noop */ }
  }
  activeScope = scope();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FULL_ACCESS_INVALIDATED_EVENT));
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === OWNER_KEY || event.key === CHANGE_KEY) {
      invalidateFullAccessStatus(false);
    }
  });
  // 通常のfocus復帰ではfetchしない。別タブの決済/ユーザー切替だけ通知する。
  const checkScope = () => {
    if (activeScope !== null && activeScope !== scope()) invalidateFullAccessStatus(false);
  };
  window.addEventListener("pageshow", checkScope);
  document.addEventListener("visibilitychange", checkScope);
}

function validStatus(value: unknown): value is FullAccessStatus {
  if (!value || typeof value !== "object") return false;
  return ["full", "selfReport", "friend", "premiumBundle", "astrologer", "unmei", "tarot"]
    .every((key) => typeof (value as Record<string, unknown>)[key] === "boolean");
}

/** owner別・セッション世代別。reload/遷移は5分共有し、決済pollは必ず最新値。 */
export function requestFullAccessStatus(ownerToken: string, options: { fresh?: boolean } = {}): Promise<FullAccessStatus | null> {
  if (!ownerToken || typeof window === "undefined") return Promise.resolve(null);
  initialize();
  const currentScope = scope();
  if (activeScope !== null && activeScope !== currentScope) clear();
  activeScope = currentScope;

  const query = new URLSearchParams(window.location.search);
  const purchaseReturn = query.get("paid") === "1" || query.get("checkout") === "success" ||
    query.get("upgraded") === "1" || /\/purchase-complete\/?$/.test(window.location.pathname);
  const returnKey = purchaseReturn ? window.location.href : "";
  const newPurchaseReturn = !!returnKey && purchaseReturnHandled !== returnKey;
  if (newPurchaseReturn) {
    purchaseReturnHandled = returnKey;
    // マウント中の他のconsumerへは、このfreshリクエスト完了後に通知する。
    clear();
    try { localStorage.setItem(CHANGE_KEY, `${Date.now()}:${Math.random()}`); } catch { /* noop */ }
    activeScope = scope();
  }
  const fresh = options.fresh === true || newPurchaseReturn;
  const pending = pendingByOwner.get(ownerToken);
  if (pending && (!fresh || pending.fresh)) return pending.promise;
  if (fresh) clear(ownerToken);
  let cached = cachedByOwner.get(ownerToken);
  if (cached && cached.scope !== activeScope) {
    cachedByOwner.delete(ownerToken);
    cached = undefined;
  }

  if (!fresh && !cached) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as Cached | null;
      if (stored?.ownerToken === ownerToken && stored.scope === activeScope && validStatus(stored.access) &&
        stored.expiresAt > Date.now() && stored.expiresAt <= Date.now() + TTL_MS) {
        cached = stored;
        cachedByOwner.set(ownerToken, stored);
      } else {
        sessionStorage.removeItem(CACHE_KEY);
      }
    } catch { /* disabled/corrupt storage: fetch normally */ }
  }
  if (!fresh && cached?.ownerToken === ownerToken && cached.expiresAt > Date.now()) return Promise.resolve(cached.access);

  // 有効期限切れのentryは、以降の取得の際に掃除してメモリを増やし続けない。
  for (const [key, entry] of cachedByOwner) if (entry.expiresAt <= Date.now()) cachedByOwner.delete(key);
  const requestGeneration = generation;
  const requestSerial = serialByOwner.get(ownerToken) ?? 0;
  const requestScope = activeScope;
  const controller = new AbortController();
  const promise = fetch(`/api/checkout/full-access-status?owner_token=${encodeURIComponent(ownerToken)}`,
    { cache: "no-store", signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) throw new Error("Access status request failed");
      const access: unknown = await response.json();
      if (!validStatus(access)) throw new Error("Invalid access status response");
      // ログアウト/切替/決済無効化より前の応答を復活させない。
      if (generation !== requestGeneration || (serialByOwner.get(ownerToken) ?? 0) !== requestSerial || scope() !== requestScope) return null;
      const signature = JSON.stringify([ownerToken, access]);
      if (fresh && signature !== lastFreshSignature) {
        lastFreshSignature = signature;
        // 購入タブでwebhookの反映を確認した後も、開いたままの別タブへ通知する。
        try { localStorage.setItem(CHANGE_KEY, `${Date.now()}:${Math.random()}`); } catch { /* noop */ }
        activeScope = scope();
      }
      cached = { ownerToken, scope: activeScope ?? requestScope, access, expiresAt: Date.now() + TTL_MS };
      cachedByOwner.set(ownerToken, cached);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached)); } catch { /* memory-only */ }
      window.dispatchEvent(new CustomEvent(FULL_ACCESS_UPDATED_EVENT, { detail: { ownerToken, access } }));
      return access;
    })
    .catch(() => null)
    .finally(() => {
      if (pendingByOwner.get(ownerToken)?.promise === promise) pendingByOwner.delete(ownerToken);
    });
  pendingByOwner.set(ownerToken, { ownerToken, fresh, controller, promise });
  return promise;
}
