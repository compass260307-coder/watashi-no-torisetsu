import type { Metadata } from "next";
import { redirect } from "next/navigation";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import KoTopHero from "@/components/ko/top/KoTopHero";
import KoTopStats from "@/components/ko/top/KoTopStats";
import { KoTopViewTracker } from "@/components/ko/top/KoTopAnalytics";
import { KO_TOP_CONTENT } from "@/i18n/ko/top";
import { getSession } from "@/lib/session";

const BASE_URL = "https://www.watashi-torisetsu.com";
const KO_URL = `${BASE_URL}/ko`;
const TITLE = "친구와 함께 만드는 무료 성격 진단 | 나의 사용설명서";
const DESCRIPTION =
  "Big Five 이론을 바탕으로 한 무료 성격 진단이에요. 50문항으로 32가지 캐릭터 유형 중 나와 닮은 유형을 찾고, 친구의 답변으로 나도 몰랐던 모습을 발견해 보세요.";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
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
    siteName: KO_TOP_CONTENT.siteName,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/characters/keyvisual.webp",
        width: 1536,
        height: 1024,
        alt: "나의 사용설명서 캐릭터",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/characters/keyvisual.webp"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: KO_TOP_CONTENT.siteName,
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
