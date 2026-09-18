import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  alternates: localizedAlternates(
    "id",
    "/result",
    "/ko/result",
    "/en/result",
    "/id/result",
  ),
  robots: { index: false, follow: false },
};

export default function IndonesianResultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
