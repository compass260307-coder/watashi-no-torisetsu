export const SUPPORTED_LOCALES = ["ja", "ko"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ja";

export const LOCALE_LABELS: Record<Locale, string> = {
  ja: "日本語",
  ko: "한국어",
};

export function localePath(locale: Locale, pathname = "/"): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (locale === DEFAULT_LOCALE) return normalized;
  if (normalized === "/") return `/${locale}`;
  return `/${locale}${normalized}`;
}
