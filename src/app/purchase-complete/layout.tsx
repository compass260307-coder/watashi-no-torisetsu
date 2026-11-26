import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  // 購入完了・確認できなかった場合の両方で出る。接尾辞はルートの title.template が付ける。
  title: "購入の確認",
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
