import { notFound } from "next/navigation";
import { LineUpgradeChatPreview } from "@/components/result-upgrade/LineUpgradeChatPreview";

export const dynamic = "force-dynamic";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LineUpgradeChatPreview purchaseReady />;
}
