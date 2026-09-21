import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TarotLanding from "@/components/tarot/TarotLanding";
import TarotDrawExperience from "@/components/tarot/TarotDrawExperience";
import { isTarotMode } from "@/components/tarot/tarot-data";

export const metadata: Metadata = {
  title: { absolute: "Alice Tarot Preview | Alice Personalities" },
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

  return isTarotMode(mode) ? (
    <TarotDrawExperience mode={mode} locale="en" previewMode />
  ) : (
    <TarotLanding locale="en" previewMode />
  );
}
