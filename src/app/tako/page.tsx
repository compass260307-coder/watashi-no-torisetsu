import type { Metadata } from "next";
import TakoEntryPage from "@/components/tako/TakoEntryPage";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "友達診断",
  alternates: localizedAlternates("ja", "/tako", "/ko/tako", "/en/tako"),
  robots: { index: false, follow: false },
};

export default function TakoIntroPage() {
  return <TakoEntryPage />;
}
