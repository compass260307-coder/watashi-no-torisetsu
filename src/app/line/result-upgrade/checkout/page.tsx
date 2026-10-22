import { redirect } from "next/navigation";
import { LineUpgradeCheckoutRedirect } from "@/components/result-upgrade/LineUpgradeCheckoutRedirect";
import { getLineResultUpgradeSession } from "@/lib/line-result-upgrade";
import { hasFullAccess, hasPremiumBundleAccess } from "@/lib/entitlements";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";
import { normalizeResultUpgradeAnswers } from "@/lib/result-upgrade";
import { LINE_UPGRADE_TALK_URL } from "@/lib/line-upgrade-dialogue";

export const dynamic = "force-dynamic";
export const metadata = { title: "決済画面を開いています | Alice", robots: { index: false, follow: false } };

export default async function Page() {
  const session = await getLineResultUpgradeSession();
  if (!session) redirect(LINE_UPGRADE_TALK_URL);
  const [full, paid, row] = await Promise.all([
    hasFullAccess(session.id), hasPremiumBundleAccess(session.id), loadResultUpgradeForUser(session.id),
  ]);
  if (!full) redirect("/line/menu");
  if (paid) redirect("/line/result-upgrade?paid=1");
  if (row?.locale !== "ja" || !normalizeResultUpgradeAnswers(row.answers)) redirect(LINE_UPGRADE_TALK_URL);
  return <main className="min-h-screen bg-[#F5F4FB] px-4 py-16"><LineUpgradeCheckoutRedirect /></main>;
}
