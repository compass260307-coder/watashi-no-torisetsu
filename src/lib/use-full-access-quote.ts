"use client";

import { useEffect, useState } from "react";
import type { AppResultLocale } from "@/i18n/result";
import { isFullAccessMarket, type FullAccessQuote } from "@/lib/full-access-pricing";

export type FullAccessQuoteState = { quote: FullAccessQuote | null; failed: boolean };

const inFlight = new Map<string, Promise<FullAccessQuote>>();

function fetchQuote(locale: AppResultLocale, ownerToken?: string | null) {
  const body = JSON.stringify({ locale, owner_token: ownerToken || undefined });
  const existing = inFlight.get(body);
  if (existing) return existing;
  const request = fetch("/api/checkout/full-access-price", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body,
  }).then(async (response): Promise<FullAccessQuote> => {
    if (!response.ok) throw new Error("Price unavailable");
    const { market, amountMinor } = await response.json();
    if (!isFullAccessMarket(market) || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error("Invalid price");
    }
    return { market, amountMinor };
  }).finally(() => inFlight.delete(body));
  inFlight.set(body, request);
  return request;
}

export function useFullAccessQuote(
  enabled: boolean,
  locale: AppResultLocale,
  ownerToken?: string | null,
  attempt = 0,
): FullAccessQuoteState {
  const [result, setResult] = useState<{
    locale: AppResultLocale;
    ownerToken?: string | null;
    quote: FullAccessQuote | null;
    attempt: number;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchQuote(locale, ownerToken).then(
      (quote) => { if (active) setResult({ locale, ownerToken, quote, attempt }); },
      () => { if (active) setResult({ locale, ownerToken, quote: null, attempt }); },
    );
    return () => { active = false; };
  }, [enabled, locale, ownerToken, attempt]);

  const current = enabled && result?.locale === locale && result.ownerToken === ownerToken && result.attempt === attempt
    ? result
    : null;
  return { quote: current?.quote ?? null, failed: current !== null && current.quote === null };
}

export function displayedFullAccessPrice(quote: FullAccessQuote | null | undefined) {
  return quote ? {
    displayed_price_market: quote.market,
    displayed_price_minor: quote.amountMinor,
  } : {};
}
