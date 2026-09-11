import type { Metadata } from "next";
import EnAliceClient from "@/components/en/EnAliceClient";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { HoshiyomiClient } from "@/components/hoshiyomi/HoshiyomiClient";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { ensureHoshiyomiCreditsFromPurchase } from "@/lib/hoshiyomi/store";
import { hasFullAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { localizedAlternates } from "@/lib/locale-seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Talk with Alice", description: "Reflect with your personal AI astrologer in English.", alternates: localizedAlternates("en", "/hoshiyomi", "/ko/hoshiyomi", "/en/hoshiyomi") };

type Props = { searchParams?: Promise<{ paid?: string | string[] }> };

export default async function EnglishAlicePage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const session = await getSession();
  const purchased = session?.id ? await hasFullAccess(session.id) : false;
  const credits = session?.id && purchased ? await ensureHoshiyomiCreditsFromPurchase(session.id) : null;
  const unlocked = purchased && !!credits?.available && credits.data.total > 0;
  if (!unlocked) {
    return (
      <>
        {query.paid === "1" && session?.owner_token ? (
          <PaidUnlockWatcher
            ownerToken={session.owner_token}
            locale="en"
            returnTo="hoshiyomi"
          />
        ) : null}
        <HoshiyomiClient
          selectedConversation={null}
          initialRemaining={0}
          totalCredits={30}
          persistenceReady
          hasChatAccess={false}
          ownerToken={session?.owner_token ?? undefined}
          locale="en"
        />
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F8F8FC]">
      <EnSiteHeader />
      <EnAliceClient
        initialRemaining={credits.data.remaining}
        total={credits.data.total}
      />
      <EnSiteFooter />
    </div>
  );
}
