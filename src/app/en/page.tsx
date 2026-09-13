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
const ALTERNATE_NAMES = ["Alice Personality Test", "Alice Big Five Test"];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${URL}#app`,
      name: EN_BRAND_NAME,
      alternateName: ALTERNATE_NAMES,
      description: EN_DEFAULT_DESCRIPTION,
      url: URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      inLanguage: "en-US",
      isPartOf: { "@id": `${URL}#website` },
      brand: { "@id": `${URL}#brand` },
      publisher: { "@id": `${URL}#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${URL}#website`,
      name: EN_BRAND_NAME,
      alternateName: ALTERNATE_NAMES,
      description: EN_DEFAULT_DESCRIPTION,
      url: URL,
      inLanguage: "en-US",
      publisher: { "@id": `${URL}#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${URL}#webpage`,
      name: EN_DEFAULT_TITLE,
      description: EN_DEFAULT_DESCRIPTION,
      url: URL,
      inLanguage: "en-US",
      isPartOf: { "@id": `${URL}#website` },
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
      "@id": `${URL}#brand`,
      name: EN_BRAND_NAME,
      alternateName: "Alice",
      url: URL,
    },
    {
      "@type": "Organization",
      "@id": `${URL}#organization`,
      name: "Alice Test Operations Team",
      url: URL,
      brand: { "@id": `${URL}#brand` },
      logo: `${SITE_URL}/logo.webp`,
    },
  ],
};

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: { absolute: EN_DEFAULT_TITLE }, description: EN_DEFAULT_DESCRIPTION,
  alternates: { canonical: "/en", languages: { "ja-JP": "/", "ko-KR": "/ko", "en-US": "/en", "x-default": "/" } },
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
