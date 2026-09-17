import type { Metadata } from "next";
import TypesGalleryPage from "@/components/types/TypesGalleryPage";

export const metadata: Metadata = {
  title: "32 Personality Types",
  description: "Explore all 32 Alice Personalities character types created from the five dimensions of the Big Five personality model.",
  alternates: { canonical: "/en/types", languages: { "ja-JP": "/types", "ko-KR": "/ko/types", "en-US": "/en/types", "id-ID": "/id/types", "x-default": "/types" } },
};

export default function EnglishTypesPage() {
  return <TypesGalleryPage locale="en" />;
}
