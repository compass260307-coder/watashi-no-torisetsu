import type { Metadata } from "next";
import KoResultPageClient from "@/components/ko/result/KoResultPageClient";
import { KO_RESULT_COPY } from "@/i18n/ko/result";

const BASE_URL = "https://www.watashi-torisetsu.com";
const KO_RESULT_URL = `${BASE_URL}/ko/result`;

export const metadata: Metadata = {
  title: { absolute: KO_RESULT_COPY.metadataTitle },
  description: KO_RESULT_COPY.metadataDescription,
  alternates: {
    canonical: KO_RESULT_URL,
    languages: {
      "ko-KR": KO_RESULT_URL,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: KO_RESULT_URL,
    siteName: "나의 사용설명서",
    title: KO_RESULT_COPY.metadataTitle,
    description: KO_RESULT_COPY.metadataDescription,
  },
  robots: { index: false, follow: false },
};

export default function KoreanResultPage() {
  return <KoResultPageClient />;
}
