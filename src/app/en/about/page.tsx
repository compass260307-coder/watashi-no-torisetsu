import type { Metadata } from "next";
import AboutPageContent from "@/components/about/AboutPageContent";
import {
  EN_BRAND_NAME,
  EN_DEFAULT_OG_IMAGE,
  localizedAlternates,
  SITE_URL,
} from "@/lib/locale-seo";

const TITLE = `About ${EN_BRAND_NAME} | Big Five Personality Test`;
const DESCRIPTION = "Learn how Alice Personalities combines a Big Five personality test with friend perspectives to help you see yourself more clearly.";
const URL = `${SITE_URL}/en/about`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: localizedAlternates(
    "en",
    "/about",
    "/ko/about",
    "/en/about",
    "/id/about",
  ),
  openGraph: { type: "website", locale: "en_US", alternateLocale: ["ja_JP", "ko_KR"], url: URL, siteName: EN_BRAND_NAME, title: TITLE, description: DESCRIPTION, images: [EN_DEFAULT_OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
  robots: { index: true, follow: true },
};

export default function EnglishAboutPage() {
  return <AboutPageContent locale="en" />;
}
