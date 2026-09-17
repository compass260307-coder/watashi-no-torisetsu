import type { Metadata } from "next";
import AboutPageContent from "@/components/about/AboutPageContent";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Tentang Alice Test",
  description: "Pelajari bagaimana Alice Test menggabungkan Big Five dan penilaian teman untuk membantu Anda memahami diri dengan lebih jelas.",
  alternates: localizedAlternates("id", "/about", "/ko/about", "/en/about", "/id/about"),
};

export default function IndonesianAboutPage() {
  return <AboutPageContent locale="id" />;
}
