import type { Metadata } from "next";
import AishoPage from "@/components/aisho/AishoPage";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Kecocokan",
  description: "Pilih dua dari 32 tipe kepribadian dan lihat cara hubungan mereka bekerja.",
  alternates: localizedAlternates("id", "/aisho", "/ko/aisho", "/en/aisho", "/id/aisho"),
};

export default function IndonesianCompatibilityPage() {
  return <AishoPage locale="id" />;
}
