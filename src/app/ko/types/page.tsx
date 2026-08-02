import type { Metadata } from "next";
import TypesGalleryPage from "@/components/types/TypesGalleryPage";
import { KO_TYPES_COPY } from "@/i18n/ko/types";
import {
  KO_DEFAULT_OG_IMAGE,
  KO_SEO_KEYWORDS,
  KO_SITE_NAME,
} from "@/lib/locale-seo";

const BASE_URL = "https://www.watashi-torisetsu.com";

export const metadata: Metadata = {
  title: KO_TYPES_COPY.title,
  description: KO_TYPES_COPY.description,
  keywords: [
    ...KO_SEO_KEYWORDS,
    "성격 유형",
    "32가지 성격 유형",
    "빅파이브 유형",
    "캐릭터 성격 테스트",
  ],
  alternates: {
    canonical: "/ko/types",
    languages: {
      "ja-JP": `${BASE_URL}/types`,
      "ko-KR": `${BASE_URL}/ko/types`,
      "x-default": `${BASE_URL}/types`,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    url: `${BASE_URL}/ko/types`,
    siteName: KO_SITE_NAME,
    title: `${KO_TYPES_COPY.title} | 나의 사용설명서`,
    description: KO_TYPES_COPY.description,
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${KO_TYPES_COPY.title} | 나의 사용설명서`,
    description: KO_TYPES_COPY.description,
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function KoreanTypesPage() {
  return <TypesGalleryPage locale="ko" />;
}
