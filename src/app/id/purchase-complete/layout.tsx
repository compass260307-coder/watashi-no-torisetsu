import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  alternates: localizedAlternates(
    "id",
    "/purchase-complete",
    "/ko/purchase-complete",
    "/en/purchase-complete",
    "/id/purchase-complete",
  ),
  robots: { index: false, follow: false },
};

export default function IndonesianPurchaseCompleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
