import { localePath } from "@/i18n/config";
import type { ResultUpgradeLocale } from "@/i18n/result-upgrade";
import { redirect } from "next/navigation";
import { LineUpgradeReceipt } from "@/components/result-upgrade/LineUpgradeReceipt";
import { LineUpgradePaymentPending } from "@/components/result-upgrade/LineUpgradePaymentPending";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { ResultUpgradeChat } from "@/components/result-upgrade/ResultUpgradeChat";
import { hasFullAccess, hasPremiumBundleAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { LINE_UPGRADE_TALK_URL } from "@/lib/line-upgrade-dialogue";
import { getLineResultUpgradeSession } from "@/lib/line-result-upgrade";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";
import { isResultUpgradeReady } from "@/lib/result-upgrade";

export default async function ResultUpgradePageContent({ locale = "ja", salesChannel = "web", paymentReturned = false }: { locale?: ResultUpgradeLocale; salesChannel?: "web" | "line"; paymentReturned?: boolean }) {
  const prefix = localePath(locale, "/") === "/" ? "" : localePath(locale, "/");
  const lineFlow = locale === "ja" && salesChannel === "line";
  const session = lineFlow ? await getLineResultUpgradeSession() : await getSession();
  if (!session) redirect(lineFlow ? "/line/menu" : `${prefix}/diagnosis`);
  if (!(await hasFullAccess(session.id))) {
    redirect(session.owner_token ? `${prefix}/me/${encodeURIComponent(session.owner_token)}` : `${prefix}/diagnosis`);
  }
  const [premiumPaid, row] = await Promise.all([
    hasPremiumBundleAccess(session.id),
    loadResultUpgradeForUser(session.id),
  ]);
  if (lineFlow && row && row.locale !== "ja") redirect("/line/menu");
  if (lineFlow && (!row || row.answers.length < 5)) redirect(LINE_UPGRADE_TALK_URL);
  if (lineFlow && paymentReturned && !premiumPaid) return <LineUpgradePaymentPending />;
  if (lineFlow && premiumPaid) {
    if (!paymentReturned && isResultUpgradeReady(row)) redirect("/line/result-upgrade/reading");
    return <>
      <TopHeader locale={locale} />
      <main className="min-h-[75vh] bg-[#F5F4FB] px-4 py-12"><LineUpgradeReceipt failed={row?.state === "failed"} /></main>
      <TopFooter locale={locale} />
    </>;
  }
  // Existing Web buyers retain access; new Japanese purchases start in LINE.
  if (locale === "ja" && !lineFlow && !premiumPaid) {
    redirect(session.owner_token ? `/me/${encodeURIComponent(session.owner_token)}` : "/diagnosis");
  }
  if (lineFlow && isResultUpgradeReady(row) && !premiumPaid) redirect("/line/menu");
  if (isResultUpgradeReady(row)) redirect(lineFlow ? "/line/result-upgrade/reading" : `${prefix}/result-upgrade/reading`);

  return (
    <>
      <TopHeader locale={locale} />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#FFF8E8_0,#F5F4FB_38%,#F5F4FB_100%)] px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-12">
        <div className="mx-auto mb-7 max-w-[720px] text-center">
          <p className="text-[12px] font-black tracking-[0.14em] text-[#9A6A24]">RESULT UPGRADE</p>
          <h1 className="mt-2 text-[28px] font-black leading-[1.4] text-[#2E2E5C] md:text-[38px]">
            {lineFlow ? "あなた専用の結果へアップグレード" : <>
              {locale === "ko" ? "Alice의 질문에 답하고," : "Aliceの質問に答えて、"}
              <br className="sm:hidden" />{locale === "ko" ? "나만의 결과를 만나 보세요" : "あなた専用の結果へ"}
            </>}
          </h1>
          <p className="mx-auto mt-3 max-w-[600px] text-[14px] leading-[1.8] text-[#66657B] md:text-[16px]">
            {lineFlow ? "5つの回答は保存済みだよ🌿 内容と金額を確認してね。購入後は自動で生成して、LINEにキャラクターと鑑定書のリンクを届けるよ。" : locale === "ko" ? "선택지는 없어요. 평소 나의 모습을 자유롭게 이야기해 주세요." : "選択肢はありません。普段のあなたを自由に話してください。"}
          </p>
        </div>
        <ResultUpgradeChat
          locale={locale}
          salesChannel={salesChannel}
          ownerToken={session.owner_token ?? ""}
          existingAnswers={row?.answers ?? []}
          initialState={row?.state ?? null}
          premiumPaid={premiumPaid}
        />
      </main>
      <TopFooter locale={locale} />
    </>
  );
}
