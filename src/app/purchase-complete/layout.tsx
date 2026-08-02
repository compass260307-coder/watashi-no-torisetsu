import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  alternates: localizedAlternates(
    "ja",
    "/purchase-complete",
    "/ko/purchase-complete",
  ),
  robots: { index: false, follow: false },
};

export default function PurchaseCompleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
