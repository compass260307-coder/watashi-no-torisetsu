import type { Metadata } from "next";
import DiagnosisPageContent from "@/components/diagnosis/DiagnosisPageContent";

const BASE_URL = "https://www.watashi-torisetsu.com";
const KO_DIAGNOSIS_URL = `${BASE_URL}/ko/diagnosis`;
const TITLE = "무료 성격 진단 테스트 | 나의 사용설명서";
const DESCRIPTION =
  "Big Five 이론을 바탕으로 한 50문항 무료 성격 진단이에요. OCEAN 성격 특성을 분석해 32가지 캐릭터 유형 중 나와 닮은 유형을 찾아보세요.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: KO_DIAGNOSIS_URL,
    languages: {
      "ja-JP": `${BASE_URL}/diagnosis`,
      "ko-KR": KO_DIAGNOSIS_URL,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    url: KO_DIAGNOSIS_URL,
    siteName: "나의 사용설명서",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/mascot/diagnosis-hero.png",
        width: 1448,
        height: 1086,
        alt: "나의 사용설명서 무료 성격 진단",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/mascot/diagnosis-hero.png"],
  },
  // 韓国語の結果・規約・プライバシーが揃うまでは検索公開しない。
  robots: { index: false, follow: false },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "나의 사용설명서 무료 성격 진단 테스트",
  url: KO_DIAGNOSIS_URL,
  description: DESCRIPTION,
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Any",
  inLanguage: "ko-KR",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "KRW",
  },
};

export default function KoreanDiagnosisPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <DiagnosisPageContent locale="ko" />
    </>
  );
}
