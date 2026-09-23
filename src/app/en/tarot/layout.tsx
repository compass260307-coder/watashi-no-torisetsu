import type { ReactNode } from "react";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";

export default function EnglishTarotLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <TopHeader locale="en" />
      {children}
      <TopFooter locale="en" />
    </>
  );
}
