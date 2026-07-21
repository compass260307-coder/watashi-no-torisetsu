import type { Metadata } from "next";
import {
  DIAGNOSIS_SEO_DESCRIPTION,
  DIAGNOSIS_SEO_TITLE,
} from "@/lib/diagnosis-seo";

const BASE_URL = "https://www.watashi-torisetsu.com";

export const metadata: Metadata = {
  title: DIAGNOSIS_SEO_TITLE,
  description: DIAGNOSIS_SEO_DESCRIPTION,
  alternates: { canonical: "/diagnosis" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: `${BASE_URL}/diagnosis`,
    siteName: "ワタシのトリセツ",
    title: `${DIAGNOSIS_SEO_TITLE}｜ワタシのトリセツ`,
    description: DIAGNOSIS_SEO_DESCRIPTION,
    images: [
      {
        url: "/ogp-v4.png",
        width: 1200,
        height: 630,
        alt: "ワタシのトリセツの無料性格診断テスト",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${DIAGNOSIS_SEO_TITLE}｜ワタシのトリセツ`,
    description: DIAGNOSIS_SEO_DESCRIPTION,
    images: ["/ogp-v4.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${BASE_URL}/diagnosis#app`,
      name: "ワタシのトリセツ 無料性格診断テスト",
      alternateName: "OCEAN(ビッグファイブ)診断",
      url: `${BASE_URL}/diagnosis`,
      description: DIAGNOSIS_SEO_DESCRIPTION,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      inLanguage: "ja-JP",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "JPY",
      },
    },
  ],
};

export default function DiagnosisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {children}
    </>
  );
}
