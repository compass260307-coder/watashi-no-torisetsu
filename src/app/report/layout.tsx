import type { Metadata } from "next";

// /report/[ownerToken] は個人レポートページのため noindex
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
