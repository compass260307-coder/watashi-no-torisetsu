import type { Metadata } from "next";
import type { ReactNode } from "react";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Alice 타로",
  description:
    "Alice와 함께 카드를 뽑아 오늘의 흐름과 망설이는 일을 읽어 보는 타로 리딩이에요.",
  alternates: localizedAlternates("ko", "/tarot", "/ko/tarot"),
};

export default function KoreanTarotLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="ko">
      <KoTopHeader />
      {children}
      <KoTopFooter />
    </div>
  );
}
