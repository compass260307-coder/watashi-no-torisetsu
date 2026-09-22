import type { Metadata } from "next";
import EnTopPage from "@/components/en/EnTopPage";
import HomeSessionRedirect from "@/components/top/HomeSessionRedirect";
import {
  EN_BRAND_NAME,
  EN_DEFAULT_DESCRIPTION,
  EN_DEFAULT_OG_IMAGE,
  EN_DEFAULT_TITLE,
  EN_HOME_FAQS,
  SITE_URL,
} from "@/lib/locale-seo";

const URL = `${SITE_URL}/en`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const BRAND_ID = `${SITE_URL}/#brand`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${URL}#app`,
      name: EN_BRAND_NAME,
      description: EN_DEFAULT_DESCRIPTION,
      url: URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      inLanguage: "en-US",
      isPartOf: { "@id": WEBSITE_ID },
      brand: { "@id": BRAND_ID },
      publisher: { "@id": ORGANIZATION_ID },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "WebPage",
      "@id": `${URL}#webpage`,
      name: EN_DEFAULT_TITLE,
      description: EN_DEFAULT_DESCRIPTION,
      url: URL,
      inLanguage: "en-US",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": `${URL}#app` },
      hasPart: { "@id": `${URL}#faq` },
    },
    {
      "@type": "FAQPage",
      "@id": `${URL}#faq`,
      mainEntity: EN_HOME_FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
    {
      "@type": "Brand",
      "@id": BRAND_ID,
      name: EN_BRAND_NAME,
      url: SITE_URL,
    },
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "Alice Personalities Operations Team",
      url: SITE_URL,
      brand: { "@id": BRAND_ID },
      logo: `${SITE_URL}/icon.png`,
    },
  ],
};

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: { absolute: EN_DEFAULT_TITLE }, description: EN_DEFAULT_DESCRIPTION,
  alternates: { canonical: "/en", languages: { "ja-JP": "/", "ko-KR": "/ko", "en-US": "/en", "id-ID": "/id", "x-default": "/" } },
  openGraph: { type: "website", locale: "en_US", alternateLocale: ["ja_JP", "ko_KR"], url: URL, siteName: EN_BRAND_NAME, title: EN_DEFAULT_TITLE, description: EN_DEFAULT_DESCRIPTION, images: [EN_DEFAULT_OG_IMAGE] },
  twitter: { card: "summary_large_image", title: EN_DEFAULT_TITLE, description: EN_DEFAULT_DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

export default function EnglishHome() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <HomeSessionRedirect localePrefix="/en" />
      <EnTopPage />
    </>
  );
}
