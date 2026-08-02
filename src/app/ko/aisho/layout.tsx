import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

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
    locale: "ko_KR",
    type: "website",
  },
};

export default function KoreanAishoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
