export type XPixelConfig = {
  id: string;
  locale?: "ko";
  diagnosis: { eventId: string; legacyEventIds?: readonly string[]; includeParams?: boolean };
  purchase: { eventId: string; currency?: string; includeParams?: boolean };
};

// Keep the verified rgg36 scope and legacy dedupe IDs. GTM owns X delivery.
export const ACTIVE_X_PIXELS: readonly XPixelConfig[] = [
  {
    id: "rgg36",
    diagnosis: { eventId: "tw-rgg36-rgg9b" },
    purchase: { eventId: "tw-rgg36-rgg3b", currency: "JPY", includeParams: true },
  },
];
