// Alice Plus (LINE) 紹介LP。トークの案内リンクの着地点。
//
// 直Stripeだと「いきなりカード入力画面」になるため、特典・価格・解約方法を
// 見せてから CTA で /api/line/plus/checkout へ進ませる (2026-09-01 オーナー指示)。
// LINE内ブラウザで開かれる前提のモバイルファースト1枚もの。
// 加入済みの人には CTA を「プランを確認・解約する」(Billing Portal行き) に切り替える。

import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";

import { lineFreeDailyLimit } from "@/lib/line-alice";
import { recordLineEvent } from "@/lib/line-events";
import {
  findManageableLinePlusSubscription,
  linePlusEnabled,
  verifyLinePlusToken,
} from "@/lib/line-plus";

export const metadata: Metadata = {
  title: "Alice Plus | ワタシのトリセツ",
  robots: { index: false, follow: false },
};

const LINE_TALK_URL = "https://line.me/R/ti/p/%40867domoo";

// LINEのURLプレビュー取得 (line-poker等) をLP閲覧として数えない
function isPreviewBot(userAgent: string): boolean {
  return /bot|facebookexternalhit|line-poker|crawler|spider|preview/i.test(
    userAgent,
  );
}

function FallbackCard({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#faf7f2] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-stone-400">
          ALICE PLUS
        </p>
        <h1 className="mt-3 text-lg font-bold text-stone-800">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone-600">{body}</p>
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

export default async function LinePlusPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; e?: string; s?: string }>;
}) {
  const { u, e, s } = await searchParams;
  const lineUserId = u ?? "";
  const expiresAtMs = Number(e);
  const signature = s ?? "";

  if (!linePlusEnabled()) {
    return (
      <FallbackCard
        title="ただいま準備中です"
        body="Alice Plusの受付は、いま少しだけお休みしています。始まったらトークでお知らせしますね。"
      />
    );
  }
  if (!verifyLinePlusToken({ lineUserId, expiresAtMs, signature })) {
    return (
      <FallbackCard
        title="リンクの有効期限が切れています"
        body="Aliceとのトークで「プラン」と送ると、新しい案内リンクが届きます。そこからもう一度開いてみてください。"
      />
    );
  }

  const isManageable = Boolean(
    await findManageableLinePlusSubscription(lineUserId),
  );

  const userAgent = (await headers()).get("user-agent") ?? "";
  if (!isPreviewBot(userAgent)) {
    await recordLineEvent({
      eventName: "line_plus_lp_viewed",
      metadata: { line_user_id: lineUserId, manageable: isManageable },
    });
  }

  // 検証済みのパラメータをそのまま運ぶ。checkout API 側でもう一度検証される
  const checkoutUrl = `/api/line/plus/checkout?${new URLSearchParams({
    u: lineUserId,
    e: String(expiresAtMs),
    s: signature,
  }).toString()}`;
  const freeLimit = lineFreeDailyLimit();

  return (
    <main className="min-h-dvh bg-[#faf7f2] px-5 pb-32 pt-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-center text-[11px] font-black tracking-[0.2em] text-[#5B5BEF]">
          ALICE PLUS
        </p>
        <div className="relative mx-auto mt-4 h-24 w-24">
          <Image
            src="/mascot/hoshiyomi-alice-avatar-transparent.png"
            alt=""
            fill
            sizes="96px"
            className="object-contain"
            priority
          />
        </div>
        <h1 className="mt-4 text-center text-[24px] font-black leading-snug text-[#2E2E5C]">
          Aliceと、もっと
          <br />
          たっぷり話しませんか
        </h1>
        <p className="mt-3 text-center text-[14px] font-bold text-[#2E2E5C]/70">
          月480円・いつでも解約できます
        </p>

        <section className="mt-8 rounded-2xl border border-[#5B5BEF]/15 bg-white p-6 shadow-[0_12px_34px_rgba(46,46,92,0.08)]">
          <p className="text-[11px] font-black tracking-[0.14em] text-[#5B5BEF]">
            💎 PLUSでできること
          </p>
          <ul className="mt-4 space-y-5">
            <li>
              <p className="text-[15px] font-black text-[#2E2E5C]">
                上限なしのおしゃべり
              </p>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#2E2E5C]/65">
                1日の上限を気にせず、話したいだけAliceと話せます。夜中の長話も大丈夫。
              </p>
            </li>
            <li>
              <p className="text-[15px] font-black text-[#2E2E5C]">
                テーマ別の深掘り占い
              </p>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#2E2E5C]/65">
                恋愛運・友達運・勉強運。あなたの診断結果と会話を覚えたうえで占うので、ただの占いとはちょっと違います。
              </p>
            </li>
          </ul>
        </section>

        <section className="mt-4 rounded-2xl border border-[#5B5BEF]/10 bg-[#F3F0FF] p-6">
          <p className="text-[11px] font-black tracking-[0.14em] text-[#2E2E5C]/55">
            🔮 無料のままでも
          </p>
          <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#2E2E5C]/70">
            1日{freeLimit}
            通のおしゃべりと、毎日の「今日の占い」はずっと無料です。急がなくて大丈夫。気になったときが、いいタイミングですよ。
          </p>
        </section>

        <ul className="mt-6 space-y-2 px-1 text-[12px] font-medium leading-relaxed text-[#2E2E5C]/60">
          <li>・いつでも解約できます。解約後も、期間の終わりまでは使えます</li>
          <li>・お支払いはStripeの安全な決済画面で行われます</li>
          <li>
            ・
            <a
              href="/legal/commerce"
              className="font-bold text-[#5B5BEF] underline underline-offset-2"
            >
              特定商取引法に基づく表記
            </a>
          </li>
        </ul>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-[#5B5BEF]/10 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          {isManageable ? (
            <>
              <p className="mb-2 text-center text-[12px] font-bold text-[#2E2E5C]/60">
                Alice Plusをご利用中です。いつもありがとうございます。
              </p>
              <a
                href={checkoutUrl}
                className="block w-full rounded-xl border-2 border-[#5B5BEF] py-3.5 text-center text-[15px] font-black text-[#5B5BEF] transition-transform active:scale-95"
              >
                プランを確認・解約する
              </a>
            </>
          ) : (
            <a
              href={checkoutUrl}
              className="block w-full rounded-xl bg-[#5B5BEF] py-4 text-center text-[15px] font-black text-white transition-transform active:scale-95"
            >
              Alice Plusをはじめる
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
