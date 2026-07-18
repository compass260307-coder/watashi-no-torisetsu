import type { Metadata } from "next";

// PDFダウンロードとPDF生成専用ページは個人向けのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
