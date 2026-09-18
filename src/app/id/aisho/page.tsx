import type { Metadata } from "next";
import AishoPage from "@/components/aisho/AishoPage";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Kecocokan",
  description: "Pilih dua dari 32 tipe kepribadian dan lihat cara hubungan mereka bekerja.",
  alternates: localizedAlternates("id", "/aisho", "/ko/aisho", "/en/aisho", "/id/aisho"),
  openGraph: {
    title: "Tes Kecocokan | Alice Test",
    description:
      "Pilih dua dari 32 tipe kepribadian dan lihat keseimbangan, kekuatan, serta kecocokan mereka dalam berbagai situasi.",
    url: "/id/aisho",
    type: "website",
    images: [
      {
        url: "/ogp-v5.jpg",
        width: 1200,
        height: 630,
        alt: "Tes Kecocokan Alice Test",
      },
    ],
  },
};

export default function IndonesianCompatibilityPage() {
  return <AishoPage locale="id" />;
}
