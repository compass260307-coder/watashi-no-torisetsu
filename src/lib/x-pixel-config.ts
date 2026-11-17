export type XPixelConfig = {
  id: string;
  locale?: "ko";
  diagnosis: { eventId: string; legacyEventIds?: readonly string[]; includeParams?: boolean };
  purchase: { eventId: string; currency?: string; includeParams?: boolean };
};

// Keep the verified rgg36 scope and legacy dedupe IDs. GTM owns X delivery:
// this list only decides WHICH verified actions are handed to dataLayer, and
// names the per-destination dedupe keys. The pixels GTM actually fires are
// configured in the GTM container (GTM-K39CJGCF), not here.
export const ACTIVE_X_PIXELS: readonly XPixelConfig[] = [
  {
    id: "rgg36",
    diagnosis: { eventId: "tw-rgg36-rgg9b" },
    purchase: { eventId: "tw-rgg36-rgg3b", currency: "JPY", includeParams: true },
  },
  // 韓国語 (2026-11-17)。公開 GTM (version 29) は /ko 配下で rj3sa の診断完了・購入タグを
  // 持っているが、サイトが渡す購入は JPY だけだったため、韓国語 Checkout (主に KRW) の購入が
  // X に届いていなかった。Stripe で検証済みの言語が ko の購入を、通貨を問わず dataLayer に渡す。
  // 日本向けの購入タグは GTM 側で currency == JPY かつ /ko 以外に限定されているため影響しない。
  {
    id: "rj3sa",
    locale: "ko",
    diagnosis: { eventId: "tw-rj3sa-rj3sf" },
    purchase: { eventId: "tw-rj3sa-rj3sg", includeParams: true },
  },
];
