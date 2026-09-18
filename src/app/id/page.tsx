import type { Metadata } from "next";
import IdTopPage from "@/components/id/IdTopPage";
import HomeSessionRedirect from "@/components/top/HomeSessionRedirect";
import { SITE_URL } from "@/lib/locale-seo";

const TITLE = "Tes Kepribadian Big Five Gratis | Alice Test";
const DESCRIPTION = "Kenali diri lewat 50 pertanyaan dan temukan satu dari 32 tipe karakter berdasarkan model Big Five.";
const ID_URL = `${SITE_URL}/id`;

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/id", languages: { "ja-JP": "/", "ko-KR": "/ko", "en-US": "/en", "id-ID": "/id", "x-default": "/" } },
  openGraph: { type: "website", locale: "id_ID", alternateLocale: ["ja_JP", "ko_KR", "en_US"], url: `${SITE_URL}/id`, siteName: "Alice Test", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${ID_URL}#app`,
      name: "Alice Personalities",
      alternateName: ["Alice Test", "Tes Big Five", "Tes Kepribadian OCEAN"],
      description: DESCRIPTION,
      url: ID_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      inLanguage: "id-ID",
      isPartOf: { "@id": `${ID_URL}#website` },
      brand: { "@id": `${ID_URL}#brand` },
      publisher: { "@id": `${ID_URL}#organization` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
      audience: { "@type": "Audience", audienceType: "Mahasiswa dan dewasa muda" },
    },
    {
      "@type": "WebSite",
      "@id": `${ID_URL}#website`,
      name: "Alice Personalities",
      alternateName: ["Alice Test", "Tes Kepribadian Alice"],
      url: ID_URL,
      inLanguage: "id-ID",
      publisher: { "@id": `${ID_URL}#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${ID_URL}#webpage`,
      name: TITLE,
      description: DESCRIPTION,
      url: ID_URL,
      inLanguage: "id-ID",
      isPartOf: { "@id": `${ID_URL}#website` },
      about: { "@id": `${ID_URL}#brand` },
      mainEntity: { "@id": `${ID_URL}#app` },
      publisher: { "@id": `${ID_URL}#organization` },
    },
    { "@type": "Brand", "@id": `${ID_URL}#brand`, name: "Alice Personalities", alternateName: "Alice Test", url: ID_URL },
    {
      "@type": "Organization",
      "@id": `${ID_URL}#organization`,
      name: "Tim Alice Personalities",
      url: ID_URL,
      brand: { "@id": `${ID_URL}#brand` },
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png` },
    },
  ],
};

export default function IndonesianHome() {
  return (
    <>
      <HomeSessionRedirect localePrefix="/id" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <IdTopPage />
    </>
  );
}
