import type { Metadata } from "next";
import DiagnosisPageContent from "@/components/diagnosis/DiagnosisPageContent";
import { EN_BRAND_NAME, EN_DEFAULT_OG_IMAGE } from "@/lib/locale-seo";

const TITLE = "Take the Alice Test – Free Big Five Personality Test";
const DESCRIPTION = "Answer 50 questions to discover your Big Five personality profile, match with one of 32 characters, and invite friends to share how they see you.";

export const metadata: Metadata = {
  title: { absolute: TITLE }, description: DESCRIPTION,
  alternates: { canonical: "/en/diagnosis", languages: { "ja-JP": "/diagnosis", "ko-KR": "/ko/diagnosis", "en-US": "/en/diagnosis", "x-default": "/diagnosis" } },
  openGraph: { type: "website", locale: "en_US", alternateLocale: ["ja_JP", "ko_KR"], url: "/en/diagnosis", siteName: EN_BRAND_NAME, title: TITLE, description: DESCRIPTION, images: [EN_DEFAULT_OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

export default function EnglishDiagnosisPage() {
  return <DiagnosisPageContent locale="en" />;
}
