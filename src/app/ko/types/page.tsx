import type { Metadata } from "next";
import TypesGalleryPage from "@/components/types/TypesGalleryPage";
import { KO_TYPES_COPY } from "@/i18n/ko/types";

const BASE_URL = "https://www.watashi-torisetsu.com";

export const metadata: Metadata = {
  title: KO_TYPES_COPY.title,
  description: KO_TYPES_COPY.description,
  alternates: {
    canonical: "/ko/types",
    languages: {
      "ja-JP": `${BASE_URL}/types`,
      "ko-KR": `${BASE_URL}/ko/types`,
      "x-default": `${BASE_URL}/types`,
    },
  },
  openGraph: {
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    url: `${BASE_URL}/ko/types`,
    title: `${KO_TYPES_COPY.title} | 나의 사용설명서`,
    description: KO_TYPES_COPY.description,
  },
};

export default function KoreanTypesPage() {
  return <TypesGalleryPage locale="ko" />;
}
