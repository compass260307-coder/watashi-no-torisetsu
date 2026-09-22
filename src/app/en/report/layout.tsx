import type { Metadata } from "next";

// Personal report pages are tokened per-user documents and must stay unindexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EnglishReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
