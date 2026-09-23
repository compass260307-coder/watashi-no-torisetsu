import { redirect } from "next/navigation";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { ResultUpgradeChat } from "@/components/result-upgrade/ResultUpgradeChat";
import { hasFullAccess, hasPremiumBundleAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";
import { isResultUpgradeReady } from "@/lib/result-upgrade";

export const dynamic = "force-dynamic";

export default async function ResultUpgradePage() {
  const session = await getSession();
  if (!session) redirect("/diagnosis");
  if (!(await hasFullAccess(session.id))) {
    redirect(session.owner_token ? `/me/${encodeURIComponent(session.owner_token)}` : "/diagnosis");
  }
  const [premiumPaid, row] = await Promise.all([
    hasPremiumBundleAccess(session.id),
    loadResultUpgradeForUser(session.id),
  ]);
  if (isResultUpgradeReady(row)) redirect("/result-upgrade/reading");

  return (
    <>
      <TopHeader />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#FFF8E8_0,#F5F4FB_38%,#F5F4FB_100%)] px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-12">
        <div className="mx-auto mb-7 max-w-[720px] text-center">
          <p className="text-[12px] font-black tracking-[0.14em] text-[#9A6A24]">RESULT UPGRADE</p>
          <h1 className="mt-2 text-[28px] font-black leading-[1.4] text-[#2E2E5C] md:text-[38px]">
            Aliceの質問に答えて、
            <br className="sm:hidden" />あなた専用の結果へ
          </h1>
          <p className="mx-auto mt-3 max-w-[600px] text-[14px] leading-[1.8] text-[#66657B] md:text-[16px]">
            選択肢はありません。普段のあなたを自由に話してください。
          </p>
        </div>
        <ResultUpgradeChat
          ownerToken={session.owner_token ?? ""}
          existingAnswers={row?.answers ?? []}
          initialState={row?.state ?? null}
          premiumPaid={premiumPaid}
        />
      </main>
      <TopFooter />
    </>
  );
}
