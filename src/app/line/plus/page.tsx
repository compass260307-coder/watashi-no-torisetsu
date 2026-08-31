// Alice Plus (LINE) 紹介LP。トークの案内リンクの着地点。
//
// 直Stripeだと「いきなりカード入力画面」になるため、特典・価格・解約方法を
// 見せてから CTA で /api/line/plus/checkout へ進ませる (2026-09-01 オーナー指示)。
// 世界観はLINEリッチメニューと同じ「フェルト×星空パープル」に合わせる
// (ユーザーはリッチメニューを見た直後にこのページへ来る)。
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

// 星空ヒーローの星。ランダムだとhydrationがズレるので決め打ち配置
const STARS: Array<{ top: string; left: string; size: number; opacity: number }> = [
  { top: "6%", left: "10%", size: 3, opacity: 0.8 },
  { top: "12%", left: "82%", size: 4, opacity: 0.9 },
  { top: "18%", left: "28%", size: 2, opacity: 0.5 },
  { top: "9%", left: "55%", size: 2, opacity: 0.6 },
  { top: "24%", left: "68%", size: 3, opacity: 0.7 },
  { top: "30%", left: "14%", size: 2, opacity: 0.6 },
  { top: "38%", left: "88%", size: 3, opacity: 0.8 },
  { top: "44%", left: "6%", size: 2, opacity: 0.5 },
  { top: "52%", left: "78%", size: 2, opacity: 0.6 },
  { top: "58%", left: "22%", size: 3, opacity: 0.7 },
  { top: "68%", left: "90%", size: 2, opacity: 0.5 },
  { top: "72%", left: "12%", size: 2, opacity: 0.6 },
];

const SPARKLES: Array<{ top: string; left: string; size: string; opacity: number }> = [
  { top: "10%", left: "20%", size: "text-[14px]", opacity: 0.9 },
  { top: "20%", left: "86%", size: "text-[11px]", opacity: 0.7 },
  { top: "48%", left: "8%", size: "text-[12px]", opacity: 0.7 },
  { top: "40%", left: "72%", size: "text-[10px]", opacity: 0.6 },
];

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
    <main className="min-h-dvh bg-[#F4F1FB] pb-32">
      {/* 星空ヒーロー (リッチメニューと同じ世界観) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#241A4F] via-[#38296E] to-[#4C3A8C] px-5 pb-24 pt-12 text-center">
        {STARS.map((star, index) => (
          <span
            key={`star-${index}`}
            aria-hidden
            className="absolute rounded-full bg-white"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            }}
          />
        ))}
        {SPARKLES.map((sparkle, index) => (
          <span
            key={`sparkle-${index}`}
            aria-hidden
            className={`absolute ${sparkle.size} text-[#FFD97A]`}
            style={{ top: sparkle.top, left: sparkle.left, opacity: sparkle.opacity }}
          >
            ✦
          </span>
        ))}

        <p className="relative text-[12px] font-black tracking-[0.28em] text-[#FFD97A]">
          ALICE PLUS
        </p>
        <div className="relative mx-auto mt-5 h-44 w-44">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-[#FFD97A]/25 blur-2xl"
          />
          <Image
            src="/mascot/hoshiyomi-alice-angel-transparent.png"
            alt=""
            fill
            sizes="176px"
            className="relative object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            priority
          />
        </div>
        <h1 className="relative mt-6 text-[26px] font-black leading-snug text-white">
          Aliceと、もっと
          <br />
          たっぷり話しませんか
        </h1>
        <p className="relative mx-auto mt-4 inline-block rounded-full border border-white/25 bg-white/10 px-5 py-2 text-[13px] font-bold text-white">
          月480円・いつでも解約できます
        </p>
      </section>

      <div className="mx-auto w-full max-w-md px-5">
        {/* 深掘り占いの会話プレビュー */}
        <section className="-mt-14 rounded-3xl border border-[#5B5BEF]/10 bg-white p-6 shadow-[0_18px_44px_rgba(36,26,79,0.16)]">
          <p className="text-[11px] font-black tracking-[0.14em] text-[#5B5BEF]">
            💎 深掘り占いは、こんな感じ
          </p>
          <div className="mt-4 space-y-3 rounded-2xl bg-[#EDEAFB] p-4">
            <div className="flex justify-end">
              <p className="rounded-2xl rounded-tr-md bg-[#9BE87C] px-4 py-2.5 text-[14px] font-bold text-[#1C3A1C]">
                恋愛運
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="relative mt-1 h-8 w-8 flex-none overflow-hidden rounded-full bg-white">
                <Image
                  src="/mascot/hoshiyomi-alice-avatar-transparent.png"
                  alt=""
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
              <p className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-[13px] font-medium leading-relaxed text-[#2E2E5C]">
                このあいだ話してくれた「既読のあと、返信を待っちゃう夜」のこと、覚えていますよ。今週のあなたの恋愛運は…🔮
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] font-medium leading-relaxed text-[#2E2E5C]/55">
            恋愛運・友達運・勉強運の3テーマ。あなたの診断結果と、ふだんの会話を覚えたうえで占うので、ただの占いとはちょっと違います。
          </p>
        </section>

        {/* 無料 vs Plus 比較表 */}
        <section className="mt-5 rounded-3xl border border-[#5B5BEF]/10 bg-white p-6 shadow-[0_12px_34px_rgba(36,26,79,0.08)]">
          <p className="text-[11px] font-black tracking-[0.14em] text-[#5B5BEF]">
            無料とPLUSのちがい
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#5B5BEF]/10">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center bg-[#F4F1FB] text-center text-[12px] font-black text-[#2E2E5C]/60">
              <p className="py-3 pl-4 text-left">できること</p>
              <p className="py-3">無料</p>
              <p className="bg-[#5B5BEF] py-3 text-white">Plus</p>
            </div>
            {[
              { label: "おしゃべり", free: `1日${freeLimit}通`, plus: "上限なし" },
              { label: "今日の占い", free: "毎日1回", plus: "毎日1回" },
              { label: "深掘り占い", free: "−", plus: "◯" },
            ].map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.4fr_1fr_1fr] items-center border-t border-[#5B5BEF]/10 text-center text-[13px]"
              >
                <p className="py-3.5 pl-4 text-left font-bold text-[#2E2E5C]">
                  {row.label}
                </p>
                <p className="py-3.5 font-medium text-[#2E2E5C]/55">{row.free}</p>
                <p className="bg-[#5B5BEF]/[0.06] py-3.5 font-black text-[#5B5BEF]">
                  {row.plus}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] font-medium leading-relaxed text-[#2E2E5C]/55">
            夜中の長話も、もやもやの吐き出しも、上限を気にせずどうぞ。無料の分は、これからもずっと無料です。
          </p>
        </section>

        {/* 安心情報 */}
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

      {/* 固定CTA */}
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
              className="block w-full rounded-xl bg-gradient-to-r from-[#5B5BEF] to-[#7C5BEF] py-4 text-center text-[15px] font-black text-white shadow-[0_10px_26px_rgba(91,91,239,0.35)] transition-transform active:scale-95"
            >
              Alice Plusをはじめる
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
