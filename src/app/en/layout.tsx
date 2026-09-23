import type { Metadata } from "next";
import { DocumentLanguage } from "@/components/DocumentLanguage";
import {
  EN_BRAND_NAME,
  EN_DEFAULT_DESCRIPTION,
  EN_DEFAULT_OG_IMAGE,
  EN_DEFAULT_TITLE,
  EN_SEO_KEYWORDS,
} from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: { default: EN_DEFAULT_TITLE, template: `%s | ${EN_BRAND_NAME}` },
  description: EN_DEFAULT_DESCRIPTION,
  applicationName: EN_BRAND_NAME,
  keywords: EN_SEO_KEYWORDS,
  authors: [{ name: EN_BRAND_NAME }],
  creator: EN_BRAND_NAME,
  publisher: EN_BRAND_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ja_JP", "ko_KR"],
    siteName: EN_BRAND_NAME,
    title: EN_DEFAULT_TITLE,
    description: EN_DEFAULT_DESCRIPTION,
    images: [EN_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: EN_DEFAULT_TITLE,
    description: EN_DEFAULT_DESCRIPTION,
    images: ["/characters/keyvisual.webp"],
  },
  robots: { index: true, follow: true },
};

export default function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <DocumentLanguage lang="en" />
      {children}
    </>
  );
}
