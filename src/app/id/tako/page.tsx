import type { Metadata } from "next";
import TakoEntryPage from "@/components/tako/TakoEntryPage";

export const metadata: Metadata = { title: { absolute: "Penilaian teman | Alice Test" }, description: "Bandingkan cara Anda melihat diri sendiri dengan cara teman melihat Anda.", robots: { index: false, follow: false } };

export default function IndonesianTakoEntryRoute() {
  return <TakoEntryPage locale="id" />;
}
