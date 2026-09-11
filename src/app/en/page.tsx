import type { Metadata } from "next";
import EnTopPage from "@/components/en/EnTopPage";
import HomeSessionRedirect from "@/components/top/HomeSessionRedirect";

const URL = "https://www.watashi-torisetsu.com/en";
const TITLE = "Free Big Five Personality Test | Alice Diagnosis";
const DESCRIPTION = "Take a free 50-question Big Five personality test and discover which of 32 character types fits you best.";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: { absolute: TITLE }, description: DESCRIPTION,
  alternates: { canonical: "/en", languages: { "ja-JP": "/", "ko-KR": "/ko", "en-US": "/en", "x-default": "/" } },
  openGraph: { type: "website", locale: "en_US", alternateLocale: ["ja_JP", "ko_KR"], url: URL, title: TITLE, description: DESCRIPTION, images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024, alt: "Alice Diagnosis personality test characters" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

export default function EnglishHome() {
  return (
    <>
      <HomeSessionRedirect localePrefix="/en" />
      <EnTopPage />
    </>
  );
}
