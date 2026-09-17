import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import TarotLanding from "@/components/tarot/TarotLanding";
import { isTarotMode } from "@/components/tarot/tarot-data";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";

export const metadata: Metadata = {
  title: { absolute: "Pratinjau Tarot Alice | Alice Test" },
  robots: { index: false, follow: false },
};

export default async function IndonesianTarotPaidPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = (await searchParams) ?? {};
  const mode = typeof query.mode === "string" ? query.mode : "";

  return (
    <div className="min-h-dvh bg-[#F8F8FC] text-[#2E2E5C]">
      <TopHeader locale="id" />
      {isTarotMode(mode) ? (
        <TarotDrawExperience mode={mode} locale="id" previewMode />
      ) : (
        <TarotLanding locale="id" previewMode />
      )}
      <TopFooter locale="id" />
    </div>
  );
}
