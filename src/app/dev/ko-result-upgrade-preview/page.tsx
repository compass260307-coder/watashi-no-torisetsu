import { notFound } from "next/navigation";
import { ResultUpgradeChat } from "@/components/result-upgrade/ResultUpgradeChat";

export default function KoreanResultUpgradePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main lang="ko" className="min-h-screen bg-[radial-gradient(circle_at_top,#FFF8E8_0,#F5F4FB_42%,#F5F4FB_100%)] px-4 py-10 md:px-8">
      <div className="mx-auto mb-7 max-w-[720px] text-center">
        <p className="text-[12px] font-black tracking-[0.14em] text-[#9A6A24]">LOCAL PREVIEW</p>
        <h1 className="mt-2 text-[30px] font-black text-[#2E2E5C]">Alice의 질문에 답하고, 나만의 결과를 만나 보세요</h1>
        <p className="mt-3 text-[14px] text-[#66657B]">미리보기에서는 답변을 저장하거나 결제하지 않아요.</p>
      </div>
      <ResultUpgradeChat locale="ko" ownerToken="preview" premiumPaid={false} preview />
    </main>
  );
}
