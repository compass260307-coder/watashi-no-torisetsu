import TarotLanding from "@/components/tarot/TarotLanding";
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
  alternates: localizedAlternates("en", "/tarot", "/ko/tarot", "/en/tarot", "/id/tarot"),
};

type Props = { searchParams?: Promise<{ paid?: string | string[] }> };

export default async function EnglishTarotPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const access = await getTarotAccessState();

  if (!access.purchased) {
    if (query.paid === "1" && access.ownerToken) {
      return (
        <PaidUnlockWatcher
          ownerToken={access.ownerToken}
          locale="en"
          returnTo="tarot"
        />
      );
    }
    redirectToTarotPaywall("en", access.ownerToken);
  }

  return <TarotLanding locale="en" />;
}
