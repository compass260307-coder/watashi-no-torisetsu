"use client";

import type { AppResultLocale } from "@/i18n/result";
import { use } from "react";
import ja from "./messages/ja";
import type { PurchaseUiCopy } from "./types";
import { preloadLocalizedPurchaseCopy } from "./purchase-copy-loader";

// Japanese is available synchronously, including all payment copy. Do not
// eagerly create the other promises: that would download every language again.
export function preloadUiCopy(locale: AppResultLocale): Promise<PurchaseUiCopy> {
  if (locale === "ja") return Promise.resolve(ja);
  return preloadLocalizedPurchaseCopy(locale);
}

export function useUiCopy(locale: AppResultLocale): PurchaseUiCopy {
  if (locale === "ja") return ja;
  const promise = preloadLocalizedPurchaseCopy(locale);
  return use(promise);
}

export function useUiText(locale: AppResultLocale, section: string) {
  const labels = useUiCopy(locale).labels[section];
  return (key: string, values: Record<string, string | number> = {}): string =>
    Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      labels[key],
    );
}
