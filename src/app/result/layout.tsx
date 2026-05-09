import type { Metadata } from "next";

// /result および /result/[ownerToken] 配下は個人結果ページのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
