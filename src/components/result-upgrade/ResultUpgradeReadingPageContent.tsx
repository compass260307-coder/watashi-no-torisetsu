import { localePath } from "@/i18n/config";
import type { ResultUpgradeLocale } from "@/i18n/result-upgrade";
import Link from "next/link";
import { redirect } from "next/navigation";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { PrintReadingButton } from "@/components/result-upgrade/PrintReadingButton";
import { ResultUpgradeReadingDocument } from "@/components/result-upgrade/ResultUpgradeReadingDocument";
import { hasPremiumBundleAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { getLineResultUpgradeSession } from "@/lib/line-result-upgrade";
import { isResultUpgradeReady } from "@/lib/result-upgrade";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";

export default async function ResultUpgradeReadingPageContent({ locale = "ja", salesChannel = "web" }: { locale?: ResultUpgradeLocale; salesChannel?: "web" | "line" }) {
  const prefix = localePath(locale, "/") === "/" ? "" : localePath(locale, "/");
  const lineFlow = locale === "ja" && salesChannel === "line";
  const session = lineFlow ? await getLineResultUpgradeSession() : await getSession();
  if (!session) redirect(lineFlow ? "/line/menu" : `${prefix}/diagnosis`);
  const [premiumPaid, row] = await Promise.all([
    hasPremiumBundleAccess(session.id),
    loadResultUpgradeForUser(session.id),
  ]);
  if (lineFlow && row && row.locale !== "ja") redirect("/line/menu");
  if (!premiumPaid || !isResultUpgradeReady(row)) redirect(lineFlow ? "/line/result-upgrade" : `${prefix}/result-upgrade`);
  const ownerToken = session.owner_token ?? "";

  return (
    <>
      <div className="print:hidden"><TopHeader locale={locale} /></div>
      <main className="min-h-screen bg-[#E9E3D7] px-3 py-10 print:bg-white print:px-0 print:py-0 md:px-8 md:py-16">
        {/* 生成キャラ画像はセッション認証付き API 配信のため常に unoptimized
            (next/image の内部フェッチは Cookie を引き継がず 404 になる)。 */}
        <ResultUpgradeReadingDocument
          locale={locale}
          imageSrc={`/api/result-upgrade/character/${encodeURIComponent(ownerToken)}?${new URLSearchParams({ ...(row.generated_at ? { v: row.generated_at } : {}), ...(lineFlow ? { channel: "line" } : {}) })}`}
          imageAlt={row.personalized_type_name}
          imageUnoptimized
          personalizedTypeName={row.personalized_type_name}
          personalizedIntro={row.personalized_intro}
          reading={row.reading}
        />
        <div className="mx-auto mt-8 flex max-w-[900px] flex-wrap items-center justify-center gap-3 print:hidden">
          <PrintReadingButton locale={locale} />
          {lineFlow && <a href="https://line.me/R/oaMessage/%40867domoo" className="rounded-full bg-[#06C755] px-7 py-3 text-[14px] font-black text-white">Aliceとのトークに戻る</a>}
          <Link
            href={`${prefix}/me/${encodeURIComponent(ownerToken)}`}
            className="inline-flex items-center justify-center rounded-full border-2 border-[#2E2E5C] bg-white px-7 py-3 text-[14px] font-black text-[#2E2E5C]"
          >
            {locale === "ko" ? "결과 페이지로 돌아가기" : "結果ページへ戻る"}
          </Link>
        </div>
      </main>
      <div className="print:hidden"><TopFooter locale={locale} /></div>
    </>
  );
}
