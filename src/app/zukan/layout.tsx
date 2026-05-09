import type { Metadata } from "next";

// /zukan/[ownerToken] は個人図鑑ページのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ZukanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
