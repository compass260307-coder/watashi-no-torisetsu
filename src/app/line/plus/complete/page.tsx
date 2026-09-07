// Alice Plus (LINE) Phase 3: Checkout / Billing Portal からの着地ページ。
//
// LINE内ブラウザで開かれる前提の最小ページ。やることは状態の一言表示と
// 「LINEに戻る」だけ。サイト本体への回遊導線は置かない (サイト側UIは最後の方針)。

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alice Plus | ワタシのトリセツ",
  robots: { index: false, follow: false },
};

const LINE_TALK_URL = "https://line.me/R/ti/p/%40867domoo";

const COPY: Record<string, { title: string; body: string }> = {
  success: {
    title: "お申し込みを受け付けました",
    body: "ありがとうございます。決済または無料体験の確認ができ次第、AliceからLINEにメッセージが届きます。反映まで少し時間がかかる場合があります。",
  },
  cancelled: {
    title: "手続きは行われませんでした",
    body: "登録はされていません。また話したくなったら、トークの案内リンクからいつでもどうぞ。",
  },
  portal_return: {
    title: "お手続きありがとうございました",
    body: "プランの変更内容はStripeでの手続きに沿って反映されます。LINEのトークに戻ってお話しの続きをどうぞ。",
  },
  processing: {
    title: "お申し込みを確認しています",
    body: "二重のお支払いを防ぐため、先に始まったお手続きを確認しています。少し待ってから、LINEのトークに届いている同じ案内リンクをもう一度開いてください。",
  },
  invalid: {
    title: "リンクを確認できませんでした",
    body: "有効期限が切れているかもしれません。LINEのトークに届いている新しい案内リンクから、もう一度開いてみてください。",
  },
  unavailable: {
    title: "ただいま準備中です",
    body: "Alice Plusの受付は、いま少しだけお休みしています。始まったらトークでお知らせしますね。",
  },
  error: {
    title: "うまくつながりませんでした",
    body: "少し時間をおいて、トークの案内リンクからもう一度試してみてください。",
  },
};

export default async function LinePlusCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const copy = COPY[status ?? ""] ?? COPY.error;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#faf7f2] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-stone-400">
          ALICE PLUS
        </p>
        <h1 className="mt-3 text-lg font-bold text-stone-800">{copy.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone-600">
          {copy.body}
        </p>
        <a
          href={LINE_TALK_URL}
          className="mt-8 block w-full rounded-full bg-[#06C755] px-6 py-3 text-sm font-bold text-white"
        >
          LINEに戻る
        </a>
      </div>
    </main>
  );
}
