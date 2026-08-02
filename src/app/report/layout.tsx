import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
});

// PDFダウンロードとPDF生成専用ページは個人向けのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={notoSansKr.variable}>{children}</div>;
}
