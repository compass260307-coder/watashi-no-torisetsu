import type { Metadata } from "next";
import TarotLanding from "@/components/tarot/TarotLanding";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { getTarotAccessState, redirectToTarotPaywall } from "@/lib/tarot/access";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Tarot bersama Alice",
  description: "Tiga pembacaan tarot Alice untuk merefleksikan perasaan dan pilihanmu.",
  alternates: localizedAlternates(
    "id",
    "/tarot",
    "/ko/tarot",
    "/en/tarot",
    "/id/tarot",
  ),
};

export default async function IndonesianTarotPage({
  searchParams,
}: {
  searchParams?: Promise<{ paid?: string | string[] }>;
}) {
  const query = (await searchParams) ?? {};
  const access = await getTarotAccessState();
  if (!access.purchased) {
    if (query.paid === "1" && access.ownerToken) {
      return <PaidUnlockWatcher ownerToken={access.ownerToken} returnTo="tarot" locale="id" />;
    }
    redirectToTarotPaywall("id", access.ownerToken);
  }
  return <TarotLanding locale="id" />;
}
