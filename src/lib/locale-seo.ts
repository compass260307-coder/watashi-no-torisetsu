import type { Metadata, MetadataRoute } from "next";

export const SITE_URL = "https://www.watashi-torisetsu.com";
export const JA_SITE_NAME = "ワタシのトリセツ";
export const KO_BRAND_NAME = "앨리스 진단";
export const KO_SERVICE_NAME = "나의 사용설명서";
export const KO_CHARACTER_NAME = "Alice";
export const KO_SITE_NAME = KO_BRAND_NAME;
export const KO_DEFAULT_TITLE = `${KO_BRAND_NAME} | ${KO_SERVICE_NAME}`;
export const KO_DEFAULT_DESCRIPTION =
  "앨리스 진단은 Alice가 안내하는 성격 진단이에요. 내 성격과 친구가 바라본 내 모습을 알아보고, 나만을 위한 ‘나의 사용설명서’를 만들어 보세요.";
export const KO_SEO_KEYWORDS: string[] = [
  "앨리스 진단",
  "앨리스 테스트",
  "Alice 진단",
  "Alice 테스트",
  "Alice",
  "나의 사용설명서",
  "무료 성격 진단",
  "무료 성격 테스트",
  "성격 진단 테스트",
  "성격 유형 테스트",
  "Big Five",
  "빅파이브",
  "OCEAN 진단",
  "OCEAN 성격검사",
  "친구 진단",
  "친구 성격 테스트",
  "32가지 성격 유형",
  "자기 이해",
  "자기 분석",
  "대학생 성격 테스트",
];
export const KO_DEFAULT_OG_IMAGE = {
  url: "/ogp-v5.jpg",
  width: 1200,
  height: 630,
  alt: "앨리스 진단 - Alice가 안내하는 나의 사용설명서 성격 테스트",
};

export type LocalizedSeoLocale = "ja" | "ko";
type SitemapChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]["changeFrequency"]
>;

export type LocalizedRoutePair = {
  ja: string;
  ko: string;
  priority?: number;
  changeFrequency?: SitemapChangeFrequency;
};

export const INDEXABLE_LOCALIZED_ROUTES: readonly LocalizedRoutePair[] = [
  { ja: "/", ko: "/ko", priority: 1, changeFrequency: "weekly" },
  { ja: "/about", ko: "/ko/about", priority: 0.8, changeFrequency: "monthly" },
  {
    ja: "/diagnosis",
    ko: "/ko/diagnosis",
    priority: 1,
    changeFrequency: "weekly",
  },
  { ja: "/types", ko: "/ko/types", priority: 0.8, changeFrequency: "weekly" },
  { ja: "/aisho", ko: "/ko/aisho", priority: 0.8, changeFrequency: "monthly" },
  { ja: "/unmei", ko: "/ko/unmei", priority: 0.8, changeFrequency: "monthly" },
  {
    ja: "/articles",
    ko: "/ko/articles",
    priority: 0.7,
    changeFrequency: "weekly",
  },
  { ja: "/terms", ko: "/ko/terms", priority: 0.3, changeFrequency: "yearly" },
  {
    ja: "/privacy",
    ko: "/ko/privacy",
    priority: 0.3,
    changeFrequency: "yearly",
  },
  {
    ja: "/legal/commerce",
    ko: "/ko/legal/commerce",
    priority: 0.3,
    changeFrequency: "yearly",
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
