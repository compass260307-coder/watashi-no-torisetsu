import { HoshiyomiClient } from "@/components/hoshiyomi/HoshiyomiClient";
import type { ResultLocale } from "@/i18n/result";
import type { HoshiyomiConversationSummary } from "@/lib/hoshiyomi/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const SAMPLE_CONVERSATIONS: Record<
  ResultLocale,
  HoshiyomiConversationSummary[]
> = {
  ja: [
    {
      id: "preview-love",
      title: "恋愛で同じことで悩んでしまいます",
      updatedAt: "2026-08-13T10:18:00.000Z",
      messages: [
        {
          id: "preview-user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text: "恋愛で同じことで悩んでしまいます。星から何かわかりますか？",
            },
          ],
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
  ],
  ko: [
    {
      id: "preview-love",
      title: "연애에서 같은 고민을 반복하고 있어요",
      updatedAt: "2026-08-13T10:18:00.000Z",
      messages: [
        {
          id: "preview-user-1",
          role: "user",
          parts: [
            {
              type: "text",
              text: "연애에서 같은 고민을 반복하고 있어요. 별을 보면 알 수 있는 게 있을까요?",
            },
          ],
        },
        {
          id: "preview-assistant-1",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "같은 자리에서 여러 번 멈추게 되면 ‘또 이러네’ 하며 스스로를 탓하고 싶어지죠. 하지만 자꾸 마음에 걸리는 일은 내가 소중히 여기고 싶은 관계의 모습을 알려 주는 신호이기도 해요.\n\n별자리 해석을 보면 상대의 마음을 세심하게 받아들이는 힘이 크게 나타나요. 그만큼 내 바람을 말하기 전에 상대에게 지나치게 맞추고 있을지도 몰라요. 다음에 망설여질 때는 ‘상대는 어떻게 생각할까?’보다 먼저 ‘나는 어떻게 느끼고 있지?’라고 자신에게 한 번만 물어보세요.",
            },
          ],
        },
      ],
    },
    {
      id: "preview-work",
      title: "지금 일을 계속해야 할까요?",
      updatedAt: "2026-08-08T04:30:00.000Z",
      messages: [],
    },
  ],
};

type PreviewProps = {
  searchParams?: Promise<{
    chat?: string | string[];
    locale?: string | string[];
    locked?: string | string[];
    trial_exhausted?: string | string[];
  }>;
};

export default async function HoshiyomiPreviewPage({ searchParams }: PreviewProps) {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  const params = searchParams ? await searchParams : {};
  const locale: ResultLocale = params.locale === "ko" ? "ko" : "ja";
  const conversations = SAMPLE_CONVERSATIONS[locale];
  const selectedId = typeof params.chat === "string" ? params.chat : null;
  const locked = params.locked === "1";
  const trialExhausted = params.trial_exhausted === "1";
  return (
    <HoshiyomiClient
      key={`${locale}-${selectedId ?? "home"}`}
      selectedConversation={
        selectedId
          ? conversations.find((item) => item.id === selectedId) ?? null
          : null
      }
      initialRemaining={locked || trialExhausted ? 0 : 22}
      totalCredits={trialExhausted ? 1 : locked ? 0 : 30}
      persistenceReady
      hasChatAccess={!locked}
      canUpgradeToPremium={trialExhausted}
      previewMode
      locale={locale}
    />
  );
}
