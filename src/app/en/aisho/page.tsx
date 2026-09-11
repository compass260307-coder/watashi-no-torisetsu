import type { Metadata } from "next";
import EnCompatibility from "@/components/en/EnCompatibility";
import EnFullAccessCard from "@/components/en/EnFullAccessCard";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { hasFullAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { localizedAlternates } from "@/lib/locale-seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compatibility", description: "Explore compatibility between two of the 32 personality types.", alternates: localizedAlternates("en", "/aisho", "/ko/aisho", "/en/aisho") };

type Props = { searchParams?: Promise<{ paid?: string | string[] }> };

export default async function EnglishCompatibilityPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const session = await getSession();
  const purchased = session?.id ? await hasFullAccess(session.id) : false;
  return <div className="min-h-dvh bg-[#F8F8FC] text-[#2E2E5C]"><EnSiteHeader />{query.paid === "1" && !purchased && session?.owner_token ? <PaidUnlockWatcher ownerToken={session.owner_token} locale="en" returnTo="aisho" /> : null}{purchased ? <EnCompatibility /> : <main className="mx-auto max-w-[900px] px-5 py-12"><h1 className="text-[38px] font-black">Compatibility</h1><p className="mt-3 text-[#67677C]">Compatibility insights are included in the Complete Edition.</p><EnFullAccessCard ownerToken={session?.owner_token ?? ""} purchased={false} returnTo="aisho" /></main>}<EnSiteFooter /></div>;
}
