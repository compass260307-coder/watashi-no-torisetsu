import type { ReactNode } from "react";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";

export default function IndonesianTarotLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#F8F8FC] text-[#2E2E5C]">
      <TopHeader locale="id" />
      {children}
      <TopFooter locale="id" />
    </div>
  );
}
