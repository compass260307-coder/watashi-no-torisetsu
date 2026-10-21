import { pushVerifiedConversion } from "@/lib/verified-conversions";
import { ACTIVE_X_PIXELS } from "@/lib/x-pixel-config";

export const X_DIAGNOSIS_COMPLETE_EVENT_IDS = ACTIVE_X_PIXELS.filter((pixel) => !pixel.locale).map((pixel) => pixel.diagnosis.eventId);
export const X_DIAGNOSIS_PENDING_PREFIX = "wt_x_diagnosis_pending_v1:";
export const X_KO_DIAGNOSIS_PENDING_PREFIX = "wt_x_ko_diagnosis_pending_v1:";

// Save provenance only after the diagnosis API succeeds. A Korean page visit
// alone must never authorize a conversion, including on shared result URLs.
export function markXDiagnosisSaved(userId: string, locale: string): void {
  if (typeof window === "undefined" || !userId) return;
  const savedAt = String(Date.now());
  try {
    window.sessionStorage.setItem(X_DIAGNOSIS_PENDING_PREFIX + userId, savedAt);
    if (locale === "ko") window.sessionStorage.setItem(X_KO_DIAGNOSIS_PENDING_PREFIX + userId, savedAt);
    else window.sessionStorage.removeItem(X_KO_DIAGNOSIS_PENDING_PREFIX + userId);
  } catch {
    // Missing provenance fails closed without interrupting diagnosis completion.
  }
}

const sentEvents = new Set<string>();
const X_PURCHASE_SENT_PREFIX = "wt_x_purchase_sent_v1:";
const purchaseEventIds = new Set(ACTIVE_X_PIXELS.map((pixel) => pixel.purchase.eventId));
const eventConfigs = new Map(ACTIVE_X_PIXELS.flatMap((pixel) => [
  [pixel.diagnosis.eventId, pixel.diagnosis],
  [pixel.purchase.eventId, pixel.purchase],
] as const));

// Preserve michi/rgg36: diagnosis in every locale; purchase only in JPY.
export function xPurchaseEventIds(currency: string, checkoutLocale?: string): readonly string[] {
  return ACTIVE_X_PIXELS
    .filter((pixel) => (!pixel.locale || pixel.locale === checkoutLocale) &&
      (!pixel.purchase.currency || pixel.purchase.currency === currency))
    .map((pixel) => pixel.purchase.eventId);
}

export type XEventParams = {
  conversion_id: string;
  value?: number;
  currency?: string;
};

declare global {
  interface Window {
    twq?: {
      (command: "event", eventId: string, params: Partial<XEventParams>): void;
      (command: "config", pixelId: string): void;
    };
  }
}

export function trackX(eventId: string, params: Partial<XEventParams>): boolean {
  if (!eventConfigs.has(eventId) || typeof window === "undefined" || typeof window.twq !== "function") return false;
  try {
    const pixel = ACTIVE_X_PIXELS.find((pixel) => pixel.locale &&
      (pixel.diagnosis.eventId === eventId || pixel.purchase.eventId === eventId));
    if (pixel) {
      const guard = `__wt_x_${pixel.id}_configured`;
      const target = window as unknown as Record<string, unknown>;
      if (!target[guard]) {
        window.twq("config", pixel.id);
        target[guard] = true;
      }
    }
    window.twq("event", eventId, params);
    return true;
  } catch {
    // A blocked or failing advertising tag must not interrupt the result page.
    return false;
  }
}

function wasSent(key: string): boolean {
  if (sentEvents.has(key)) return true;
  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      if (window[storageName].getItem(key) === "1") return true;
    } catch {
      // Try the other storage, then fall back to this page's in-memory guard.
    }
  }
  return false;
}

function rememberSent(key: string): void {
  sentEvents.add(key);
  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      window[storageName].setItem(key, "1");
    } catch {
      // Storage restrictions must not interrupt diagnosis or purchase completion.
    }
  }
}

export function wasXPurchaseSent(checkoutSessionId: string): boolean {
  return typeof window !== "undefined" && wasSent(X_PURCHASE_SENT_PREFIX + checkoutSessionId);
}

// Preserve each remaining destination's legacy dedupe key and failure retries.
// Removing an account must not block completion of the active fan-out.
export async function trackXEventsOnce(
  eventIds: readonly string[],
  params: XEventParams,
  requireDiagnosisCompletion = false,
  isActive: () => boolean = () => true,
): Promise<boolean> {
  if (typeof window === "undefined" || !params.conversion_id || !eventIds.length ||
    eventIds.some((eventId) => !eventConfigs.has(eventId))) return false;

  const send = (): boolean => {
    if (!isActive() || typeof window.twq !== "function") return false;
    const markerKey = X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
    const koreanMarkerKey = X_KO_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
    let savedAt = 0;
    let koreanSavedAt = 0;
    if (requireDiagnosisCompletion) {
      try {
        savedAt = Number(window.sessionStorage.getItem(markerKey));
        koreanSavedAt = Number(window.sessionStorage.getItem(koreanMarkerKey));
      } catch {
        // Keep the existing completion gate when storage is unavailable.
      }
    }
    const koreanDiagnosisIds = savedAt > 0 && koreanSavedAt === savedAt
      ? ACTIVE_X_PIXELS.filter((pixel) => pixel.locale === "ko").map((pixel) => pixel.diagnosis.eventId) : [];
    const destinations = requireDiagnosisCompletion ? Array.from(new Set([...eventIds, ...koreanDiagnosisIds])) : eventIds;
    const keys = destinations.map((eventId) => {
      const key = `wt_x_sent_v1:${eventId}:${params.conversion_id}`;
      // Preserve the previous rh617 per-save dedupe contract on re-diagnosis.
      return koreanDiagnosisIds.includes(eventId) ? `${key}:${savedAt}` : key;
    });
    // This retired ID is read only for historical purchase deduplication.
    // It is never configured or sent.
    const previousPurchaseSent = wasXPurchaseSent(params.conversion_id) ||
      wasSent(`wt_x_sent_v1:tw-rezdw-1436v3:${params.conversion_id}`);
    const destinationSent = (index: number): boolean => wasSent(keys[index]) ||
      ACTIVE_X_PIXELS.some((pixel) => pixel.diagnosis.eventId === destinations[index] &&
        pixel.diagnosis.legacyEventIds?.some((eventId) =>
          wasSent(`wt_x_sent_v1:${eventId}:${params.conversion_id}`))) ||
      (purchaseEventIds.has(destinations[index]) && previousPurchaseSent);
    if (requireDiagnosisCompletion && !keys.every(wasSent)) {
      try {
        const age = Date.now() - savedAt;
        if (!savedAt || age < 0 || age > 10 * 60 * 1000) return false;
      } catch {
        return false;
      }
    }
    for (let index = 0; index < destinations.length; index++) {
      const eventParams = eventConfigs.get(destinations[index])?.includeParams ? params : {};
      if (!destinationSent(index)) {
        // Prepare GTM without changing direct X delivery or its success contract.
        pushVerifiedConversion(requireDiagnosisCompletion ? "diagnosis_completed" : "purchase_verified", params);
      }
      if (!destinationSent(index) && trackX(destinations[index], eventParams)) {
        // This records hand-off to twq, not confirmation of receipt by X.
        rememberSent(keys[index]);
      }
    }
    const complete = keys.every((_key, index) => destinationSent(index));
    if (complete && requireDiagnosisCompletion) {
      try {
        window.sessionStorage.removeItem(markerKey);
        window.sessionStorage.removeItem(koreanMarkerKey);
      } catch {
        // Per-event keys still prevent repeats if marker removal is blocked.
      }
    }
    if (complete && eventIds.some((eventId) => purchaseEventIds.has(eventId))) {
      rememberSent(X_PURCHASE_SENT_PREFIX + params.conversion_id);
    }
    return complete;
  };

  try {
    if (window.navigator?.locks) {
      return await window.navigator.locks.request(`wt_x:${params.conversion_id}`, send);
    }
  } catch {
    // Unsupported/denied Web Locks must not stop the result page.
  }
  return send();
}
