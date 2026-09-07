import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "韓国サイト管理画面",
  robots: { index: false, follow: false },
};

export default function KoreanAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
