export const X_DIAGNOSIS_COMPLETE_EVENT_ID = "tw-rg1zg-rg1zv";
export const X_PURCHASE_EVENT_ID = "tw-rg1zg-rg1zz";
export const X_ADDITIONAL_DIAGNOSIS_EVENT_ID = "tw-rezdw-reze3";
export const X_ADDITIONAL_PURCHASE_EVENT_ID = "tw-rezdw-rgdz4";
export const X_RGG36_DIAGNOSIS_EVENT_ID = "tw-rgg36-rgg9b";
export const X_RGG36_PURCHASE_EVENT_ID = "tw-rgg36-rgg3b";
export const X_RGI5K_DIAGNOSIS_EVENT_ID = "tw-rgi5k-rgi5r";
export const X_RGI5K_PURCHASE_EVENT_ID = "tw-rgi5k-rgi5m";
export const X_RGKNS_DIAGNOSIS_EVENT_ID = "tw-rgkns-rgkoe";
export const X_RGKNS_PURCHASE_EVENT_ID = "tw-rgkns-rgknu";
export const X_RGKQM_DIAGNOSIS_EVENT_ID = "tw-rgkqm-rgkr4";
export const X_RGKQM_PURCHASE_EVENT_ID = "tw-rgkqm-rgkr6";
export const X_RGM4U_DIAGNOSIS_EVENT_ID = "tw-rgm4u-rgm58";
export const X_RGM4U_PURCHASE_EVENT_ID = "tw-rgm4u-rgm4y";
export const X_RGOB2_DIAGNOSIS_EVENT_ID = "tw-rgob2-rgobn";
export const X_RGOB2_PURCHASE_EVENT_ID = "tw-rgob2-rgobj";
export const X_RGSKB_DIAGNOSIS_EVENT_ID = "tw-rgskb-rgski";
export const X_RGSKB_PURCHASE_EVENT_ID = "tw-rgskb-rgskd";
export const X_RGTX5_DIAGNOSIS_EVENT_ID = "tw-rgtx5-rgtxe";
export const X_RGTX5_PURCHASE_EVENT_ID = "tw-rgtx5-rgtx9";
export const X_DIAGNOSIS_COMPLETE_EVENT_IDS = [
  X_DIAGNOSIS_COMPLETE_EVENT_ID,
  X_ADDITIONAL_DIAGNOSIS_EVENT_ID,
  X_RGG36_DIAGNOSIS_EVENT_ID,
  X_RGI5K_DIAGNOSIS_EVENT_ID,
  X_RGKNS_DIAGNOSIS_EVENT_ID,
  X_RGKQM_DIAGNOSIS_EVENT_ID,
  X_RGM4U_DIAGNOSIS_EVENT_ID,
  X_RGOB2_DIAGNOSIS_EVENT_ID,
  X_RGSKB_DIAGNOSIS_EVENT_ID,
  X_RGTX5_DIAGNOSIS_EVENT_ID,
] as const;
export const X_DIAGNOSIS_PENDING_PREFIX = "wt_x_diagnosis_pending_v1:";

const sentEvents = new Set<string>();
const X_PURCHASE_SENT_PREFIX = "wt_x_purchase_sent_v1:";

// Keep rg1zg's existing JPY scope; rezdw uses the actual settlement currency.
// rgg36's requested JPY event applies only to verified JPY settlements.
// rgi5k follows the existing purchase flow in every verified settlement currency.
// rgkns, rgkqm, rgm4u, rgob2, rgskb, and rgtx5 also follow every verified settlement, with payload-free events.
export function xPurchaseEventIds(currency: string): readonly string[] {
  return currency === "JPY"
    ? [X_PURCHASE_EVENT_ID, X_ADDITIONAL_PURCHASE_EVENT_ID, X_RGG36_PURCHASE_EVENT_ID, X_RGI5K_PURCHASE_EVENT_ID, X_RGKNS_PURCHASE_EVENT_ID, X_RGKQM_PURCHASE_EVENT_ID, X_RGM4U_PURCHASE_EVENT_ID, X_RGOB2_PURCHASE_EVENT_ID, X_RGSKB_PURCHASE_EVENT_ID, X_RGTX5_PURCHASE_EVENT_ID]
    : [X_ADDITIONAL_PURCHASE_EVENT_ID, X_RGI5K_PURCHASE_EVENT_ID, X_RGKNS_PURCHASE_EVENT_ID, X_RGKQM_PURCHASE_EVENT_ID, X_RGM4U_PURCHASE_EVENT_ID, X_RGOB2_PURCHASE_EVENT_ID, X_RGSKB_PURCHASE_EVENT_ID, X_RGTX5_PURCHASE_EVENT_ID];
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
  if (typeof window === "undefined" || typeof window.twq !== "function") return false;
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

// A single completion marker authorizes the entire fan-out. Each destination
// keeps its own legacy-compatible dedupe key, so one failed tag can be retried
// without repeating the other account's event.
export async function trackXEventsOnce(
  eventIds: readonly string[],
  params: XEventParams,
  requireDiagnosisCompletion = false,
  isActive: () => boolean = () => true,
): Promise<boolean> {
  if (typeof window === "undefined" || !params.conversion_id || !eventIds.length) return false;

  const send = (): boolean => {
    if (!isActive() || typeof window.twq !== "function") return false;
    const keys = eventIds.map((eventId) => `wt_x_sent_v1:${eventId}:${params.conversion_id}`);
    // Preserve purchase hand-offs across event replacements/account additions. Do not
    // replay an old payment, even if Meta/TikTok's acknowledgement was missing.
    const previousPurchaseSent = wasXPurchaseSent(params.conversion_id) ||
      wasSent(`wt_x_sent_v1:tw-rezdw-1436v3:${params.conversion_id}`);
    const destinationSent = (index: number): boolean => wasSent(keys[index]) ||
      ((eventIds[index] === X_ADDITIONAL_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGG36_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGI5K_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGKNS_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGKQM_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGM4U_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGOB2_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGSKB_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGTX5_PURCHASE_EVENT_ID) && previousPurchaseSent);
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
      // Preserve rgg36's payload-free diagnosis and rgkns/rgkqm/rgm4u/rgob2/rgskb/rgtx5's empty payloads.
      // The action ID still keys local dedupe even when it is not sent to X.
      const eventParams = eventIds[index] === X_RGG36_DIAGNOSIS_EVENT_ID ||
        eventIds[index] === X_RGKNS_DIAGNOSIS_EVENT_ID ||
        eventIds[index] === X_RGKNS_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGKQM_DIAGNOSIS_EVENT_ID ||
        eventIds[index] === X_RGKQM_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGM4U_DIAGNOSIS_EVENT_ID ||
        eventIds[index] === X_RGM4U_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGOB2_DIAGNOSIS_EVENT_ID ||
        eventIds[index] === X_RGOB2_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGSKB_DIAGNOSIS_EVENT_ID ||
        eventIds[index] === X_RGSKB_PURCHASE_EVENT_ID ||
        eventIds[index] === X_RGTX5_DIAGNOSIS_EVENT_ID ||
        eventIds[index] === X_RGTX5_PURCHASE_EVENT_ID ? {} : params;
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
    if (complete && eventIds.includes(X_ADDITIONAL_PURCHASE_EVENT_ID)) {
      rememberSent(X_PURCHASE_SENT_PREFIX + params.conversion_id);
    }
    return complete;
  };

  // Serialize the same conversion across tabs where Web Locks are available.
  // Without them, storage + in-memory guards and the stable conversion_id remain.
  try {
    if (window.navigator?.locks) {
      return await window.navigator.locks.request(`wt_x:${params.conversion_id}`, send);
    }
  } catch {
    // Unsupported/denied Web Locks must not stop the result page.
  }
  return send();
}
