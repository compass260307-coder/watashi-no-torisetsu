import type { Metadata } from "next";
import type { ReactNode } from "react";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Aliceのタロット占い",
  description:
    "Aliceと一緒にカードを引いて、今日の流れや迷っていることを読み解くタロット占いです。",
  alternates: localizedAlternates("ja", "/tarot", "/ko/tarot"),
};

export default function TarotLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TopHeader />
      {children}
      <TopFooter />
    </>
  );
}
