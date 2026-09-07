import { HoshiyomiClient } from "@/components/hoshiyomi/HoshiyomiClient";
import type { HoshiyomiConversationSummary } from "@/lib/hoshiyomi/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const SAMPLE_CONVERSATIONS: HoshiyomiConversationSummary[] = [
  {
    id: "preview-love",
    title: "恋愛で同じことで悩んでしまいます",
    updatedAt: "2026-08-13T10:18:00.000Z",
    messages: [
      {
        id: "preview-user-1",
        role: "user",
        parts: [{ type: "text", text: "恋愛で同じことで悩んでしまいます。星から何かわかりますか？" }],
      },
      {
        id: "preview-assistant-1",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "何度も同じところで立ち止まると、『まただ』と自分を責めたくなりますよね。でも、繰り返し気になることは、あなたが大切にしたい関係の形を教えてくれる印でもあります。\n\nあなたの星読みでは、相手の気持ちを丁寧に受け取る力が強く出ています。そのぶん、自分の希望を伝える前に相手へ合わせすぎることがあるかもしれません。次に迷ったときは、『相手はどう思うか』の前に『私はどう感じている？』と一度だけ自分に尋ねてみてください。",
          },
        ],
      },
    ],
  },
  {
    id: "preview-work",
    title: "今の仕事を続けるべき？",
    updatedAt: "2026-08-08T04:30:00.000Z",
    messages: [],
  },
];

type PreviewProps = {
  searchParams?: Promise<{
    chat?: string | string[];
    locked?: string | string[];
    trial_exhausted?: string | string[];
  }>;
};

export default async function HoshiyomiPreviewPage({ searchParams }: PreviewProps) {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  const params = searchParams ? await searchParams : {};
  const selectedId = typeof params.chat === "string" ? params.chat : null;
  const locked = params.locked === "1";
  const trialExhausted = params.trial_exhausted === "1";
  return (
    <HoshiyomiClient
      key={selectedId ?? "home"}
      selectedConversation={
        selectedId
          ? SAMPLE_CONVERSATIONS.find((item) => item.id === selectedId) ?? null
          : null
      }
      initialRemaining={locked || trialExhausted ? 0 : 22}
      totalCredits={trialExhausted ? 1 : locked ? 0 : 30}
      persistenceReady
      hasChatAccess={!locked}
      canUpgradeToPremium={trialExhausted}
      previewMode
    />
  );
}
