import Link from "next/link";
import { redirect } from "next/navigation";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { PrintReadingButton } from "@/components/result-upgrade/PrintReadingButton";
import { ResultUpgradeReadingDocument } from "@/components/result-upgrade/ResultUpgradeReadingDocument";
import { hasPremiumBundleAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { isResultUpgradeReady } from "@/lib/result-upgrade";
import { loadResultUpgradeForUser } from "@/lib/result-upgrade-server";

export const dynamic = "force-dynamic";

export default async function ResultUpgradeReadingPage() {
  const session = await getSession();
  if (!session) redirect("/diagnosis");
  const [premiumPaid, row] = await Promise.all([
    hasPremiumBundleAccess(session.id),
    loadResultUpgradeForUser(session.id),
  ]);
  if (!premiumPaid || !isResultUpgradeReady(row)) redirect("/result-upgrade");
  const ownerToken = session.owner_token ?? "";

  return (
    <>
      <div className="print:hidden"><TopHeader /></div>
      <main className="min-h-screen bg-[#E9E3D7] px-3 py-10 print:bg-white print:px-0 print:py-0 md:px-8 md:py-16">
        <ResultUpgradeReadingDocument
          imageSrc={`/api/result-upgrade/character/${encodeURIComponent(ownerToken)}${row.generated_at ? `?v=${encodeURIComponent(row.generated_at)}` : ""}`}
          imageAlt={row.personalized_type_name}
          imageUnoptimized
          personalizedTypeName={row.personalized_type_name}
          personalizedIntro={row.personalized_intro}
          reading={row.reading}
        />
        <div className="mx-auto mt-8 flex max-w-[900px] flex-wrap items-center justify-center gap-3 print:hidden">
          <PrintReadingButton />
          <Link
            href={`/me/${encodeURIComponent(ownerToken)}`}
            className="inline-flex items-center justify-center rounded-full border-2 border-[#2E2E5C] bg-white px-7 py-3 text-[14px] font-black text-[#2E2E5C]"
          >
            結果ページへ戻る
          </Link>
        </div>
      </main>
      <div className="print:hidden"><TopFooter /></div>
    </>
  );
}
