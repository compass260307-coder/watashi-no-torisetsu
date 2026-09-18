import type { Metadata } from "next";
import TakoEntryPage from "@/components/tako/TakoEntryPage";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: { absolute: "Penilaian teman | Alice Test" },
  description:
    "Bandingkan cara Anda melihat diri sendiri dengan cara teman melihat Anda.",
  alternates: localizedAlternates(
    "id",
    "/tako",
    "/ko/tako",
    "/en/tako",
    "/id/tako",
  ),
  robots: { index: false, follow: false },
};

export default function IndonesianTakoEntryRoute() {
  return <TakoEntryPage locale="id" />;
}
