"use client";

import { useEffect, useState } from "react";
import type { AppResultLocale } from "@/i18n/result";
import { isFullAccessMarket, type FullAccessQuote } from "@/lib/full-access-pricing";

export type FullAccessQuoteState = { quote: FullAccessQuote | null; failed: boolean };

const inFlight = new Map<string, Promise<FullAccessQuote>>();
// 取得済みの見積り。市場判定は接続元IP由来でセッション中は変わらないため、
// 一度解決した価格はクライアント内ナビゲーションをまたいで再利用する
// (課金モーダル再マウント時の「—」表示を無くす)。
const resolved = new Map<string, FullAccessQuote>();

function quoteKey(locale: AppResultLocale, ownerToken?: string | null) {
  return JSON.stringify({ locale, owner_token: ownerToken || undefined });
}

function fetchQuote(locale: AppResultLocale, ownerToken?: string | null) {
  const body = quoteKey(locale, ownerToken);
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
    const quote: FullAccessQuote = { market, amountMinor };
    resolved.set(body, quote);
    return quote;
  }).finally(() => inFlight.delete(body));
  inFlight.set(body, request);
  return request;
}

// 解析待ち画面などから価格を先読みする。失敗は無視し、表示側の通常取得に任せる。
export function prefetchFullAccessQuote(locale: AppResultLocale, ownerToken?: string | null) {
  if (resolved.has(quoteKey(locale, ownerToken))) return;
  fetchQuote(locale, ownerToken).catch(() => {});
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
  } | null>(() => {
    // 取得済みならマウント直後から価格を表示する (「—」を出さない)。
    const cached = resolved.get(quoteKey(locale, ownerToken));
    return cached ? { locale, ownerToken, quote: cached, attempt } : null;
  });
  useEffect(() => {
    if (!enabled) return;
    const cached = resolved.get(quoteKey(locale, ownerToken));
    if (cached) {
      setResult({ locale, ownerToken, quote: cached, attempt });
      return;
    }
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
