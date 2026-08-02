import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
});

// 友達診断 完全版レポート (PDF生成専用ページ + DLルート) は個人向けのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TakoReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={notoSansKr.variable}>{children}</div>;
}
