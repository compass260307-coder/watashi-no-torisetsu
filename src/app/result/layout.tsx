import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

// /result および /result/[ownerToken] 配下は個人結果ページのため noindex
export const metadata: Metadata = {
  alternates: localizedAlternates("ja", "/result", "/ko/result"),
  robots: { index: false, follow: false },
};

export default function ResultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
