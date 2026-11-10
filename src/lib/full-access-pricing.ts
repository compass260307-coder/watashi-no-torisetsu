import {
  EN_FULL_ACCESS_LIST_PRICE_USD_CENTS,
  EN_FULL_ACCESS_PRICE_USD_CENTS,
  formatIdrMinor,
  FULL_ACCESS_LIST_PRICE_JPY,
  FULL_ACCESS_LIST_PRICE_KRW,
  FULL_ACCESS_PRICE_JPY,
  FULL_ACCESS_PRICE_KRW,
  ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR,
  ID_FULL_ACCESS_PRICE_IDR_MINOR,
  SELF_REPORT_PRICE_KRW,
} from "./access-products";

// The keys identify the existing Stripe offers. UI language is independent.
export const FULL_ACCESS_PRICING = {
  ja: {
    currency: "jpy",
    saleAmount: FULL_ACCESS_PRICE_JPY,
    listAmount: FULL_ACCESS_LIST_PRICE_JPY,
    discountAmount: FULL_ACCESS_LIST_PRICE_JPY - FULL_ACCESS_PRICE_JPY,
  },
  ko: {
    currency: "krw",
    saleAmount: FULL_ACCESS_PRICE_KRW,
    listAmount: FULL_ACCESS_LIST_PRICE_KRW,
    discountAmount: FULL_ACCESS_LIST_PRICE_KRW - FULL_ACCESS_PRICE_KRW,
  },
  en: {
    currency: "usd",
    saleAmount: EN_FULL_ACCESS_PRICE_USD_CENTS,
    listAmount: EN_FULL_ACCESS_LIST_PRICE_USD_CENTS,
    discountAmount: EN_FULL_ACCESS_LIST_PRICE_USD_CENTS - EN_FULL_ACCESS_PRICE_USD_CENTS,
  },
  id: {
    currency: "idr",
    saleAmount: ID_FULL_ACCESS_PRICE_IDR_MINOR,
    listAmount: ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR,
    discountAmount: ID_FULL_ACCESS_LIST_PRICE_IDR_MINOR - ID_FULL_ACCESS_PRICE_IDR_MINOR,
  },
} as const;

export const FULL_ACCESS_REGION_OFFER_VERSION = "web_full_access_ip_market_v1";

export type FullAccessMarket = keyof typeof FULL_ACCESS_PRICING;
export type FullAccessQuote = { market: FullAccessMarket; amountMinor: number };

export function fullAccessMarketForCountry(country: string | null): FullAccessMarket {
  switch (country) {
    case "JP": return "ja";
    case "KR": return "ko";
    case "ID": return "id";
    default: return "en";
  }
}

export function fullAccessQuoteForMarket(
  market: FullAccessMarket,
  koreanSelfReport: boolean,
): FullAccessQuote {
  const amountMinor = market === "ko" && koreanSelfReport
    ? FULL_ACCESS_PRICE_KRW - SELF_REPORT_PRICE_KRW
    : FULL_ACCESS_PRICING[market].saleAmount;
  return { market, amountMinor };
}

export function isFullAccessMarket(value: unknown): value is FullAccessMarket {
  return typeof value === "string" && Object.hasOwn(FULL_ACCESS_PRICING, value);
}

export function formatFullAccessAmount(market: FullAccessMarket, amountMinor: number): string {
  switch (market) {
    case "ja": return `¥${amountMinor.toLocaleString("ja-JP")}`;
    case "ko": return `₩${amountMinor.toLocaleString("ko-KR")}`;
    case "id": return formatIdrMinor(amountMinor);
    case "en": return `US$${(amountMinor / 100).toFixed(2)}`;
  }
}
