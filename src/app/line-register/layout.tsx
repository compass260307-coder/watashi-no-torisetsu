import type { Metadata } from "next";

// /line-register は LIFF 専用ページのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LineRegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
