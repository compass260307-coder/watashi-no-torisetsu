import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HoshiyomiClient } from "@/components/hoshiyomi/HoshiyomiClient";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import {
  ensureHoshiyomiCreditsFromPurchase,
  listHoshiyomiConversations,
} from "@/lib/hoshiyomi/store";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "星読みの案内人と話す",
  description: "性格診断と星読み鑑定をもとに、星読みの案内人と対話できます。",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: Promise<{
    chat?: string | string[];
    paid?: string | string[];
  }>;
};

export default async function HoshiyomiPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const paramsPromise: Promise<{
    chat?: string | string[];
    paid?: string | string[];
  }> =
    searchParams ?? Promise.resolve({});
  const [conversationResult, creditResult, fullAccess, params] = await Promise.all([
    listHoshiyomiConversations(session.id),
    ensureHoshiyomiCreditsFromPurchase(session.id),
    hasFullAccess(session.id),
    paramsPromise,
  ]);
  const hasChatAccess =
    fullAccess && creditResult.available && creditResult.data.total > 0;
  const selectedId = typeof params.chat === "string" ? params.chat : null;
  const selectedConversation = selectedId
    ? conversationResult.data.find((item) => item.id === selectedId) ?? null
    : null;

  return (
    <>
      {params.paid === "1" && !hasChatAccess && session.owner_token ? (
        <PaidUnlockWatcher
          ownerToken={session.owner_token}
          returnTo="hoshiyomi"
        />
      ) : null}
      <HoshiyomiClient
        key={selectedConversation?.id ?? "home"}
        conversations={conversationResult.data}
        selectedConversation={selectedConversation}
        initialRemaining={creditResult.data.remaining}
        totalCredits={creditResult.data.total}
        persistenceReady={conversationResult.available && creditResult.available}
        hasChatAccess={hasChatAccess}
        ownerToken={session.owner_token ?? undefined}
      />
    </>
  );
}
