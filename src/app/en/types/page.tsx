import type { Metadata } from "next";
import TypesGalleryPage from "@/components/types/TypesGalleryPage";
import {
  EN_BRAND_NAME,
  EN_DEFAULT_OG_IMAGE,
  SITE_URL,
} from "@/lib/locale-seo";

const TITLE = `32 Personality Types | ${EN_BRAND_NAME}`;
const DESCRIPTION = "Explore all 32 Alice Personalities character types created from the five dimensions of the Big Five personality model.";
const URL = `${SITE_URL}/en/types`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/en/types", languages: { "ja-JP": "/types", "ko-KR": "/ko/types", "en-US": "/en/types", "id-ID": "/id/types", "x-default": "/types" } },
  openGraph: { type: "website", locale: "en_US", alternateLocale: ["ja_JP", "ko_KR"], url: URL, siteName: EN_BRAND_NAME, title: TITLE, description: DESCRIPTION, images: [EN_DEFAULT_OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

export default function EnglishTypesPage() {
  return <TypesGalleryPage locale="en" />;
}
