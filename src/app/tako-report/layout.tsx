import type { Metadata } from "next";

// 友達診断 完全版レポート (PDF生成専用ページ + DLルート) は個人向けのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TakoReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
