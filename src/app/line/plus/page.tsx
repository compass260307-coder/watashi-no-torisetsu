// Alice Plus (LINE) 紹介LP。トークの案内リンクの着地点。
//
// 直Stripeだと「いきなりカード入力画面」になるため、特典・価格・解約方法を
// 見せてから CTA で /api/line/plus/checkout へ進ませる (2026-09-01 オーナー指示)。
// 世界観はLINEリッチメニューと同じ「フェルト×星空パープル」に合わせる
// (ユーザーはリッチメニューを見た直後にこのページへ来る)。
// LINE内ブラウザで開かれる前提のモバイルファースト1枚もの。
// 加入済みの人には CTA を「プランを確認・解約する」(Billing Portal行き) に切り替える。

import type { Metadata } from "next";
import { headers } from "next/headers";

import { lineFreeDailyLimit } from "@/lib/line-alice";
import PlusPlanChooser from "@/components/line/PlusPlanChooser";
import { recordLineEvent } from "@/lib/line-events";
import {
  findActiveLinePlusPass,
  findManageableLinePlusSubscription,
  hasLifetimeLinePlus,
  linePlusEnabled,
  linePlusPlanPriceConfigured,
  verifyLinePlusToken,
} from "@/lib/line-plus";
import {
  LINE_PLUS_PLAN_IDS,
  type LinePlusPlanId,
} from "@/lib/line-plus-products";

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
  searchParams: Promise<{
    u?: string;
    e?: string;
    s?: string;
    preview?: string;
  }>;
}) {
  const { u, e, s, preview } = await searchParams;
  const lineUserId = u ?? "";
  const expiresAtMs = Number(e);
  const signature = s ?? "";

  // 開発時のみ: ?preview=1 (未加入) / ?preview=member (加入中) / ?preview=week
  // (1週間パス利用中) / ?preview=lifetime (無期限プラン利用中) で
  // トークン・DB不要の見た目確認 (/line/missions と同じ流儀)
  const isDevPreview =
    process.env.NODE_ENV === "development" && preview !== undefined;

  if (!linePlusEnabled()) {
    return (
      <FallbackCard
        title="ただいま準備中です"
        body="Alice Plusの受付は、いま少しだけお休みしています。始まったらトークでお知らせしますね。"
      />
    );
  }
  if (
    !isDevPreview &&
    !verifyLinePlusToken({ lineUserId, expiresAtMs, signature })
  ) {
    return (
      <FallbackCard
        title="リンクの有効期限が切れています"
        body="Aliceとのトークで「プラン」と送ると、新しい案内リンクが届きます。そこからもう一度開いてみてください。"
      />
    );
  }

  const isManageable = isDevPreview
    ? preview === "member"
    : Boolean(await findManageableLinePlusSubscription(lineUserId));

  if (!isDevPreview) {
    const userAgent = (await headers()).get("user-agent") ?? "";
    if (!isPreviewBot(userAgent)) {
      await recordLineEvent({
        eventName: "line_plus_lp_viewed",
        metadata: { line_user_id: lineUserId, manageable: isManageable },
      });
    }
  }

  // 検証済みのパラメータをそのまま運ぶ。checkout API 側でもう一度検証される
  const tokenQuery = new URLSearchParams({
    u: lineUserId,
    e: String(expiresAtMs),
    s: signature,
  }).toString();
  const checkoutUrls = Object.fromEntries(
    LINE_PLUS_PLAN_IDS.map((planId) => [
      planId,
      isDevPreview
        ? "#"
        : `/api/line/plus/checkout?plan=${planId}&${tokenQuery}`,
    ]),
  ) as Record<LinePlusPlanId, string>;
  const availability = Object.fromEntries(
    LINE_PLUS_PLAN_IDS.map((planId) => [
      planId,
      isDevPreview || linePlusPlanPriceConfigured(planId),
    ]),
  ) as Record<LinePlusPlanId, boolean>;
  const hasLifetime = isDevPreview
    ? preview === "lifetime"
    : await hasLifetimeLinePlus(lineUserId);
  const activePass = isDevPreview
    ? preview === "week"
      ? { expiresAt: "2026-09-09T00:00:00.000Z", planId: "week" as const }
      : null
    : await findActiveLinePlusPass(lineUserId);
  const activePassUntil = activePass
    ? new Date(
        new Date(activePass.expiresAt).getTime() + 9 * 3_600_000,
      ).toISOString()
    : null;
  const activePassLabel = activePassUntil
    ? `${Number(activePassUntil.slice(5, 7))}月${Number(activePassUntil.slice(8, 10))}日`
    : null;
  const freeLimit = lineFreeDailyLimit();

  return (
    <main className="min-h-dvh bg-[#F4F1FB] pb-32">
      <div className="mx-auto w-full max-w-md px-5 pt-2">
        {/* タイトルロックアップ: グラデ文字+金のひし形飾り */}
        <div className="flex flex-col items-center pt-5">
          <h1 className="bg-gradient-to-r from-[#5B5BEF] via-[#7C5BEF] to-[#9B5BEF] bg-clip-text text-[24px] font-black tracking-[0.04em] text-transparent">
            Alice Plus
          </h1>
          <div aria-hidden className="mt-1.5 flex items-center gap-2">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#E8B93E]" />
            <span className="h-1.5 w-1.5 rotate-45 bg-[#FFD97A]" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#E8B93E]" />
          </div>
        </div>

        {/* 無料 vs Plus 比較表 */}
        <section className="mt-6 rounded-3xl border border-[#5B5BEF]/10 bg-white p-6 shadow-[0_12px_34px_rgba(36,26,79,0.08)]">
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
              { label: "タロット占い", free: "−", plus: "◯" },
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

        {/* プランをえらぶ: サブスク/買い切りの2グループ+ラジオ選択 (ラブ教授UI参考)。
            下部固定CTAは選択中プランに追従するためコンポーネント側が持つ */}
        {!hasLifetime && !isManageable && (
          <PlusPlanChooser
            checkoutUrls={checkoutUrls}
            availability={availability}
            activePassLabel={activePassLabel}
          />
        )}

        {/* 安心情報 */}
        <ul className="mt-6 space-y-2 px-1 text-[12px] font-medium leading-relaxed text-[#2E2E5C]/60">
          <li>
            ・初回加入なら最初の1週間は無料。無料期間中に解約すれば、料金はかかりません
          </li>
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
      {/* 加入済み系の固定CTA。未加入者のCTAは PlusPlanChooser 側 (選択追従) */}
      {(hasLifetime || isManageable) && (
      <div className="fixed inset-x-0 bottom-0 border-t border-[#5B5BEF]/10 bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md">
          {hasLifetime ? (
            <>
              <p className="mb-2 text-center text-[12px] font-bold text-[#2E2E5C]/60">
                無期限プランをご利用中です。ずっと一緒にいられますね🌙
              </p>
              <a
                href={LINE_TALK_URL}
                className="block w-full rounded-xl bg-[#06C755] py-3.5 text-center text-[15px] font-black text-white transition-transform active:scale-95"
              >
                Aliceと話しにいく
              </a>
            </>
          ) : (
            <>
              <p className="mb-2 text-center text-[12px] font-bold text-[#2E2E5C]/60">
                Alice Plusをご利用中です。いつもありがとうございます。
              </p>
              <a
                href={checkoutUrls.monthly}
                className="block w-full rounded-xl border-2 border-[#5B5BEF] py-3.5 text-center text-[15px] font-black text-[#5B5BEF] transition-transform active:scale-95"
              >
                プランを確認・解約する
              </a>
            </>
          )}
        </div>
      </div>
      )}
    </main>
  );
}
