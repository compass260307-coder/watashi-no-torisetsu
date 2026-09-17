import TarotLanding from "@/components/tarot/TarotLanding";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import {
  getTarotAccessState,
  redirectToTarotPaywall,
} from "@/lib/tarot/access";
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
  const access = await getTarotAccessState();

  if (!access.purchased) {
    if (query.paid === "1" && access.ownerToken) {
      return (
        <div className="min-h-dvh bg-[#F8F8FC] text-[#2E2E5C]">
          <EnSiteHeader />
          <PaidUnlockWatcher
            ownerToken={access.ownerToken}
            locale="en"
            returnTo="tarot"
          />
          <EnSiteFooter />
        </div>
      );
    }
    redirectToTarotPaywall("en", access.ownerToken);
  }

  return (
    <div className="min-h-dvh bg-[#F8F8FC] text-[#2E2E5C]">
      <EnSiteHeader />
      <TarotLanding locale="en" />
      <EnSiteFooter />
    </div>
  );
}
