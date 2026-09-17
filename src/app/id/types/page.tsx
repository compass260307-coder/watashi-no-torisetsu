import type { Metadata } from "next";
import TypesGalleryPage from "@/components/types/TypesGalleryPage";

export const metadata: Metadata = {
  title: "32 Tipe Kepribadian",
  description: "Jelajahi 32 tipe karakter Alice Test yang dibentuk dari lima dimensi Big Five.",
  alternates: { canonical: "/id/types", languages: { "ja-JP": "/types", "ko-KR": "/ko/types", "en-US": "/en/types", "id-ID": "/id/types", "x-default": "/types" } },
};

export default function IndonesianTypesPage() {
  return <TypesGalleryPage locale="id" />;
}
