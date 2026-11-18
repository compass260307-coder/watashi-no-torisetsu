import { notFound } from "next/navigation";
import { ResultUpgradeChat } from "@/components/result-upgrade/ResultUpgradeChat";

export default function ResultUpgradeChatPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#FFF8E8_0,#F5F4FB_42%,#F5F4FB_100%)] px-4 py-10 md:px-8">
      <div className="mx-auto mb-7 max-w-[720px] text-center">
        <p className="text-[12px] font-black tracking-[0.14em] text-[#9A6A24]">LOCAL PREVIEW</p>
        <h1 className="mt-2 text-[30px] font-black text-[#2E2E5C]">Aliceの7つの質問（日本語Web）</h1>
        <p className="mt-3 text-[14px] text-[#66657B]">プレビューでは回答の保存と決済は行いません。Aliceの反応は実際にAIで作ります。</p>
      </div>
      <ResultUpgradeChat locale="ja" ownerToken="preview" premiumPaid={false} preview />
    </main>
  );
}
