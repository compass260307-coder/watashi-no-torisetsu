import { ACTIVE_X_PIXELS } from "@/lib/x-pixel-config";

export const X_DIAGNOSIS_COMPLETE_EVENT_IDS = ACTIVE_X_PIXELS.map((pixel) => pixel.diagnosis.eventId);
export const X_DIAGNOSIS_PENDING_PREFIX = "wt_x_diagnosis_pending_v1:";

const sentEvents = new Set<string>();
const X_PURCHASE_SENT_PREFIX = "wt_x_purchase_sent_v1:";
const purchaseEventIds = new Set(ACTIVE_X_PIXELS.map((pixel) => pixel.purchase.eventId));
const eventConfigs = new Map(ACTIVE_X_PIXELS.flatMap((pixel) => [
  [pixel.diagnosis.eventId, pixel.diagnosis],
  [pixel.purchase.eventId, pixel.purchase],
] as const));

// rgg36 remains JPY-only. The other active accounts follow every verified
// settlement with empty payloads, exactly as before.
export function xPurchaseEventIds(currency: string): readonly string[] {
  return ACTIVE_X_PIXELS
    .filter((pixel) => !pixel.purchase.currency || pixel.purchase.currency === currency)
    .map((pixel) => pixel.purchase.eventId);
}

export type XEventParams = {
  conversion_id: string;
  value?: number;
  currency?: string;
};

declare global {
  interface Window {
    twq?: (command: "event", eventId: string, params: Partial<XEventParams>) => void;
  }
}

export function trackX(eventId: string, params: Partial<XEventParams>): boolean {
  if (!eventConfigs.has(eventId) || typeof window === "undefined" || typeof window.twq !== "function") return false;
  try {
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
    const keys = eventIds.map((eventId) => `wt_x_sent_v1:${eventId}:${params.conversion_id}`);
    // This retired ID is read only for historical purchase deduplication.
    // It is never configured or sent.
    const previousPurchaseSent = wasXPurchaseSent(params.conversion_id) ||
      wasSent(`wt_x_sent_v1:tw-rezdw-1436v3:${params.conversion_id}`);
    const destinationSent = (index: number): boolean => wasSent(keys[index]) ||
      ACTIVE_X_PIXELS.some((pixel) => pixel.diagnosis.eventId === eventIds[index] &&
        pixel.diagnosis.legacyEventIds?.some((eventId) =>
          wasSent(`wt_x_sent_v1:${eventId}:${params.conversion_id}`))) ||
      (purchaseEventIds.has(eventIds[index]) && previousPurchaseSent);
    const markerKey = X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
    if (requireDiagnosisCompletion && !keys.every(wasSent)) {
      try {
        const savedAt = Number(window.sessionStorage.getItem(markerKey));
        const age = Date.now() - savedAt;
        if (!savedAt || age < 0 || age > 10 * 60 * 1000) return false;
      } catch {
        return false;
      }
    }
    for (let index = 0; index < eventIds.length; index++) {
      const eventParams = eventConfigs.get(eventIds[index])?.includeParams ? params : {};
      if (!destinationSent(index) && trackX(eventIds[index], eventParams)) {
        // This records hand-off to twq, not confirmation of receipt by X.
        rememberSent(keys[index]);
      }
    }
    const complete = keys.every((_key, index) => destinationSent(index));
    if (complete && requireDiagnosisCompletion) {
      try {
        window.sessionStorage.removeItem(markerKey);
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
