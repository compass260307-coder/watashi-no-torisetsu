"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  CheckoutCancelledModal,
  useCheckoutCancelledProduct,
} from "@/components/checkout/CheckoutCancelledNotice";
import { KoreanPurchaseLegalNotice } from "@/components/checkout/KoreanPurchaseLegalNotice";
import { FullAccessCta } from "./FullAccessCta";
import { PeekButton, type UnlockPeek } from "./PaywallPeek";
import {
  PEEK_AISHO,
  PEEK_ALICE,
  PEEK_EBOOK,
  PEEK_FRIENDS,
  PEEK_UNMEI,
} from "./paywall-peek-content";
import {
  accessProductPrice,
  EMPTY_ACCESS_ENTITLEMENTS,
  FULL_ACCESS_LIST_PRICE_JPY,
  FULL_ACCESS_PRICE_JPY,
  PREMIUM_BUNDLE_LIST_PRICE_JPY,
  PREMIUM_BUNDLE_PRICE_JPY,
  SELF_REPORT_LIST_PRICE_JPY,
  SELF_REPORT_PRICE_JPY,
  FULL_ACCESS_DISCOUNT_PERCENT_KRW,
  FULL_ACCESS_LIST_PRICE_KRW,
  FULL_ACCESS_PRICE_KRW,
  PREMIUM_BUNDLE_DISCOUNT_PERCENT_KRW,
  PREMIUM_BUNDLE_LIST_PRICE_KRW,
  PREMIUM_BUNDLE_PRICE_KRW,
  SELF_REPORT_DISCOUNT_PERCENT_KRW,
  SELF_REPORT_LIST_PRICE_KRW,
  SELF_REPORT_PRICE_KRW,
  SINGLE_ALL_ACCESS_PAYWALL_PRODUCT,
  THREE_COURSE_PAYWALL_VERSION,
  type AccessEntitlements,
  type AccessProduct,
  type PaywallPlacement,
} from "@/lib/access-products";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import { DIAGNOSIS_COUNT_SNAPSHOT } from "@/lib/proof-stats";
import { requestFullAccessStatus } from "@/lib/use-course-navigation-access";
import type { ResultLocale } from "@/i18n/result";

type PlanDefinition = Readonly<{
  product: AccessProduct;
  eyebrow: string;
  title: string;
  basePrice: number;
  listPrice?: number;
  badge?: string;
  iconSrc?: string;
  accent: string;
  soft: string;
  items: readonly string[];
  inheritedItemCount: number;
}>;

const JA_DESTINY_ITEM = "あなた専用「運命の設計図」";
const JA_AISHO_ITEM = "相性診断機能を解放";
const JA_TAROT_ITEM = "Aliceのタロット占い3種類をすべて解放";
const KO_AISHO_ITEM = "두 사람의 궁합 진단 결과 전체 해제";
const JA_LIGHT_ACCESS_ITEMS = [
  "自己診断結果のロック9つ全て",
  "16ページ以上の専用の電子書籍",
  "２人目以降の友達診断の結果",
  "何度でも作り直せる他己分析PDF",
] as const;
const JA_FULL_ACCESS_ITEMS = [
  ...JA_LIGHT_ACCESS_ITEMS,
  JA_DESTINY_ITEM,
  "占い師『Alice』とのチャット30回",
  JA_TAROT_ITEM,
  JA_AISHO_ITEM,
] as const;
const KO_LIGHT_ACCESS_ITEMS = [
  "자기 진단 결과의 잠금 9개 전체 해제",
  "16페이지 이상의 전용 전자책",
  "두 번째 친구부터 친구 진단 결과 전체 해제",
  "몇 번이든 다시 만들 수 있는 타인 분석 PDF",
] as const;
const KO_FULL_ACCESS_ITEMS = [
  ...KO_LIGHT_ACCESS_ITEMS,
  "나만을 위한 ‘운명의 설계도’",
  "점성술사 ‘Alice’와 채팅 30회",
  "Alice의 타로 세 종류 모두 해제",
  KO_AISHO_ITEM,
] as const;

function japaneseThreeCourseReleaseBadge(
  price: number,
  listPrice: number,
): string {
  const discountPercent = Math.round((1 - price / listPrice) * 100);
  return `リリース記念 ${discountPercent}%OFF`;
}

const JA_PLANS: readonly PlanDefinition[] = [
  {
    product: "self_report",
    eyebrow: "学生の方へ",
    title: "学生向けプラン",
    basePrice: SELF_REPORT_PRICE_JPY,
    listPrice: SELF_REPORT_LIST_PRICE_JPY,
    badge: japaneseThreeCourseReleaseBadge(
      SELF_REPORT_PRICE_JPY,
      SELF_REPORT_LIST_PRICE_JPY,
    ),
    iconSrc: "/pricing/self-report-felt-transparent.png",
    accent: "#4F92A7",
    soft: "#EAF6F8",
    inheritedItemCount: 0,
    items: JA_LIGHT_ACCESS_ITEMS,
  },
  {
    product: "full_access",
    eyebrow: "自己・友達・占いまで",
    title: "完全版コース",
    basePrice: FULL_ACCESS_PRICE_JPY,
    listPrice: FULL_ACCESS_LIST_PRICE_JPY,
    badge: japaneseThreeCourseReleaseBadge(
      FULL_ACCESS_PRICE_JPY,
      FULL_ACCESS_LIST_PRICE_JPY,
    ),
    iconSrc: "/pricing/full-access-connection-felt-transparent.png",
    accent: "#5B5BEF",
    soft: "#EEEEFF",
    inheritedItemCount: 0,
    items: JA_FULL_ACCESS_ITEMS,
  },
  {
    product: "premium_bundle",
    eyebrow: "すべてを、これひとつで",
    title: "全部入り・買い切り",
    basePrice: PREMIUM_BUNDLE_PRICE_JPY,
    listPrice: PREMIUM_BUNDLE_LIST_PRICE_JPY,
    badge: japaneseThreeCourseReleaseBadge(
      PREMIUM_BUNDLE_PRICE_JPY,
      PREMIUM_BUNDLE_LIST_PRICE_JPY,
    ),
    iconSrc: "/pricing/premium-destiny-felt-transparent.png",
    accent: "#9A6A24",
    soft: "#FFF6DF",
    inheritedItemCount: 0,
    items: ["完全版コースのすべての機能"],
  },
] as const;

function japanesePlanItemPeek(
  item: string,
  ebookPeek: UnlockPeek,
): UnlockPeek | undefined {
  if (item.includes("Alice")) return PEEK_ALICE;
  if (item.includes("相性診断")) return PEEK_AISHO;
  if (item.includes("運命の設計図")) return PEEK_UNMEI;
  if (item.includes("電子書籍") || item.includes("自己分析PDF")) {
    return ebookPeek;
  }
  if (item.includes("友達診断") || item.includes("他己分析PDF")) {
    return PEEK_FRIENDS;
  }
  return undefined;
}

const KO_PLANS: readonly PlanDefinition[] = [
  {
    product: "self_report",
    eyebrow: "학생을 위한 플랜",
    title: "학생 플랜",
    basePrice: SELF_REPORT_PRICE_KRW,
    listPrice: SELF_REPORT_LIST_PRICE_KRW,
    badge: `출시 기념 ${SELF_REPORT_DISCOUNT_PERCENT_KRW}% 할인`,
    iconSrc: "/pricing/self-report-felt-transparent.png",
    accent: "#4F92A7",
    soft: "#EAF6F8",
    inheritedItemCount: 0,
    items: KO_LIGHT_ACCESS_ITEMS,
  },
  {
    product: "full_access",
    eyebrow: "자기 진단·친구 진단·운세까지",
    title: "완전판 코스",
    basePrice: FULL_ACCESS_PRICE_KRW,
    listPrice: FULL_ACCESS_LIST_PRICE_KRW,
    badge: `출시 기념 ${FULL_ACCESS_DISCOUNT_PERCENT_KRW}% 할인`,
    iconSrc: "/pricing/full-access-connection-felt-transparent.png",
    accent: "#5B5BEF",
    soft: "#EEEEFF",
    inheritedItemCount: 0,
    items: KO_FULL_ACCESS_ITEMS,
  },
  {
    product: "premium_bundle",
    eyebrow: "나만의 운명 설계도까지",
    title: "프리미엄 코스",
    basePrice: PREMIUM_BUNDLE_PRICE_KRW,
    listPrice: PREMIUM_BUNDLE_LIST_PRICE_KRW,
    badge: `출시 기념 ${PREMIUM_BUNDLE_DISCOUNT_PERCENT_KRW}% 할인`,
    iconSrc: "/pricing/premium-destiny-felt-transparent.png",
    accent: "#9A6A24",
    soft: "#FFF6DF",
    inheritedItemCount: 1,
    items: [
      "완전판 코스의 모든 기능에 더해, 다음 기능을 이용할 수 있습니다",
      "AI 점성술사 채팅 상담이 총 30회로 확대",
      "출생 정보와 성격 진단을 함께 읽는 한국어 운명의 설계도",
      KO_AISHO_ITEM,
    ],
  },
] as const;

function formatJpy(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function formatPrice(value: number, locale: ResultLocale): string {
  return locale === "ko"
    ? `₩${value.toLocaleString("ko-KR")}`
    : formatJpy(value);
}

// 価格タグは本文と同じ Noto Sans JP/KR の 700 で描く (M PLUS は丸すぎるため撤回
// 2026-09-04)。数字幅の安定は表示側の tabular-nums で担保する。
function priceNode(value: number, locale: ResultLocale): React.ReactNode {
  return formatPrice(value, locale);
}

function isPurchased(
  product: AccessProduct,
  entitlements: AccessEntitlements,
): boolean {
  if (product === "self_report") return entitlements.selfReport;
  if (product === "full_access") return entitlements.full;
  return entitlements.premiumBundle;
}

function baseCtaLabel(product: AccessProduct, locale: ResultLocale): string {
  if (locale === "ko") {
    if (product === "self_report") return "학생 플랜으로 잠금 해제";
    if (product === "full_access") return "완전판으로 잠금 해제";
    return "프리미엄으로 잠금 해제";
  }
  if (product === "self_report") return "学生向けプランで開放する →";
  if (product === "full_access") return "完全版で開放する →";
  return "全部入りを解放する →";
}

// 運命の設計図アップセル (LegacyPremiumCard) の特典リスト。現行の販売は
// premium_bundle のみのため、内容は全部入りの仕様 (チャット30回・相性込み)。
const LEGACY_PREMIUM_FEATURES = {
  ja: [
    {
      title: "4章立てのAI鑑定文",
      desc: "幼少期から、これから訪れる転換点まで。あなたの物語を最初から最後まで読み解きます。",
    },
    {
      title: "専属AI占い師に相談30回",
      desc: "あなたの性格と星を全部知っている相手だから、話が早い。迷ったとき、いつでも。",
    },
    {
      title: "出生図ホイール",
      desc: "生まれた瞬間の星の配置から、あなたが本来持っている素質を一枚に。",
    },
    {
      title: "性格診断 × 星の掛け合わせ",
      desc: "「診断結果、当たってたけどなんで?」の答えが、星側から見えてきます。",
    },
    {
      title: "相性診断機能を解放",
      desc: "気になる相手との相性をS〜Cランクで判定。恋愛・友情・仕事、場面ごとの読み解きまで。",
    },
  ],
  ko: [
    {
      title: "나만의 전담 점성술사",
      desc: "성격 진단과 출생 차트를 이해한 점성술사에게 고민을 상담할 수 있어요.",
    },
    {
      title: "네 장으로 이어지는 AI 감정서",
      desc: "지금까지의 걸음부터 앞으로 찾아올 전환점까지 읽어 드려요.",
    },
    {
      title: "나만의 출생 차트 휠",
      desc: "태어난 순간의 천체 배치를 한 장의 설계도로 그려 드려요.",
    },
    {
      title: "성격 진단과 별의 교차 해석",
      desc: "성격과 별의 기질을 함께 살펴 나만의 모습을 깊이 이해해요.",
    },
  ],
} as const;

function LegacyPremiumCard({
  plan,
  entitlements,
  ownerToken,
  ctaSource,
  returnTo,
  locale,
  previewMode,
  anchorId,
  onClose,
}: {
  plan: PlanDefinition;
  entitlements: AccessEntitlements;
  ownerToken?: string;
  ctaSource?: string;
  returnTo: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  locale: ResultLocale;
  previewMode: boolean;
  anchorId: string;
  onClose?: () => void;
}) {
  // LegacyPremiumCard は premium_bundle 専用 (2コース期の完全版分岐は 2026-08-26 撤去)。
  const checkoutPrice = accessProductPrice(locale, plan.product, entitlements);
  const isUpgrade = checkoutPrice !== plan.basePrice;
  const features = LEGACY_PREMIUM_FEATURES[locale];

  return (
    <section
      id={anchorId}
      aria-labelledby={`${anchorId}-title`}
      className="relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-[26px] border border-[#E8D7A8] border-t-[4px] border-t-[#9A6A24] bg-[#FFF9EB] shadow-[0_14px_40px_rgba(46,46,92,0.12)] md:grid md:grid-cols-[40%_60%]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 z-0 h-36 w-36 rotate-[12deg] bg-[#E8D19A]/75"
        style={{ clipPath: "polygon(50% 0, 100% 25%, 82% 100%, 18% 82%, 0 25%)" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -left-10 z-0 h-36 w-36 rotate-[-18deg] bg-[#E8D19A]/65"
        style={{ clipPath: "polygon(50% 0, 100% 25%, 82% 100%, 18% 82%, 0 25%)" }}
      />
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === "ko" ? "닫기" : "閉じる"}
          className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-[#2E2E5C] text-white shadow-[0_4px_12px_rgba(46,46,92,0.22)] transition hover:scale-105 active:scale-95 md:right-4 md:top-4 md:h-10 md:w-10"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}

      <div className="relative z-10 flex min-h-[230px] items-center justify-center overflow-hidden bg-[#FFF9EB] px-4 pb-4 pt-8 md:min-h-[560px] md:px-3 md:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.58),rgba(255,249,235,0.08)_70%)]" />
        <Image
          src="/mascot/unmei-hero.png"
          alt=""
          aria-hidden="true"
          width={1200}
          height={900}
          sizes="(max-width: 767px) 340px, 430px"
          className="relative z-10 h-auto w-full max-w-[340px] mix-blend-multiply md:max-w-[430px]"
        />
      </div>

      <div className="relative z-10 px-6 py-8 text-left sm:px-8 md:px-12 md:py-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E4BD] px-3 py-1.5 text-[12px] font-black text-[#80571E]">
          <span aria-hidden="true">★</span>
          {locale === "ko" ? "프리미엄에서 잠금 해제" : "全部入りで解放"}
        </span>
        <h2
          id={`${anchorId}-title`}
          className="mt-3 max-w-[650px] text-[27px] font-bold leading-[1.25] text-[#2E2E5C] sm:text-[31px] md:text-[36px]"
        >
          {locale === "ko"
            ? "나만의 운명의 설계도를 모두 잠금 해제하세요"
            : "あなたの物語の続きを、全部入りで解放"}
        </h2>
        <p className="mt-3 max-w-[650px] text-[13.5px] font-bold leading-[1.7] text-[#5F6072] md:text-[15px]">
          {locale === "ko"
            ? "출생 차트와 성격 진단을 함께 읽어, 지금까지의 걸음과 앞으로 찾아올 전환점을 하나의 이야기로 정리했어요."
            : "性格診断で分かったのは、いまのあなた。ここから先は、これまでの歩みと、これから訪れる転換点の話です。出生図と掛け合わせた、あなただけの1冊をつくりました。"}
        </p>

        <ul className="mt-4 grid max-w-[670px] list-disc gap-1.5 pl-5 text-[13.5px] leading-[1.55] text-[#45475A] md:text-[14px]">
          {features.map((feature) => (
            <li key={feature.title}>
              <span className="font-bold text-[#2E2E5C]">{feature.title}</span>
              <span>：{feature.desc}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          {isUpgrade ? (
            <p className="mb-1 text-[12px] font-black text-[#9A6A24]">
              {locale === "ko"
                ? "구매한 코스와의 차액만"
                : "購入済みコースとの差額だけ"}
            </p>
          ) : plan.listPrice ? (
            <p className="mb-1 text-[13px] font-bold tabular-nums text-[#A0A0B4] line-through">
              {locale === "ko" ? "정가" : "通常"} {priceNode(plan.listPrice, locale)}
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
            <span className="text-[42px] font-bold tabular-nums tracking-[-0.02em] leading-none text-[#9A6A24] md:text-[46px]">
              {priceNode(checkoutPrice, locale)}
            </span>
            {plan.badge ? (
              <span className="mb-0.5 shrink-0 whitespace-nowrap rounded-full bg-[#FFF1CE] px-2.5 py-1 text-[10px] font-black text-[#9A6A24]">
                {plan.badge}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-2 max-w-[440px]">
          <FullAccessCta
            ownerToken={ownerToken}
            locale={locale}
            source={ctaSource}
            returnTo={returnTo}
            product={plan.product}
            paywallVersion={THREE_COURSE_PAYWALL_VERSION}
            placement={onClose ? "modal" : "inline"}
            previewMode={previewMode}
          >
            {locale === "ko"
              ? "결과를 프리미엄으로 업그레이드"
              : "結果を全部入りにアップグレード"}
          </FullAccessCta>
        </div>

        <p className="mt-2 text-[12px] font-bold text-[#7D7E8E]">
          {locale === "ko"
            ? "한 번만 결제 · 30일 환불 보장"
            : "買い切り・30日間の返金保証つき"}
        </p>
        {locale === "ko" ? (
          <KoreanPurchaseLegalNotice className="mt-3 max-w-[560px] text-left" />
        ) : null}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  entitlements,
  ownerToken,
  ctaSource,
  placement,
  returnTo,
  locale,
  previewMode,
  compactModal = false,
  usePlanBasePrice = false,
  moveOneTimePurchaseCaptionBelowPrice = false,
  singleOffer = false,
  ctaLabel,
  ebookPeek,
}: {
  plan: PlanDefinition;
  entitlements: AccessEntitlements;
  ownerToken?: string;
  ctaSource?: string;
  placement: PaywallPlacement;
  returnTo: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  locale: ResultLocale;
  previewMode: boolean;
  compactModal?: boolean;
  usePlanBasePrice?: boolean;
  moveOneTimePurchaseCaptionBelowPrice?: boolean;
  /** 日本版の主商品・学生向けを1枚だけ見せるときのカード幅。 */
  singleOffer?: boolean;
  ctaLabel?: string;
  ebookPeek: UnlockPeek;
}) {
  const purchased = isPurchased(plan.product, entitlements);
  const checkoutPrice = usePlanBasePrice || purchased
    ? plan.basePrice
    : accessProductPrice(locale, plan.product, entitlements);
  const isUpgrade = !purchased && checkoutPrice !== plan.basePrice;
  const upgradeReferencePrice = plan.listPrice ?? plan.basePrice;
  const upgradeDiscountPercent = isUpgrade
    ? Math.round((1 - checkoutPrice / upgradeReferencePrice) * 100)
    : null;
  const upgradeIncludedCourse =
    locale === "ja" &&
    isUpgrade &&
    entitlements.selfReport &&
    plan.product === "full_access"
      ? {
          label: "お試しコースの内容をすべて含む",
          itemCount: JA_PLANS[0].items.length,
        }
      : null;
  const visibleItems = upgradeIncludedCourse
    ? plan.items.slice(upgradeIncludedCourse.itemCount)
    : plan.items;

  return (
    <article
      role="listitem"
      data-plan={plan.product}
      data-purchased={purchased ? "true" : undefined}
      className={`relative flex shrink-0 snap-center flex-col overflow-hidden rounded-[22px] border-2 md:rounded-[26px] lg:min-w-0 lg:snap-none ${
        singleOffer
          ? "min-h-0 md:w-[440px] md:min-h-0 lg:w-[460px] lg:max-w-[460px] lg:flex-none lg:shrink-0"
          : "min-h-[410px] md:min-h-[640px] md:w-[350px] lg:flex-1 lg:shrink"
      } ${
        purchased
          ? "px-4 pb-4 pt-[52px] md:px-6 md:pb-6 md:pt-[60px]"
          : "p-4 md:p-6"
      } ${
        compactModal
          ? "w-full sm:w-[80%]"
          : "w-[88%] sm:w-[80%]"
      } ${
        plan.product === "premium_bundle"
          ? "touch-pan-y md:touch-auto"
          : ""
      } ${
        plan.product === "full_access"
          ? "shadow-[0_8px_18px_rgba(91,91,239,0.12)] md:shadow-[0_18px_44px_rgba(91,91,239,0.22)]"
          : "shadow-[0_6px_16px_rgba(46,46,92,0.07)] md:shadow-[0_14px_36px_rgba(46,46,92,0.10)]"
      }`}
      style={{
        borderColor: plan.accent,
        backgroundColor: purchased ? "#F3F4F7" : "#FFFFFF",
      }}
    >
      {purchased ? (
        <div
          className="absolute inset-x-0 top-0 flex h-9 items-center justify-center gap-1.5 text-[12px] font-black tracking-[0.04em] text-white md:h-10 md:text-[13px]"
          style={{ backgroundColor: plan.accent }}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
          {locale === "ko" ? "구매 완료 코스" : "購入済みコース"}
        </div>
      ) : null}

      <div
        className={`${
          plan.iconSrc ? "relative pr-[94px] md:pr-[116px]" : ""
        } ${purchased ? "opacity-60" : ""}`}
      >
        <p
          className="text-[10px] font-black tracking-[0.06em] md:text-[11px] md:tracking-[0.08em]"
          style={{ color: plan.accent }}
        >
          {plan.eyebrow}
        </p>
        <h3
          className={`mt-0.5 whitespace-nowrap font-black leading-tight text-[#2E2E5C] md:mt-1 md:text-[23px] md:tracking-normal ${
            plan.product === "premium_bundle"
              ? "text-[19px] tracking-[-0.04em] sm:text-[21px]"
              : "text-[21px]"
          }`}
        >
          {plan.title}
        </h3>
        {plan.iconSrc ? (
          <Image
            src={plan.iconSrc}
            alt=""
            aria-hidden="true"
            width={512}
            height={512}
            sizes="(min-width: 768px) 116px, 96px"
            className="pointer-events-none absolute -right-3 -top-3 h-auto w-[96px] select-none md:-right-4 md:-top-4 md:w-[116px]"
          />
        ) : null}
      </div>

      <div
        className={`${
          moveOneTimePurchaseCaptionBelowPrice
            ? "mt-4 min-h-0 py-0 md:mt-5 md:min-h-0 md:py-0"
            : "mt-5 min-h-[62px] py-0 md:mt-7 md:min-h-[74px] md:py-1"
        } ${purchased ? "opacity-60" : ""}`}
      >
        {isUpgrade ? (
          <p className="text-[12px] font-bold tabular-nums text-[#7F8294] line-through md:text-[13px]">
            {locale === "ko" ? "정가" : "通常"} {priceNode(upgradeReferencePrice, locale)}
          </p>
        ) : plan.listPrice ? (
          <p className="text-[12px] font-bold tabular-nums text-[#9A9DB0] line-through md:text-[13px]">
            {locale === "ko" ? "정가" : "通常"} {priceNode(plan.listPrice, locale)}
          </p>
        ) : moveOneTimePurchaseCaptionBelowPrice ? null : (
          <p className="text-[10px] font-black md:text-[11px]" style={{ color: plan.accent }}>
            {locale === "ko" ? "모두 1회 결제" : "すべて買い切り"}
          </p>
        )}
        <div className="mt-1 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
          <span
            className="text-[36px] font-bold leading-none tabular-nums tracking-[-0.02em] md:text-[38px]"
            style={{ color: plan.accent }}
          >
            {priceNode(checkoutPrice, locale)}
          </span>
          {isUpgrade && upgradeDiscountPercent !== null ? (
            <span
              className="mb-0.5 shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black md:text-[11px]"
              style={{ backgroundColor: plan.soft, color: plan.accent }}
            >
              {locale === "ko"
                ? `총 ${upgradeDiscountPercent}% 할인`
                : `${upgradeDiscountPercent}%OFF`}
            </span>
          ) : plan.badge ? (
            <span
              className="mb-0.5 max-w-full shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-black md:px-2.5 md:text-[10px]"
              style={{ backgroundColor: plan.soft, color: plan.accent }}
            >
              {plan.badge}
            </span>
          ) : null}
        </div>
        {moveOneTimePurchaseCaptionBelowPrice ? (
          <p className="mt-1 text-[10px] font-bold text-[#7F8294] md:text-[11px]">
            {locale === "ko"
              ? "1회 결제(추가 구독 없음)"
              : "買い切り（お支払いは1回のみ）"}
          </p>
        ) : null}
      </div>

      <div
        className={`${
          moveOneTimePurchaseCaptionBelowPrice ? "mt-2 md:mt-2.5" : "mt-3 md:mt-4"
        } ${purchased ? "opacity-60" : ""}`}
      >
        {purchased ? (
          <div
            className="flex w-full items-center justify-center rounded-full border-2 px-6 py-3.5 text-[14px] font-black"
            style={{ borderColor: plan.accent, color: plan.accent }}
          >
            {locale === "ko" ? "구매 완료" : "購入済み"}
          </div>
        ) : (
          <FullAccessCta
            ownerToken={ownerToken}
            locale={locale}
            source={ctaSource}
            returnTo={returnTo}
            product={plan.product}
            paywallVersion={THREE_COURSE_PAYWALL_VERSION}
            placement={placement}
            compact
            previewMode={previewMode}
          >
            {ctaLabel ??
              (isUpgrade
                ? plan.product === "premium_bundle"
                  ? locale === "ko"
                    ? "프리미엄으로 업그레이드"
                    : "全部入りにアップグレード"
                  : locale === "ko"
                    ? "완전판으로 업그레이드"
                    : "完全版にアップグレード"
                : baseCtaLabel(plan.product, locale))}
          </FullAccessCta>
        )}
      </div>

      <ul
        className={`mt-4 flex flex-col gap-2 border-t border-[#E5E6ED] pt-4 text-left md:mt-5 md:flex-1 md:gap-3 md:pt-5 ${
          purchased ? "opacity-60" : ""
        }`}
      >
        {upgradeIncludedCourse ? (
          <li className="flex items-start gap-2 border-b border-[#E5E6ED] pb-4 md:gap-2.5 md:pb-5">
            <svg
              aria-hidden="true"
              className="mt-px h-5 w-5 shrink-0 md:mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke={plan.accent}
              strokeWidth="1.8"
              strokeLinejoin="round"
            >
              <path d="M12 3c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7Z" />
            </svg>
            <span className="text-[13px] font-black leading-[1.45] text-[#2E2E5C] md:leading-[1.55]">
              {upgradeIncludedCourse.label}
            </span>
          </li>
        ) : null}
        {visibleItems.map((item, index) => {
          const originalIndex =
            index + (upgradeIncludedCourse?.itemCount ?? 0);
          const inherited = originalIndex < plan.inheritedItemCount;
          const peek =
            locale === "ja"
              ? japanesePlanItemPeek(item, ebookPeek)
              : undefined;
          const premiumIntroduction =
            plan.product === "premium_bundle" && inherited;
          const premiumDifference =
            plan.product === "premium_bundle" && !inherited;
          return (
            <li
              key={item}
              data-inherited={inherited ? "true" : undefined}
              className={`flex items-start gap-2 md:gap-2.5 ${
                premiumIntroduction
                  ? "border-b border-[#E5E6ED] pb-4 md:pb-5"
                  : ""
              }`}
            >
              {premiumIntroduction ? (
                <svg
                  aria-hidden="true"
                  className="mt-px h-5 w-5 shrink-0 md:mt-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={plan.accent}
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                >
                  <path d="M12 3c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7Z" />
                </svg>
              ) : (
                <span
                  aria-hidden="true"
                  className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white md:mt-0.5 md:text-[12px]"
                  style={{ backgroundColor: plan.accent }}
                >
                  ✓
                </span>
              )}
              <span
                className={`text-[13px] leading-[1.45] md:leading-[1.55] ${
                  premiumIntroduction
                    ? "font-black text-[#2E2E5C]"
                    : premiumDifference
                    ? "font-black text-[#2E2E5C]"
                    : "font-bold text-[#3F4358]"
                }`}
              >
                {item}
                {peek ? (
                  <PeekButton peek={peek} title={item} accent={plan.accent} />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function SelfAccessPlanCarousel({
  ownerToken,
  anchorId,
  onClose,
  ctaSource,
  frameless = false,
  returnTo = "me",
  locale = "ja",
  defaultProduct = "full_access",
  products,
  previewMode = false,
  previewJapaneseThreeCourse = false,
  previewEntitlements,
  legacyStyle = false,
  heading,
  ctaLabel,
  ebookPeek = PEEK_EBOOK,
}: {
  ownerToken?: string;
  anchorId: string;
  onClose?: () => void;
  ctaSource?: string;
  frameless?: boolean;
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  locale?: ResultLocale;
  defaultProduct?: AccessProduct;
  products?: readonly AccessProduct[];
  /** ローカルUI確認用。計測・権利確認・Checkoutを実行しない。 */
  previewMode?: boolean;
  /** ローカルの松竹梅プレビュー判定。価格レイアウトの確認に使用する。 */
  previewJapaneseThreeCourse?: boolean;
  /** ローカルプレビュー用の購入済み権利。実際の権利APIは呼ばない。 */
  previewEntitlements?: AccessEntitlements;
  /** 運命の設計図ページ用のコンパクトな単一課金カード表示。 */
  legacyStyle?: boolean;
  /** 単一商品導線などで、汎用のコース選択見出しを置き換える。 */
  heading?: string;
  /** 単一商品導線などで、購入ボタンの文言を置き換える。 */
  ctaLabel?: string;
  /** 電子書籍のチラ見せ。診断結果では本人のタイプ別最新表紙を渡す。 */
  ebookPeek?: UnlockPeek;
}) {
  const allPlans = locale === "ko" ? KO_PLANS : JA_PLANS;
  const isSingleOffer =
    !legacyStyle && !(previewMode && previewJapaneseThreeCourse);
  const usesSalePresentation = true;
  const plans = useMemo(
    () => {
      const selectedPlans = products
        ? allPlans.filter((plan) => products.includes(plan.product))
        : allPlans;
      return isSingleOffer
        ? products
          ? selectedPlans.slice(0, 1)
          : allPlans.filter((plan) => plan.product === "full_access")
        : selectedPlans;
    },
    [allPlans, isSingleOffer, products],
  );
  const defaultPlanIndex = Math.max(
    0,
    plans.findIndex((plan) => plan.product === defaultProduct),
  );
  const cancelledProduct = useCheckoutCancelledProduct();
  const cancelledPlanIndex = cancelledProduct
    ? plans.findIndex((plan) => plan.product === cancelledProduct)
    : -1;
  const focusedPlanIndex =
    cancelledPlanIndex >= 0 ? cancelledPlanIndex : defaultPlanIndex;
  const cancelledPlan =
    cancelledPlanIndex >= 0 ? plans[cancelledPlanIndex] : null;
  const cancelledStudentPlan =
    isSingleOffer && cancelledProduct === "self_report"
      ? allPlans[0]
      : null;
  const [entitlements, setEntitlements] = useState<AccessEntitlements>(
    EMPTY_ACCESS_ENTITLEMENTS,
  );
  const displayedEntitlements = previewMode
    ? (previewEntitlements ?? EMPTY_ACCESS_ENTITLEMENTS)
    : entitlements;
  const hasPreviewPurchase =
    previewMode &&
    (displayedEntitlements.selfReport ||
      displayedEntitlements.full ||
      displayedEntitlements.premiumBundle);
  const [activeIndex, setActiveIndex] = useState(defaultPlanIndex);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);
  const [studentPlanOpen, setStudentPlanOpen] = useState(
    cancelledStudentPlan !== null,
  );
  const scrollerRef = useRef<HTMLDivElement>(null);
  const placement: PaywallPlacement = onClose ? "modal" : "inline";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const target = scroller?.children.item(focusedPlanIndex) as
        | HTMLElement
        | null;
      if (!scroller || !target) return;

      setActiveIndex(focusedPlanIndex);
      const centeredLeft =
        target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;
      scroller.scrollTo({ left: centeredLeft, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusedPlanIndex]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setIsCarouselVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsCarouselVisible(entry?.isIntersecting === true),
      { threshold: 0.05 },
    );
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isCarouselVisible || previewMode) return;
    const product = plans[activeIndex]?.product;
    if (!product) return;

    // スワイプ途中の一瞬の通過を「閲覧」にしない。中央で500ms止まったコースだけ、
    // 1セッション・ページ・設置場所ごとに1回記録する。
    const timer = window.setTimeout(() => {
      const page = trackingPageFromPathname(window.location.pathname);
      const dedupKey = `torisetsu_paywall_plan_viewed_${THREE_COURSE_PAYWALL_VERSION}_${page}_${placement}_${product}`;
      try {
        if (sessionStorage.getItem(dedupKey)) return;
      } catch {
        // ストレージ不可でもイベント送信は継続する。
      }
      track("paywall_plan_viewed", {
        ownerToken: ownerToken ?? null,
        metadata: {
          page,
          product,
          paywall_version: THREE_COURSE_PAYWALL_VERSION,
          offer: SINGLE_ALL_ACCESS_PAYWALL_PRODUCT,
          placement,
          surface: returnTo,
          source: ctaSource ?? "paywall_direct",
        },
      });
      try {
        sessionStorage.setItem(dedupKey, "1");
      } catch {
        // noop
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    activeIndex,
    ctaSource,
    isCarouselVisible,
    ownerToken,
    placement,
    returnTo,
    plans,
    previewMode,
  ]);

  useEffect(() => {
    if (!studentPlanOpen || previewMode || !isSingleOffer) return;
    const page = trackingPageFromPathname(window.location.pathname);
    const product = "self_report";
    const dedupKey = `torisetsu_paywall_plan_viewed_${THREE_COURSE_PAYWALL_VERSION}_${page}_${placement}_${product}`;
    try {
      if (sessionStorage.getItem(dedupKey)) return;
    } catch {
      // ストレージ不可でも表示計測は継続する。
    }
    track("paywall_plan_viewed", {
      ownerToken: ownerToken ?? null,
      metadata: {
        page,
        product,
        paywall_version: THREE_COURSE_PAYWALL_VERSION,
        offer: SINGLE_ALL_ACCESS_PAYWALL_PRODUCT,
        placement,
        surface: returnTo,
        source: "student_offer_link",
      },
    });
    try {
      sessionStorage.setItem(dedupKey, "1");
    } catch {
      // noop
    }
  }, [
    isSingleOffer,
    ownerToken,
    placement,
    previewMode,
    returnTo,
    studentPlanOpen,
  ]);

  useEffect(() => {
    if (!ownerToken || previewMode) return;
    let cancelled = false;
    void requestFullAccessStatus(ownerToken)
      .then((data) => {
        if (cancelled || !data) return;
        setEntitlements({
          selfReport: data.selfReport === true,
          full: data.full === true,
          premiumBundle: data.premiumBundle === true,
        });
      })
      .catch(() => {
        // 表示価格は未購入時の定価へ安全に倒す。決済額はサーバ側で再判定する。
      });
    return () => {
      cancelled = true;
    };
  }, [ownerToken, previewMode]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    Array.from(scroller.children).forEach((child, index) => {
      const element = child as HTMLElement;
      const childCenter = element.offsetLeft + element.offsetWidth / 2;
      const distance = Math.abs(center - childCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setActiveIndex((current) =>
      current === nearestIndex ? current : nearestIndex,
    );
  };

  const scrollToPlan = (index: number) => {
    const scroller = scrollerRef.current;
    const target = scroller?.children.item(index) as HTMLElement | null;
    if (!scroller || !target) return;

    const centeredLeft =
      target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;
    scroller.scrollTo({ left: centeredLeft, behavior: "smooth" });
  };

  if (legacyStyle) {
    const focusedPlan =
      plans.find((plan) => plan.product === defaultProduct) ?? plans[0];
    if (!focusedPlan) return null;
    return (
      <LegacyPremiumCard
        plan={focusedPlan}
        entitlements={displayedEntitlements}
        ownerToken={ownerToken}
        ctaSource={ctaSource}
        returnTo={returnTo}
        locale={locale}
        previewMode={previewMode}
        anchorId={anchorId}
        onClose={onClose}
      />
    );
  }

  return (
    <section
      id={anchorId}
      aria-labelledby={`${anchorId}-title`}
      className={`relative mx-auto w-full max-w-[1120px] scroll-mt-[80px] overflow-hidden ${
        onClose ? "pb-4 pt-4 md:pb-5 md:pt-8" : "py-4 md:py-8"
      } ${
        frameless
          ? "bg-transparent"
          : "rounded-[28px] border border-[#DFE2F1] bg-[#F8F9FD] shadow-[0_18px_55px_rgba(46,46,92,0.18)]"
      }`}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === "ko" ? "닫기" : "閉じる"}
          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#2E2E5C] text-white shadow-[0_5px_16px_rgba(46,46,92,0.28)] transition hover:scale-105 active:scale-95 md:right-3 md:top-3 md:h-10 md:w-10"
        >
          <svg
            className="h-3.5 w-3.5 md:h-[18px] md:w-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}

      {cancelledPlan ? (
        <CheckoutCancelledModal
          locale={locale}
          courseName={cancelledPlan.title}
          imageSrc={cancelledPlan.iconSrc}
          retryAction={
            <FullAccessCta
              ownerToken={ownerToken}
              locale={locale}
              source={ctaSource}
              returnTo={returnTo}
              product={cancelledPlan.product}
              paywallVersion={THREE_COURSE_PAYWALL_VERSION}
              placement={placement}
              compact
              previewMode={previewMode}
            >
              {locale === "ko"
                ? "같은 코스로 다시 결제하기"
                : "同じコースでもう一度決済する"}
            </FullAccessCta>
          }
        />
      ) : null}

      <div
        className={
          onClose
            ? "px-5 pt-7 text-center md:px-10 md:pt-0"
            : "px-6 text-center md:px-10"
        }
      >
        <h2
          id={`${anchorId}-title`}
          className={
            onClose
              ? "text-[19px] font-black leading-[1.3] text-[#2E2E5C] sm:text-[22px] md:text-[31px] md:leading-tight"
              : "text-[22px] font-black leading-tight text-[#2E2E5C] md:text-[31px]"
          }
        >
          {heading ??
            (isSingleOffer
              ? locale === "ko"
                ? `완전판을 ${formatPrice(plans[0]?.basePrice ?? FULL_ACCESS_PRICE_KRW, locale)}에 모두 해제`
                : `完全版を、${formatJpy(plans[0]?.basePrice ?? FULL_ACCESS_PRICE_JPY)}で全開放`
              : locale === "ko"
                ? "나에게 맞는 해제 범위를 선택하세요"
                : "あなたに合う解放範囲を選ぶ")}
        </h2>
      </div>

      {plans.length > 1 ? (
        <div
          role="tablist"
          aria-label={locale === "ko" ? "코스 선택" : "コースを選択"}
          className="mx-4 mt-3 grid grid-cols-3 gap-1 rounded-full bg-[#EDEEF6] p-1 md:hidden"
        >
          {plans.map((plan, index) => {
            const selected = activeIndex === index;
            return (
              <button
                key={plan.product}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => scrollToPlan(index)}
                className={`min-w-0 rounded-full px-1.5 py-2 text-[10px] font-black leading-none transition ${
                  selected
                    ? "bg-white shadow-[0_2px_8px_rgba(46,46,92,0.12)]"
                    : "text-[#777A8F]"
                }`}
                style={selected ? { color: plan.accent } : undefined}
              >
                {plan.title}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        role="list"
        aria-label={locale === "ko" ? "요금제" : "料金プラン"}
        onScroll={handleScroll}
        className={`flex items-stretch snap-x snap-mandatory overflow-x-auto pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4 md:px-6 md:pt-1.5 lg:overflow-visible lg:snap-none ${
          onClose
            ? "gap-4 px-4 sm:gap-3 sm:px-[10%]"
            : "gap-3 px-[6%] sm:px-[10%]"
        } ${
          onClose
            ? "mt-1 pb-5 md:mt-3 md:pb-6"
            : "mt-2 pb-4 md:mt-3 md:pb-5"
        } ${
          plans.length < 3 ? "md:justify-center" : ""
        }`}
      >
        {plans.map((plan) => (
          <PlanCard
            key={plan.product}
            plan={plan}
            entitlements={displayedEntitlements}
            ownerToken={ownerToken}
            ctaSource={ctaSource}
            placement={placement}
            returnTo={returnTo}
            locale={locale}
            previewMode={previewMode}
            compactModal={!!onClose}
            usePlanBasePrice={
              previewMode &&
              usesSalePresentation &&
              !hasPreviewPurchase
            }
            moveOneTimePurchaseCaptionBelowPrice={
              usesSalePresentation
            }
            singleOffer={isSingleOffer}
            ctaLabel={ctaLabel}
            ebookPeek={ebookPeek}
          />
        ))}
      </div>

      {isSingleOffer && returnTo === "me" ? (
        <div className="relative z-10 mx-auto -mt-1 max-w-[520px] px-4 pb-4 text-center md:px-6">
          <button
            type="button"
            aria-expanded={studentPlanOpen}
            aria-controls={`${anchorId}-student-plan`}
            onClick={() => setStudentPlanOpen((open) => !open)}
            className="rounded-full px-4 py-2 text-[13px] font-black text-[#4F7080] underline decoration-1 underline-offset-4 transition hover:bg-[#EAF6F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F92A7]"
          >
            {locale === "ko" ? "학생이라면 여기" : "学生の方はこちら"}
            <span aria-hidden="true" className="ml-1">
              {studentPlanOpen ? "↑" : "↓"}
            </span>
          </button>

          {studentPlanOpen ? (
            <div id={`${anchorId}-student-plan`} className="mt-3 text-left">
              <div className="mb-3 rounded-2xl border border-[#CFE5E8] bg-[#F4FBFC] px-4 py-3 text-center">
                <p className="text-[13px] font-black text-[#345E6B]">
                  {locale === "ko"
                    ? `자기 진단과 친구 진단을 1회 결제 ${formatPrice(SELF_REPORT_PRICE_KRW, locale)}에`
                    : "自己診断＋友達診断を、買い切り¥299で"}
                </p>
                <p className="mt-1 text-[11px] font-bold leading-relaxed text-[#667A80]">
                  {locale === "ko"
                    ? "전용 전자책과 타인 분석 PDF가 포함돼요. 궁합 진단·운명의 설계도·Alice는 포함되지 않아요."
                    : "専用電子書籍と他己分析PDFを含みます。相性診断・運命の設計図・Aliceは含まれません。"}
                </p>
              </div>
              {cancelledStudentPlan ? (
                <CheckoutCancelledModal
                  locale={locale}
                  courseName={cancelledStudentPlan.title}
                  imageSrc={cancelledStudentPlan.iconSrc}
                  retryAction={
                    <FullAccessCta
                      ownerToken={ownerToken}
                      locale={locale}
                      source="student_offer_link"
                      returnTo="me"
                      product="self_report"
                      paywallVersion={THREE_COURSE_PAYWALL_VERSION}
                      placement={placement}
                      compact
                      previewMode={previewMode}
                    >
                      {locale === "ko" ? "학생 플랜으로 다시 결제하기" : "学生向けプランでもう一度決済する"}
                    </FullAccessCta>
                  }
                />
              ) : null}
              <div role="list" aria-label={locale === "ko" ? "학생 요금제" : "学生向け料金プラン"} className="flex justify-center">
                <PlanCard
                  plan={allPlans[0]}
                  entitlements={displayedEntitlements}
                  ownerToken={ownerToken}
                  ctaSource="student_offer_link"
                  placement={placement}
                  returnTo="me"
                  locale={locale}
                  previewMode={previewMode}
                  compactModal={!!onClose}
                  usePlanBasePrice={previewMode && !hasPreviewPurchase}
                  moveOneTimePurchaseCaptionBelowPrice
                  singleOffer
                  ebookPeek={ebookPeek}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          frameless
            ? "relative z-10 -mt-6 bg-gradient-to-b from-white/0 via-white/90 to-white pt-4"
            : "relative z-10 -mt-4 bg-gradient-to-b from-[#F4F4FE]/0 via-[#F6F7FD]/90 to-[#F8F9FD] pt-3 md:-mt-5 md:pt-4"
        }
      >
        <div
          className={`flex items-center justify-center text-center font-bold text-[#66677F] md:text-[12px] ${
            onClose
              ? "gap-1 px-3 text-[10px] tracking-[-0.005em]"
              : "gap-1 px-2 text-[clamp(11px,2.55vw,12px)] tracking-[-0.015em]"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4"
          >
            <path
              d="M12 3.25 19 6v5.25c0 4.35-2.75 7.73-7 9.5-4.25-1.77-7-5.15-7-9.5V6l7-2.75Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="m9 12 2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p
            className={
              onClose
                ? "whitespace-nowrap leading-none"
                : "whitespace-nowrap leading-none"
            }
          >
            {locale === "ko"
              ? "30일 환불 보장 · 많은 고객이 신뢰하고 있습니다"
              : `30日間の返金保証・${DIAGNOSIS_COUNT_SNAPSHOT}人以上から信頼されています`}
          </p>
        </div>
        {locale === "ko" ? (
          <KoreanPurchaseLegalNotice className="mx-auto mt-2 max-w-[760px] px-6 text-center" />
        ) : null}
      </div>
    </section>
  );
}
