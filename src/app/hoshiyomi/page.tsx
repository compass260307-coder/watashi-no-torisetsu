import type { Metadata } from "next";
import { HoshiyomiClient } from "@/components/hoshiyomi/HoshiyomiClient";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import {
  ensureHoshiyomiCreditsFromPurchase,
  listHoshiyomiConversations,
} from "@/lib/hoshiyomi/store";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";
import { localizedAlternates } from "@/lib/locale-seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aliceと話す",
  description: "性格診断と星読み鑑定をもとに、AI占い師「Alice」と対話できます。",
  alternates: localizedAlternates("ja", "/hoshiyomi", "/ko/hoshiyomi"),
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

  // 未ログイン (未診断ゲスト) でも Alice のページ自体は見せる (2026-08-17 指示)。
  // チャットを送ろうとした時点で課金カードが開く (hasChatAccess=false)。
  // 未ログインの購入CTAは FullAccessCta の unauthHref で診断 (/diagnosis) へ誘導される。
  if (!session) {
    return (
      <HoshiyomiClient
        conversations={[]}
        selectedConversation={null}
        initialRemaining={0}
        totalCredits={0}
        persistenceReady
        hasChatAccess={false}
      />
    );
  }

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
