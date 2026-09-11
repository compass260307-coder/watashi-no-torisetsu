import type { Metadata } from "next";
import DiagnosisPageContent from "@/components/diagnosis/DiagnosisPageContent";

const TITLE = "Free Big Five Personality Test | Alice Diagnosis";
const DESCRIPTION = "Answer 50 questions to explore your Big Five traits and discover your match among 32 personality characters.";

export const metadata: Metadata = {
  title: { absolute: TITLE }, description: DESCRIPTION,
  alternates: { canonical: "/en/diagnosis", languages: { "ja-JP": "/diagnosis", "ko-KR": "/ko/diagnosis", "en-US": "/en/diagnosis", "x-default": "/diagnosis" } },
  openGraph: { type: "website", locale: "en_US", alternateLocale: ["ja_JP", "ko_KR"], url: "/en/diagnosis", title: TITLE, description: DESCRIPTION, images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024, alt: "Alice Diagnosis personality test characters" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

export default function EnglishDiagnosisPage() {
  return <DiagnosisPageContent locale="en" />;
}
