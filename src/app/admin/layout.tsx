import type { Metadata } from "next";

// /admin 配下は管理者専用のため noindex
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
