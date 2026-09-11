import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import TarotLanding from "@/components/tarot/TarotLanding";

export const metadata: Metadata = {
  title: { absolute: "Alice Tarot Preview | Alice Diagnosis" },
  robots: { index: false, follow: false },
};

// Local-only preview of the post-purchase English Tarot landing page.
export default function EnglishTarotPaidPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="min-h-dvh bg-[#F8F8FC] text-[#2E2E5C]">
      <EnSiteHeader />
      <TarotLanding locale="en" />
      <EnSiteFooter />
    </div>
  );
}
