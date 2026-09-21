import type { Metadata } from "next";
import AishoPage from "@/components/aisho/AishoPage";
import {
  EN_BRAND_NAME,
  EN_DEFAULT_OG_IMAGE,
  localizedAlternates,
  SITE_URL,
} from "@/lib/locale-seo";

const TITLE = `Personality Compatibility Test | ${EN_BRAND_NAME}`;
const DESCRIPTION = "Compare any two of the 32 Alice Personalities Big Five character types and explore their strengths, balance, and relationship dynamics.";
const URL = `${SITE_URL}/en/aisho`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: localizedAlternates(
    "en",
    "/aisho",
    "/ko/aisho",
    "/en/aisho",
    "/id/aisho",
  ),
  openGraph: { type: "website", locale: "en_US", alternateLocale: ["ja_JP", "ko_KR"], url: URL, siteName: EN_BRAND_NAME, title: TITLE, description: DESCRIPTION, images: [EN_DEFAULT_OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

export default function EnglishCompatibilityPage() {
  return <AishoPage locale="en" />;
}
