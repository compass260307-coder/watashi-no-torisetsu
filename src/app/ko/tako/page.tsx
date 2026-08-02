import type { Metadata } from "next";
import { KoreanTakoEntryPage as KoreanTakoEntry } from "@/components/friend/KoreanTakoEntryPage";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "친구가 보는 나 | 나의 사용설명서",
  alternates: localizedAlternates("ko", "/tako", "/ko/tako"),
  robots: { index: false, follow: false },
};

export default function KoreanTakoEntryPage() {
  return <KoreanTakoEntry />;
}
