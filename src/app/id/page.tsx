import type { Metadata } from "next";
import IdTopPage from "@/components/id/IdTopPage";
import HomeSessionRedirect from "@/components/top/HomeSessionRedirect";
import { SITE_URL } from "@/lib/locale-seo";

const TITLE = "Tes Kepribadian Big Five Gratis | Alice Test";
const DESCRIPTION = "Kenali diri lewat 50 pertanyaan dan temukan satu dari 32 tipe karakter berdasarkan model Big Five.";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/id", languages: { "ja-JP": "/", "ko-KR": "/ko", "en-US": "/en", "id-ID": "/id", "x-default": "/" } },
  openGraph: { type: "website", locale: "id_ID", alternateLocale: ["ja_JP", "ko_KR", "en_US"], url: `${SITE_URL}/id`, siteName: "Alice Test", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

export default function IndonesianHome() {
  return (
    <>
      <HomeSessionRedirect localePrefix="/id" />
      <IdTopPage />
    </>
  );
}
