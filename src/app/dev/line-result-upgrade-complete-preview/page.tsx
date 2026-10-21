import { notFound } from "next/navigation";
import { LineUpgradeDeliveryPreview } from "@/components/result-upgrade/LineUpgradeDeliveryPreview";
export const dynamic = "force-dynamic";
export const metadata = { title: "LINEでの結果受け取りプレビュー | Alice", robots: { index: false, follow: false } };
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LineUpgradeDeliveryPreview />;
}
