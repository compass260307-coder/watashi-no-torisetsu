export const X_DIAGNOSIS_COMPLETE_EVENT_ID = "tw-rg1zg-rg1zv";
export const X_PURCHASE_EVENT_ID = "tw-rg1zg-rg1zz";
export const X_DIAGNOSIS_PENDING_PREFIX = "wt_x_diagnosis_pending_v1:";

export type XEventParams = {
  conversion_id: string;
  value?: number;
  currency?: string;
};

declare global {
  interface Window {
    twq?: (command: "event", eventId: string, params: XEventParams) => void;
  }
}

export function trackX(eventId: string, params: XEventParams): void {
  if (typeof window === "undefined" || typeof window.twq !== "function") return;
  try {
    window.twq("event", eventId, params);
  } catch {
    // A blocked or failing advertising tag must not interrupt the result page.
  }
}
