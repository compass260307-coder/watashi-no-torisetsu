import type { Metadata } from "next";
import { redirect } from "next/navigation";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import KoTopHero from "@/components/ko/top/KoTopHero";
import KoTopStats from "@/components/ko/top/KoTopStats";
import { KoTopViewTracker } from "@/components/ko/top/KoTopAnalytics";
import {
  KO_DEFAULT_DESCRIPTION,
  KO_DEFAULT_OG_IMAGE,
  KO_DEFAULT_TITLE,
  KO_SEO_KEYWORDS,
  KO_SITE_NAME,
} from "@/lib/locale-seo";
import { getSession } from "@/lib/session";

const BASE_URL = "https://www.watashi-torisetsu.com";
const KO_URL = `${BASE_URL}/ko`;
const TITLE = KO_DEFAULT_TITLE;
const DESCRIPTION = KO_DEFAULT_DESCRIPTION;

export const dynamic = "force-dynamic";

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
      "x-default": BASE_URL,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
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
      name: `${KO_SITE_NAME} 무료 성격 진단 테스트`,
      alternateName: ["Big Five 성격 진단", "OCEAN 진단", "친구 진단"],
      description: DESCRIPTION,
      url: KO_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      inLanguage: "ko-KR",
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
      name: KO_SITE_NAME,
      alternateName: [
        "무료 성격 진단 테스트",
        "빅파이브 성격 테스트",
        "OCEAN 성격검사",
        "친구 성격 진단",
      ],
      url: KO_URL,
      inLanguage: "ko-KR",
      publisher: { "@id": `${BASE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "나의 사용설명서 운영팀",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon.png`,
      },
    },
  ],
};

export default async function KoreanHomePage({
  searchParams,
}: {
  searchParams: Promise<{ stay?: string }>;
}) {
  const { stay } = await searchParams;

  if (stay !== "1") {
    const session = await getSession();
    if (session?.owner_token) {
      redirect(`/ko/me/${encodeURIComponent(session.owner_token)}`);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <KoTopViewTracker />
      <KoTopHeader />
      <KoTopHero />
      <KoTopStats />
      <KoTopFooter />
    </main>
  );
}
