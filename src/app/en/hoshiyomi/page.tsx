import type { Metadata } from "next";
import { HoshiyomiClient } from "@/components/hoshiyomi/HoshiyomiClient";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import {
  ensureHoshiyomiCreditsFromPurchase,
  listHoshiyomiConversations,
} from "@/lib/hoshiyomi/store";
import {
  hasFullAccess,
  hasPremiumBundleAccess,
} from "@/lib/entitlements";
import { HOSHIYOMI_CHAT_CREDITS_PREMIUM_BUNDLE } from "@/lib/access-products";
import { getSession } from "@/lib/session";
import { localizedAlternates } from "@/lib/locale-seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Talk with Alice", description: "Reflect with your personal AI astrologer in English.", alternates: localizedAlternates("en", "/hoshiyomi", "/ko/hoshiyomi", "/en/hoshiyomi") };

type Props = {
  searchParams?: Promise<{
    chat?: string | string[];
    locked?: string | string[];
    paid?: string | string[];
    preview?: string | string[];
    trial_exhausted?: string | string[];
  }>;
};

export default async function EnglishAlicePage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const previewMode =
    process.env.NODE_ENV === "development" && query.preview === "1";
  const previewLocked = previewMode && query.locked === "1";
  const previewTrialExhausted =
    previewMode && query.trial_exhausted === "1";
  if (previewMode) {
    return (
      <HoshiyomiClient
        selectedConversation={null}
        initialRemaining={previewLocked || previewTrialExhausted ? 0 : 22}
        totalCredits={previewTrialExhausted ? 1 : previewLocked ? 0 : 30}
        persistenceReady
        hasChatAccess={!previewLocked}
        canUpgradeToPremium={previewTrialExhausted}
        previewMode
        locale="en"
      />
    );
  }

  const session = await getSession();
  if (!session) {
    return (
      <HoshiyomiClient
        selectedConversation={null}
        initialRemaining={0}
        totalCredits={0}
        persistenceReady
        hasChatAccess={false}
        locale="en"
      />
    );
  }

  const [conversationResult, creditResult, fullAccess, premiumAccess] =
    await Promise.all([
      listHoshiyomiConversations(session.id),
      ensureHoshiyomiCreditsFromPurchase(session.id),
      hasFullAccess(session.id),
      hasPremiumBundleAccess(session.id),
    ]);
  const hasChatAccess =
    fullAccess && creditResult.available && creditResult.data.total > 0;
  const selectedId = typeof query.chat === "string" ? query.chat : null;
  const selectedConversation = selectedId
    ? conversationResult.data.find((item) => item.id === selectedId) ?? null
    : null;

  return (
    <>
      {query.paid === "1" && !hasChatAccess && session.owner_token ? (
        <PaidUnlockWatcher
          ownerToken={session.owner_token}
          locale="en"
          returnTo="hoshiyomi"
        />
      ) : null}
      <HoshiyomiClient
        key={selectedConversation?.id ?? "home"}
        selectedConversation={selectedConversation}
        initialRemaining={creditResult.data.remaining}
        totalCredits={creditResult.data.total}
        persistenceReady={
          conversationResult.available && creditResult.available
        }
        hasChatAccess={hasChatAccess}
        canUpgradeToPremium={
          fullAccess &&
          !premiumAccess &&
          creditResult.data.total < HOSHIYOMI_CHAT_CREDITS_PREMIUM_BUNDLE
        }
        ownerToken={session.owner_token ?? undefined}
        locale="en"
      />
    </>
  );
}
