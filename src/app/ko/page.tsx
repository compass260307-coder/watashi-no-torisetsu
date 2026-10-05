import type { Metadata } from "next";
import HomeSessionRedirect from "@/components/top/HomeSessionRedirect";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/top/TopPurchaseHeader";
import KoTopHero from "@/components/ko/top/KoTopHero";
import KoTopStats from "@/components/ko/top/KoTopStats";
import { KoTopViewTracker } from "@/components/ko/top/KoTopAnalytics";
import {
  KO_BRAND_NAME,
  KO_CHARACTER_NAME,
  KO_DEFAULT_DESCRIPTION,
  KO_DEFAULT_OG_IMAGE,
  KO_DEFAULT_TITLE,
  KO_SEO_KEYWORDS,
  KO_SERVICE_NAME,
  KO_SITE_NAME,
  GLOBAL_SITE_NAME,
} from "@/lib/locale-seo";

const BASE_URL = "https://www.watashi-torisetsu.com";
const KO_URL = `${BASE_URL}/ko`;
const TITLE = KO_DEFAULT_TITLE;
const DESCRIPTION = KO_DEFAULT_DESCRIPTION;

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    ...KO_SEO_KEYWORDS,
    "무료 성격 진단",
    "성격 테스트",
    "Big Five",
    "빅파이브",
    "친구 진단",
    "32가지 성격 유형",
    "자기 이해",
  ],
  alternates: {
    canonical: KO_URL,
    languages: {
      "ja-JP": BASE_URL,
      "ko-KR": KO_URL,
      "en-US": `${BASE_URL}/en`,
      "id-ID": `${BASE_URL}/id`,
      "x-default": BASE_URL,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP", "en_US"],
    url: KO_URL,
    siteName: KO_SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${KO_URL}#app`,
      name: KO_SERVICE_NAME,
      alternateName: [
        `${KO_BRAND_NAME}의 ${KO_SERVICE_NAME}`,
        "앨리스 테스트",
        "Alice 진단",
        "Alice 테스트",
        "Big Five 성격 진단",
        "OCEAN 진단",
        "친구 진단",
      ],
      description: DESCRIPTION,
      url: KO_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      inLanguage: "ko-KR",
      isPartOf: { "@id": `${KO_URL}#website` },
      brand: { "@id": `${KO_URL}#brand` },
      publisher: { "@id": `${KO_URL}#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "KRW",
      },
      audience: {
        "@type": "Audience",
        audienceType: "대학생",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${KO_URL}#website`,
      name: GLOBAL_SITE_NAME,
      alternateName: [
        KO_BRAND_NAME,
        "앨리스 테스트",
        "Alice 진단",
        "Alice 테스트",
        KO_SERVICE_NAME,
      ],
      url: KO_URL,
      inLanguage: "ko-KR",
      publisher: { "@id": `${KO_URL}#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${KO_URL}#webpage`,
      name: TITLE,
      description: DESCRIPTION,
      url: KO_URL,
      inLanguage: "ko-KR",
      isPartOf: { "@id": `${KO_URL}#website` },
      about: { "@id": `${KO_URL}#brand` },
      mainEntity: { "@id": `${KO_URL}#app` },
      publisher: { "@id": `${KO_URL}#organization` },
    },
    {
      "@type": "Brand",
      "@id": `${KO_URL}#brand`,
      name: KO_BRAND_NAME,
      alternateName: KO_CHARACTER_NAME,
      url: KO_URL,
    },
    {
      "@type": "Organization",
      "@id": `${KO_URL}#organization`,
      name: "나의 사용설명서 운영팀",
      alternateName: "앨리스 진단 운영팀",
      url: KO_URL,
      brand: { "@id": `${KO_URL}#brand` },
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon.png`,
      },
    },
  ],
};

export default function KoreanHomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <HomeSessionRedirect localePrefix="/ko" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <KoTopViewTracker />
      <KoTopHeader locale="ko" />
      <KoTopHero />
      <section aria-labelledby="ko-service-intro" className="bg-white px-6 py-10 text-center sm:py-14">
        <div className="mx-auto max-w-[720px]">
          <h2 id="ko-service-intro" className="break-keep text-xl font-bold text-[#2E2E5C] sm:text-2xl">
            앨리스 진단으로 알아보는 나의 성격
          </h2>
          <p className="mt-4 break-keep text-base leading-relaxed text-[#5D6078] sm:text-lg">
            {DESCRIPTION}
          </p>
        </div>
      </section>
      <KoTopStats />
      <KoTopFooter />
    </main>
  );
}
