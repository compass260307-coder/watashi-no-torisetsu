"use client";

import type { AppResultLocale } from "@/i18n/result";
import { use } from "react";
import ja from "./navigation/ja";
import type { NavigationCopy } from "./navigation-types";
import { preloadLocalizedPurchaseCopy } from "./purchase-copy-loader";

export function useNavigationCopy(locale: AppResultLocale): NavigationCopy {
  if (locale === "ja") return ja;
  // Keep the existing locale dictionary shared by navigation and checkout.
  // Splitting a few KiB into extra requests would hurt the direct TOP funnel.
  return use(preloadLocalizedPurchaseCopy(locale));
}
export function useNavigationText(locale: AppResultLocale, section: string) {
  const labels = useNavigationCopy(locale).labels[section];
  return (key: string, values: Record<string, string | number> = {}): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), labels[key]);
}
