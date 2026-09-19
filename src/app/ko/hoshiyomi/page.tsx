import type { Metadata } from "next";
import { HoshiyomiClient } from "@/components/hoshiyomi/HoshiyomiClient";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import {
  ensureHoshiyomiCreditsFromPurchase,
  listHoshiyomiConversations,
} from "@/lib/hoshiyomi/store";
import { localizedAlternates } from "@/lib/locale-seo";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "별자리 상담사와 대화하기 | 나의 사용설명서" },
  description:
    "성격 진단과 운명의 설계도를 함께 참고하는 AI 별자리 상담사와 한국어로 대화하며 고민과 감정을 정리해 보세요.",
  alternates: localizedAlternates("ko", "/hoshiyomi", "/ko/hoshiyomi"),
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: Promise<{
    chat?: string | string[];
    paid?: string | string[];
  }>;
};

export default async function KoreanHoshiyomiPage({ searchParams }: PageProps) {
  const session = await getSession();

  // 日本版と同じく、未ログインでも Alice のページ自体は閲覧できる。
  // 送信時に共通の課金カードを開き、購入前の体験をログインで遮断しない。
  if (!session) {
    return (
      <HoshiyomiClient
        selectedConversation={null}
        initialRemaining={0}
        totalCredits={0}
        persistenceReady
        hasChatAccess={false}
        locale="ko"
      />
    );
  }

  const paramsPromise: Promise<{
    chat?: string | string[];
    paid?: string | string[];
  }> = searchParams ?? Promise.resolve({});
  const [conversationResult, creditResult, fullAccess, params] =
    await Promise.all([
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
          locale="ko"
          returnTo="hoshiyomi"
        />
      ) : null}
      <HoshiyomiClient
        key={selectedConversation?.id ?? "home"}
        selectedConversation={selectedConversation}
        initialRemaining={creditResult.data.remaining}
        totalCredits={creditResult.data.total}
        persistenceReady={conversationResult.available && creditResult.available}
        hasChatAccess={hasChatAccess}
        canUpgradeToPremium={false}
        ownerToken={session.owner_token ?? undefined}
        locale="ko"
      />
    </>
  );
}
