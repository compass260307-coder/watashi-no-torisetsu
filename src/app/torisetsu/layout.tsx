import type { Metadata } from "next";

// /torisetsu/redirect は LIFF redirect ページのため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TorisetsuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
