import type { Metadata } from "next";
import TypesGalleryPage from "@/components/types/TypesGalleryPage";
import { KO_TYPES_COPY } from "@/i18n/ko/types";
import {
  KO_BRAND_NAME,
  KO_DEFAULT_OG_IMAGE,
  KO_SEO_KEYWORDS,
  KO_SITE_NAME,
} from "@/lib/locale-seo";

const BASE_URL = "https://www.watashi-torisetsu.com";
const TITLE = `32가지 성격 유형 | ${KO_BRAND_NAME}`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
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
      "en-US": `${BASE_URL}/en/types`,
      "id-ID": `${BASE_URL}/id/types`,
      "x-default": `${BASE_URL}/types`,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    url: `${BASE_URL}/ko/types`,
    siteName: KO_SITE_NAME,
    title: TITLE,
    description: KO_TYPES_COPY.description,
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: KO_TYPES_COPY.description,
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function KoreanTypesPage() {
  return <TypesGalleryPage locale="ko" />;
}
