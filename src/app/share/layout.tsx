import type { Metadata } from "next";

// /share は LIFF 専用ページのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
