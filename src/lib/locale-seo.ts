import type { Metadata } from "next";

export const SITE_URL = "https://www.watashi-torisetsu.com";

export type LocalizedSeoLocale = "ja" | "ko";

export type LocalizedRoutePair = {
  ja: string;
  ko: string;
  priority?: number;
};

export const INDEXABLE_LOCALIZED_ROUTES: readonly LocalizedRoutePair[] = [
  { ja: "/", ko: "/ko", priority: 1 },
  { ja: "/about", ko: "/ko/about", priority: 0.8 },
  { ja: "/diagnosis", ko: "/ko/diagnosis", priority: 1 },
  { ja: "/types", ko: "/ko/types", priority: 0.8 },
  { ja: "/aisho", ko: "/ko/aisho", priority: 0.8 },
  { ja: "/articles", ko: "/ko/articles", priority: 0.7 },
  { ja: "/terms", ko: "/ko/terms", priority: 0.3 },
  { ja: "/privacy", ko: "/ko/privacy", priority: 0.3 },
  {
    ja: "/legal/commerce",
    ko: "/ko/legal/commerce",
    priority: 0.3,
  },
] as const;

export function absoluteSiteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

export function localizedLanguages(jaPath: string, koPath: string) {
  return {
    "ja-JP": absoluteSiteUrl(jaPath),
    "ko-KR": absoluteSiteUrl(koPath),
    "x-default": absoluteSiteUrl(jaPath),
  };
}

export function localizedAlternates(
  locale: LocalizedSeoLocale,
  jaPath: string,
  koPath: string,
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: locale === "ko" ? koPath : jaPath,
    languages: localizedLanguages(jaPath, koPath),
  };
}
