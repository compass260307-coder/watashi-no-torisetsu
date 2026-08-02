import type { Metadata } from "next";
import {
  KO_DEFAULT_OG_IMAGE,
  KO_SITE_NAME,
  localizedAlternates,
} from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "궁합 진단",
  description:
    "궁금한 사람과의 궁합을 캐릭터 두 개만 골라 알아보세요. 내 진단 결과가 없어도 괜찮아요. 두 사람의 균형과 좋은 점, 상황별 궁합을 확인할 수 있어요.",
  alternates: localizedAlternates("ko", "/aisho", "/ko/aisho"),
  openGraph: {
    title: "궁합 진단｜나의 사용설명서",
    description:
      "궁금한 사람과의 궁합을 캐릭터 두 개만 골라 알아보세요. 내 진단 결과가 없어도 괜찮아요.",
    url: "/ko/aisho",
    siteName: KO_SITE_NAME,
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    type: "website",
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "궁합 진단｜나의 사용설명서",
    description:
      "궁금한 사람과의 궁합을 캐릭터 두 개만 골라 알아보세요. 내 진단 결과가 없어도 괜찮아요.",
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function KoreanAishoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
