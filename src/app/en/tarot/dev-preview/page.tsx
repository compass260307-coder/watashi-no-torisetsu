import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import TarotLanding from "@/components/tarot/TarotLanding";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import { isTarotMode } from "@/components/tarot/tarot-data";

export const metadata: Metadata = {
  title: { absolute: "Alice Tarot Preview | Alice Test" },
  robots: { index: false, follow: false },
};

// Local-only preview of the post-purchase English Tarot landing page.
export default async function EnglishTarotPaidPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = (await searchParams) ?? {};
  const mode = typeof query.mode === "string" ? query.mode : "";

  return (
    <div className="min-h-dvh bg-[#F8F8FC] text-[#2E2E5C]">
      <EnSiteHeader />
      {isTarotMode(mode) ? (
        <TarotDrawExperience mode={mode} locale="en" previewMode />
      ) : (
        <TarotLanding locale="en" previewMode />
      )}
      <EnSiteFooter />
    </div>
  );
}
