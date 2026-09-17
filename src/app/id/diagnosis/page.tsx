import type { Metadata } from "next";
import DiagnosisPageContent from "@/components/diagnosis/DiagnosisPageContent";

const TITLE = "Ikuti Alice Test – Tes Kepribadian Big Five Gratis";
const DESCRIPTION = "Jawab 50 pertanyaan untuk melihat profil Big Five Anda dan menemukan karakter yang paling sesuai dari 32 tipe.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/id/diagnosis", languages: { "ja-JP": "/diagnosis", "ko-KR": "/ko/diagnosis", "en-US": "/en/diagnosis", "id-ID": "/id/diagnosis", "x-default": "/diagnosis" } },
  openGraph: { type: "website", locale: "id_ID", alternateLocale: ["ja_JP", "ko_KR", "en_US"], url: "/id/diagnosis", siteName: "Alice Test", title: TITLE, description: DESCRIPTION, images: ["/characters/keyvisual.webp"] },
};

export default function IndonesianDiagnosisPage() {
  return <DiagnosisPageContent locale="id" />;
}
