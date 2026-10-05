"use client";

import type { AppResultLocale } from "@/i18n/result";
import { useNavigationCopy } from "./use-navigation-copy";

// This small, shared diagnosis-link copy stays with navigation, avoiding a
// separate request per language. Question and result copy remain route-specific.
export function useDiagnosisText(locale: AppResultLocale, section: string) {
  const labels = useNavigationCopy(locale).labels[section];
  return (key: string, values: Record<string, string | number> = {}): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), labels[key]);
}
