// Alice Plus (LINE) 紹介LP。トークの案内リンクの着地点。
// LINE内ブラウザ前提のモバイルファーストLP。プランの価値と課金条件を
// 理解してから /api/line/plus/checkout へ進める構成にする。

import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { after } from "next/server";

import LinePlusStory from "@/components/line/LinePlusStory";
import motionStyles from "@/components/line/LinePlusMotion.module.css";
import PlusMotionController from "@/components/line/PlusMotionController";
import PlusPlanChooser from "@/components/line/PlusPlanChooser";
import { lineFreeDailyLimit } from "@/lib/line-alice";
import { recordLineEvent } from "@/lib/line-events";
import {
  findActiveLinePlusPass,
  findManageableLinePlusSubscription,
  hasLifetimeLinePlus,
  hasLinePlusHistory,
  linePlusEnabled,
  linePlusPlanPriceConfigured,
  verifyLinePlusToken,
} from "@/lib/line-plus";
import {
  LINE_PLUS_PLANS,
  type LinePlusPassPlanId,
  type LinePlusPlanId,
} from "@/lib/line-plus-products";

export const metadata: Metadata = {
  title: "Alice Plus",
  description:
    "Aliceとのおしゃべりをもっと自由に。深掘り占いとタロットも楽しめるLINE限定プランです。",
  robots: { index: false, follow: false },
};

const LINE_TALK_URL = "https://line.me/R/ti/p/%40867domoo";
const DEV_PREVIEW_PASS_EXPIRES_AT = new Date(
  Date.now() + 36 * 60 * 60 * 1000,
).toISOString();

type IconProps = { className?: string };

function SparkleIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="m12 2 1.55 5.1a5 5 0 0 0 3.35 3.35L22 12l-5.1 1.55a5 5 0 0 0-3.35 3.35L12 22l-1.55-5.1a5 5 0 0 0-3.35-3.35L2 12l5.1-1.55a5 5 0 0 0 3.35-3.35L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="m4 10.2 3.5 3.5L16 5.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// LINEのURLプレビュー取得 (line-poker等) をLP閲覧として数えない。
function isPreviewBot(userAgent: string): boolean {
  return /bot|facebookexternalhit|line-poker|crawler|spider|preview/i.test(
    userAgent,
  );
}

function FallbackCard({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F6F3FB] px-6">
      <div className="w-full max-w-sm rounded-[28px] border border-[#DDD7EE] bg-white p-8 text-center shadow-[0_18px_50px_rgba(38,24,78,0.12)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEEAFB] text-[#6558D9]">
          <SparkleIcon className="h-6 w-6" />
        </div>
        <p className="mt-5 text-[11px] font-bold tracking-[0.18em] text-[#7C70D9]">
          ALICE PLUS
        </p>
        <h1 className="mt-3 text-xl font-bold text-[#27213F]">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#69627D]">{body}</p>
        <a
          href={LINE_TALK_URL}
          className="mt-8 block w-full rounded-2xl bg-[#06C755] px-6 py-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(6,199,85,0.22)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#AEEAC8] motion-reduce:transition-none motion-reduce:active:scale-100"
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

  // 開発時のみ: ?preview=1 (初回・未加入) / ?preview=returning (再加入) /
  // ?preview=member (加入中) / ?preview=past_due (支払い要確認) /
  // ?preview=day|week|month_pass (期間パス利用中) / ?preview=lifetime (旧無期限利用中)。
  const isDevPreview =
    process.env.NODE_ENV === "development" && preview !== undefined;
  const previewPassPlanId: LinePlusPassPlanId | null =
    preview === "day" || preview === "week" || preview === "month_pass"
      ? preview
      : null;

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

  const [manageableSubscription, hasLifetime, activePass, hasHistory] =
    isDevPreview
      ? [
          preview === "member" || preview === "past_due"
            ? {
                stripeCustomerId: "preview",
                status: preview === "past_due" ? "past_due" : "active",
              }
            : null,
          preview === "lifetime",
          previewPassPlanId
            ? {
                expiresAt: DEV_PREVIEW_PASS_EXPIRES_AT,
                planId: previewPassPlanId,
              }
            : null,
          preview === "returning" ||
            preview === "member" ||
            preview === "past_due" ||
            preview === "lifetime",
        ]
      : await Promise.all([
          findManageableLinePlusSubscription(lineUserId),
          hasLifetimeLinePlus(lineUserId),
          findActiveLinePlusPass(lineUserId),
          hasLinePlusHistory(lineUserId),
        ]);
  const isManageable = Boolean(manageableSubscription);
  const isPastDue = manageableSubscription?.status === "past_due";
  const trialEligible = !hasHistory;
  const hasExistingAccess = isManageable || hasLifetime || Boolean(activePass);
  const salesEnabled = isDevPreview || linePlusEnabled();

  // 販売を止めても、既存会員の管理・期間パスの期限確認・旧無期限権利は閉じない。
  if (!salesEnabled && !hasExistingAccess) {
    return (
      <FallbackCard
        title="ただいま準備中です"
        body="Alice Plusの受付は、いま少しだけお休みしています。始まったらトークでお知らせしますね。"
      />
    );
  }

  if (!isDevPreview) {
    const userAgent = (await headers()).get("user-agent") ?? "";
    if (!isPreviewBot(userAgent)) {
      after(async () => {
        await recordLineEvent({
          eventName: "line_plus_lp_viewed",
          metadata: {
            line_user_id: lineUserId,
            manageable: isManageable,
            trial_eligible: trialEligible,
          },
        });
      });
    }
  }

  // 検証済みのパラメータをそのまま運ぶ。checkout API側でも再検証する。
  const tokenQuery = new URLSearchParams({
    u: lineUserId,
    e: String(expiresAtMs),
    s: signature,
  }).toString();
  const planUrl = (planId: LinePlusPlanId) =>
    isDevPreview
      ? "#plans"
      : `/api/line/plus/checkout?plan=${planId}&${tokenQuery}`;
  const checkoutUrls: Partial<Record<LinePlusPlanId, string>> = {
    monthly: planUrl("monthly"),
    annual: planUrl("annual"),
    day: planUrl("day"),
    week: planUrl("week"),
    month_pass: planUrl("month_pass"),
  };
  const availability: Record<LinePlusPlanId, boolean> = {
    monthly:
      !activePass &&
      (isDevPreview ||
        (salesEnabled && linePlusPlanPriceConfigured("monthly"))),
    annual:
      !activePass &&
      (isDevPreview || (salesEnabled && linePlusPlanPriceConfigured("annual"))),
    day: isDevPreview || (salesEnabled && linePlusPlanPriceConfigured("day")),
    week: isDevPreview || (salesEnabled && linePlusPlanPriceConfigured("week")),
    month_pass:
      isDevPreview ||
      (salesEnabled && linePlusPlanPriceConfigured("month_pass")),
  };
  const checkoutUrl = checkoutUrls.monthly as string;
  const activePassLabel = activePass
    ? new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(activePass.expiresAt))
    : null;
  const freeLimit = lineFreeDailyLimit();
  const isMember = hasLifetime || isManageable;
  const hasActiveAccess = isMember || Boolean(activePass);
  const heroCtaHref = isPastDue
    ? checkoutUrl
    : hasActiveAccess
      ? LINE_TALK_URL
      : "#plans";
  const heroCtaLabel = isPastDue
    ? "お支払い方法を確認する"
    : hasActiveAccess
      ? "Aliceと話しにいく"
      : trialEligible
        ? "Alice Plusを試す"
        : "月額Plusをはじめる";
  const heroCtaNote = isPastDue
    ? "Stripeのお支払い管理画面へ移動します"
    : hasActiveAccess
      ? "いつものLINEトークへ移動します"
      : trialEligible
        ? null
        : "価格は税込。お申し込み前に請求内容を確認できます。";

  return (
    <main
      id="alice-plus-page"
      data-plus-page
      data-plus-sticky="hidden"
      className="min-h-dvh overflow-x-clip bg-[#F6F3FB] pb-8 text-[#302847]"
    >
      <PlusMotionController />
      <div className="mx-auto w-full max-w-[480px] bg-[#F6F3FB] sm:my-5 sm:rounded-[38px] sm:shadow-[0_28px_90px_rgba(37,24,78,0.18)]">
        <section
          id="plus-hero"
          data-plus-hero
          className={`${motionStyles.hero} relative isolate grid overflow-hidden bg-[#17102F] text-white sm:rounded-t-[38px]`}
        >
          <div
            className={`${motionStyles.heroMedia} relative col-start-1 row-start-1`}
          >
            <Image
              src="/line/alice-plus-hero-v2.webp"
              alt="星空に浮かぶ会話バブルと本、タロットカード"
              fill
              preload
              sizes="(max-width: 520px) 100vw, 480px"
              className={`${motionStyles.heroImage} object-cover`}
            />
            <div className={motionStyles.heroGlow} />
            <span
              aria-hidden="true"
              className={`${motionStyles.star} ${motionStyles.starOne}`}
            />
            <span
              aria-hidden="true"
              className={`${motionStyles.star} ${motionStyles.starTwo}`}
            />
            <span
              aria-hidden="true"
              className={`${motionStyles.star} ${motionStyles.starThree}`}
            />
            <p className="absolute top-5 left-5 z-[3] inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#100923]/65 px-3.5 py-2 text-[11px] font-bold tracking-[0.12em] text-white shadow-[0_8px_24px_rgba(5,2,18,0.2)] backdrop-blur-md">
              <span aria-hidden="true" className="text-[#F4D36F]">
                ✦
              </span>
              Alice Plus
            </p>
          </div>

          <div
            className={`${motionStyles.heroCopy} relative z-[3] col-start-1 row-start-1 self-end px-6 pb-7`}
          >
            <h1
              className={`${motionStyles.heroHeadline} font-bold leading-[1.42] tracking-[-0.035em] text-white`}
            >
              <span className="sr-only">
                話したいこと、途中で終わらせなくていい。
              </span>
              <span aria-hidden="true">
                話したい夜を、
                <span className={motionStyles.headlineCarousel}>
                  <span className={motionStyles.headlinePhrase}>
                    途中で終わらせない。
                  </span>
                  <span className={motionStyles.headlinePhrase}>
                    もっと深く見つめる。
                  </span>
                  <span className={motionStyles.headlinePhrase}>
                    Aliceと自由に話せる。
                  </span>
                </span>
              </span>
            </h1>
            {hasActiveAccess && (
              <div
                className={`${motionStyles.glassCard} mt-5 rounded-2xl border border-[#F0D77D]/25 bg-white/[0.09] px-4 py-3.5 backdrop-blur-md`}
              >
                <p className="flex items-center gap-2 text-[11px] font-bold text-[#FFE18C]">
                  <CheckIcon className="h-4 w-4" />
                  {isPastDue
                    ? "お支払い方法の確認が必要です"
                    : hasLifetime
                      ? "販売終了済みの無期限プランをご利用中"
                      : activePass && activePassLabel
                        ? `${LINE_PLUS_PLANS[activePass.planId].label}を${activePassLabel}まで利用中`
                        : "Alice Plusをご利用中"}
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-white/65">
                  {isPastDue
                    ? "プラン管理画面から、お支払い方法をご確認ください。"
                    : "Plusの機能をすべてお使いいただけます。"}
                </p>
              </div>
            )}

            <a
              href={heroCtaHref}
              className={`${motionStyles.primaryCta} mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[15px] font-bold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/55 motion-reduce:transition-none motion-reduce:active:scale-100 ${
                hasActiveAccess && !isPastDue
                  ? "bg-[#06C755] text-white shadow-[0_12px_28px_rgba(6,199,85,0.22)]"
                  : "bg-gradient-to-r from-[#F2CB62] to-[#FFE7A1] text-[#4A3500] shadow-[0_12px_28px_rgba(232,185,62,0.25)]"
              }`}
            >
              <span className="relative z-10">{heroCtaLabel}</span>
              {!hasActiveAccess && (
                <span aria-hidden="true" className="relative z-10">
                  ↓
                </span>
              )}
            </a>
            {heroCtaNote && (
              <p className="mt-3 text-center text-[10px] leading-5 text-white/60">
                {heroCtaNote}
              </p>
            )}
          </div>
        </section>

        <LinePlusStory freeLimit={freeLimit} />

        {!isMember ? (
          <PlusPlanChooser
            checkoutUrls={checkoutUrls}
            availability={availability}
            activePass={
              activePass && activePassLabel
                ? {
                    planId: activePass.planId,
                    untilLabel: activePassLabel,
                  }
                : null
            }
            trialEligible={trialEligible}
          />
        ) : (
          <section
            id="membership"
            data-plus-sticky-stop
            data-plus-reveal="scale"
            className={`${motionStyles.revealScale} ${motionStyles.membershipSection} scroll-mt-5 px-5 py-12`}
          >
            <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#5C4FC6] via-[#7160D6] to-[#9275DE] p-[1px] shadow-[0_18px_40px_rgba(80,63,170,0.22)]">
              <div className="rounded-[27px] bg-[#211844] px-6 py-7 text-center text-white">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-[#F3D779]">
                  <CheckIcon className="h-3.5 w-3.5" />
                  {isPastDue
                    ? "お支払い方法の確認が必要"
                    : hasLifetime
                      ? "旧・無期限プラン利用中"
                      : "ALICE PLUS 利用中"}
                </span>
                <h2 className="mt-5 text-[23px] font-bold">
                  {isPastDue
                    ? "お支払い情報をご確認ください。"
                    : "これからも、ゆっくり話しましょう。"}
                </h2>
                <p className="mt-3 text-[13px] leading-6 text-white/65">
                  {isPastDue
                    ? "プランを続けるには、お支払い管理画面から決済方法をご確認ください。"
                    : hasLifetime
                      ? "無期限プランをご利用中です。追加のお支払いはありません。"
                      : "Alice Plusのサブスクリプションをご利用中です。プランの確認や解約は、下のボタンからいつでも行えます。"}
                </p>
                {!isPastDue && (
                  <a
                    href={LINE_TALK_URL}
                    className="mt-6 block rounded-2xl bg-[#06C755] px-5 py-4 text-[14px] font-bold text-white shadow-[0_10px_24px_rgba(6,199,85,0.22)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/55 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    Aliceと話しにいく
                  </a>
                )}
                {!hasLifetime && (
                  <a
                    href={checkoutUrl}
                    className={`${isPastDue ? "mt-6 bg-white text-[#4F438F]" : "mt-3 border border-white/20 text-white/85"} block rounded-2xl px-5 py-3.5 text-[13px] font-bold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/55 motion-reduce:transition-none motion-reduce:active:scale-100`}
                  >
                    {isPastDue
                      ? "お支払い方法を確認する"
                      : "プランを確認・解約する"}
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        <footer
          data-plus-sticky-stop
          className="bg-[#211844] px-5 py-4 text-white sm:rounded-b-[38px]"
        >
          <nav
            aria-label="法的情報"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[11px] text-white/60"
          >
            <a
              href="/terms"
              className="rounded-sm px-1 py-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              利用規約
            </a>
            <a
              href="/legal/commerce"
              className="rounded-sm px-1 py-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              特定商取引法に基づく表記
            </a>
            <a
              href="/privacy"
              className="rounded-sm px-1 py-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              プライバシーポリシー
            </a>
          </nav>
        </footer>
      </div>

      {isMember && (
        <div
          className={`${motionStyles.stickyCta} fixed inset-x-0 bottom-0 z-40 border-t border-[#DDD7EE] bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 shadow-[0_-10px_30px_rgba(38,24,78,0.1)] backdrop-blur-xl`}
        >
          <div className="mx-auto w-full max-w-[440px]">
            {hasLifetime ? (
              <a
                href={LINE_TALK_URL}
                className="block w-full rounded-2xl bg-[#06C755] py-4 text-center text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(6,199,85,0.22)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#AEEAC8] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                Aliceと話しにいく
              </a>
            ) : (
              <a
                href={checkoutUrl}
                className="block w-full rounded-2xl border-2 border-[#6558D9] py-3.5 text-center text-[14px] font-bold text-[#5C50C6] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#BEB4F4] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {isPastDue
                  ? "お支払い方法を確認する"
                  : "プランを確認・解約する"}
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
