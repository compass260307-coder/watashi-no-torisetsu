// Phase 2: publish transport-gated GTM tags BEFORE releasing this version.
// Stage-1 documents keep x_transport=direct and their direct X delivery.
export const X_MEASUREMENT_TRANSPORT: "direct" | "gtm" = "gtm";
export const MEASUREMENT_INIT_SCRIPT = `window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'measurement_ready',x_transport:'${X_MEASUREMENT_TRANSPORT}',measurement_version:1});`;

type VerifiedEvent = "purchase_verified" | "diagnosis_completed";
type VerifiedParams = { conversion_id: string; value?: number; currency?: string };
const sent = new Set<string>();

// Called only inside the existing verified-purchase / saved-diagnosis gates.
// Reuse the same action ID for direct X and the eventual GTM hand-off. Never
// put owner/session auth tokens, email, or the raw Checkout URL in dataLayer.
export function pushVerifiedConversion(event: VerifiedEvent, params: VerifiedParams): boolean {
  if (typeof window === "undefined" || !params.conversion_id) return false;
  const key = `wt_verified_handoff_v1:${X_MEASUREMENT_TRANSPORT}:${event}:${params.conversion_id}`;
  if (sent.has(key)) return true;
  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      if (window[storageName].getItem(key) === "1") return true;
    } catch { /* Storage restrictions must not stop measurement or checkout. */ }
  }
  try {
    const target = window as typeof window & { dataLayer?: Record<string, unknown>[] };
    target.dataLayer = target.dataLayer ?? [];
    target.dataLayer.push({
      event,
      event_id: params.conversion_id,
      conversion_id: params.conversion_id,
      ...(event === "purchase_verified" ? { value: params.value, currency: params.currency } : {}),
      x_transport: X_MEASUREMENT_TRANSPORT,
      measurement_version: 1,
    });
    sent.add(key);
    for (const storageName of ["localStorage", "sessionStorage"] as const) {
      try { window[storageName].setItem(key, "1"); } catch { /* Keep memory guard. */ }
    }
    return true;
  } catch {
    // Leave the action unacknowledged so the existing retry can try again.
    return false;
  }
}
