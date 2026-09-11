import TarotLanding from "@/components/tarot/TarotLanding";
import EnFullAccessCard from "@/components/en/EnFullAccessCard";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { hasTarotAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/locale-seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Alice Tarot",
  description: "Choose from three reflective tarot readings with Alice.",
  alternates: localizedAlternates("en", "/tarot", "/ko/tarot", "/en/tarot"),
};

type Props = { searchParams?: Promise<{ paid?: string | string[] }> };

export default async function EnglishTarotPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const session = await getSession();
  const purchased = session?.id ? await hasTarotAccess(session.id) : false;

  return (
    <div className="min-h-dvh bg-[#F8F8FC] text-[#2E2E5C]">
      <EnSiteHeader />
      {query.paid === "1" && !purchased && session?.owner_token ? (
        <PaidUnlockWatcher ownerToken={session.owner_token} locale="en" returnTo="tarot" />
      ) : null}
      {purchased ? (
        <TarotLanding locale="en" />
      ) : (
        <main className="mx-auto w-full max-w-[900px] px-5 py-14 sm:px-8 sm:py-20">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#5B5BEF]">Alice Tarot</p>
            <h1 className="mt-3 text-[34px] font-black sm:text-[46px]">Three readings for the question on your mind</h1>
            <p className="mx-auto mt-4 max-w-[620px] text-base font-semibold leading-relaxed text-[#727287]">
              Choose a daily card, a past–present–future spread, or a YES / NO reading. All three are included in the Complete Edition.
            </p>
          </div>
          <EnFullAccessCard ownerToken={session?.owner_token ?? ""} purchased={false} returnTo="tarot" />
        </main>
      )}
      <EnSiteFooter />
    </div>
  );
}
