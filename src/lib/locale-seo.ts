import type { Metadata, MetadataRoute } from "next";

export const SITE_URL = "https://www.watashi-torisetsu.com";
export const JA_SITE_NAME = "ワタシのトリセツ";
export const EN_BRAND_NAME = "Alice Personalities";
export const EN_DEFAULT_TITLE = `${EN_BRAND_NAME} | Free Big Five Personality Test`;
export const EN_DEFAULT_DESCRIPTION =
  "Alice Personalities is a free 50-question Big Five personality test with 32 character types and friend feedback to compare how you see yourself with how others see you.";
export const EN_SEO_KEYWORDS: string[] = [
  "Alice Personalities",
  "Alice Test",
  "Alice personality test",
  "Alice Big Five test",
  "free personality test",
  "Big Five personality test",
  "OCEAN personality test",
  "32 personality types",
  "personality test with friends",
  "friend personality test",
  "self discovery",
];
export const EN_DEFAULT_OG_IMAGE = {
  url: "/characters/keyvisual.webp",
  width: 1536,
  height: 1024,
  alt: "Alice Personalities Big Five personality characters",
};
export const EN_HOME_FAQS = [
  {
    question: "What is Alice Personalities?",
    answer:
      "Alice Personalities is a 50-question personality test based on the Big Five, also called the OCEAN model. It turns your five trait scores into one of 32 memorable character types.",
  },
  {
    question: "Is the personality test free?",
    answer:
      "Yes. You can take the core personality test and receive your result for free. Optional paid content may be offered separately.",
  },
  {
    question: "Is this an MBTI test?",
    answer:
      "No. MBTI-style tests use preference categories, while this test measures the continuous Big Five traits: Openness, Conscientiousness, Extraversion, Agreeableness, and Neuroticism.",
  },
  {
    question: "How long does the test take?",
    answer:
      "Most people can answer the 50 questions in about three minutes. There are no right or wrong answers.",
  },
  {
    question: "How does friend feedback work?",
    answer:
      "After completing your test, you can invite people who know you to answer a shorter set of questions. Their perspective helps you compare your self-image with how others experience you.",
  },
  {
    question: "Is this a medical or psychological diagnosis?",
    answer:
      "No. The experience is designed for entertainment and self-reflection. It does not diagnose a medical or mental-health condition and is not a substitute for professional advice.",
  },
] as const;
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

export type LocalizedSeoLocale = "ja" | "ko" | "en" | "id";
type SitemapChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]["changeFrequency"]
>;

export type LocalizedRoutePair = {
  ja: string;
  ko: string;
  en?: string;
  id?: string;
  priority?: number;
  changeFrequency?: SitemapChangeFrequency;
};

export const INDEXABLE_LOCALIZED_ROUTES: readonly LocalizedRoutePair[] = [
  { ja: "/", ko: "/ko", en: "/en", id: "/id", priority: 1, changeFrequency: "weekly" },
  { ja: "/about", ko: "/ko/about", en: "/en/about", id: "/id/about", priority: 0.8, changeFrequency: "monthly" },
  {
    ja: "/diagnosis",
    ko: "/ko/diagnosis",
    en: "/en/diagnosis",
    id: "/id/diagnosis",
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    ja: "/types",
    ko: "/ko/types",
    en: "/en/types",
    id: "/id/types",
    priority: 0.8,
    changeFrequency: "weekly",
  },
  { ja: "/aisho", ko: "/ko/aisho", en: "/en/aisho", id: "/id/aisho", priority: 0.8, changeFrequency: "monthly" },
  { ja: "/unmei", ko: "/ko/unmei", en: "/en/unmei", id: "/id/unmei", priority: 0.8, changeFrequency: "monthly" },
  {
    ja: "/articles",
    ko: "/ko/articles",
    en: "/en/articles",
    id: "/id/articles",
    priority: 0.7,
    changeFrequency: "weekly",
  },
  { ja: "/terms", ko: "/ko/terms", en: "/en/terms", id: "/id/terms", priority: 0.3, changeFrequency: "yearly" },
  {
    ja: "/privacy",
    ko: "/ko/privacy",
    en: "/en/privacy",
    id: "/id/privacy",
    priority: 0.3,
    changeFrequency: "yearly",
  },
  {
    ja: "/legal/commerce",
    ko: "/ko/legal/commerce",
    en: "/en/legal/commerce",
    id: "/id/legal/commerce",
    priority: 0.3,
    changeFrequency: "yearly",
  },
] as const;

export function absoluteSiteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

export function localizedLanguages(
  jaPath: string,
  koPath: string,
  enPath?: string,
  idPath?: string,
) {
  return {
    "ja-JP": absoluteSiteUrl(jaPath),
    "ko-KR": absoluteSiteUrl(koPath),
    ...(enPath ? { "en-US": absoluteSiteUrl(enPath) } : {}),
    ...(idPath ? { "id-ID": absoluteSiteUrl(idPath) } : {}),
    "x-default": absoluteSiteUrl(jaPath),
  };
}

export function localizedAlternates(
  locale: LocalizedSeoLocale,
  jaPath: string,
  koPath: string,
  enPath?: string,
  idPath?: string,
): NonNullable<Metadata["alternates"]> {
  return {
    canonical:
      locale === "ko"
        ? koPath
        : locale === "en" && enPath
          ? enPath
          : locale === "id" && idPath
            ? idPath
            : jaPath,
    languages: localizedLanguages(jaPath, koPath, enPath, idPath),
  };
}
