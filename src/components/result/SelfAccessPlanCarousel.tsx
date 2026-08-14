"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { FullAccessCta } from "./FullAccessCta";
import {
  accessProductPrice,
  EMPTY_ACCESS_ENTITLEMENTS,
  FULL_ACCESS_DISCOUNT_PERCENT,
  FULL_ACCESS_LIST_PRICE_JPY,
  FULL_ACCESS_PRICE_JPY,
  PREMIUM_BUNDLE_DISCOUNT_PERCENT,
  PREMIUM_BUNDLE_LIST_PRICE_JPY,
  PREMIUM_BUNDLE_PRICE_JPY,
  SELF_REPORT_DISCOUNT_PERCENT,
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
  THREE_COURSE_PAYWALL_VERSION,
  type AccessEntitlements,
  type AccessProduct,
  type PaywallPlacement,
} from "@/lib/access-products";
import { track } from "@/lib/track";
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

const JA_PLANS: readonly PlanDefinition[] = [
  {
    product: "self_report",
    eyebrow: "自分も友達関係も深く知る",
    title: "お試しコース",
    basePrice: SELF_REPORT_PRICE_JPY,
    listPrice: SELF_REPORT_LIST_PRICE_JPY,
    badge: `リリース記念 ${SELF_REPORT_DISCOUNT_PERCENT}%OFF`,
    iconSrc: "/pricing/self-report-felt-transparent.png",
    accent: "#4F92A7",
    soft: "#EAF6F8",
    inheritedItemCount: 0,
    items: [
      "自己診断結果のロックを8つ全て解放",
      "16ページ以上の自己分析PDF",
      "２人目以降の友達診断結果もすべて解放",
      "何度でも作り直せる友達診断分析PDF",
    ],
  },
  {
    product: "full_access",
    eyebrow: "恋愛・占いまで楽しむ",
    title: "完全版コース",
    basePrice: FULL_ACCESS_PRICE_JPY,
    listPrice: FULL_ACCESS_LIST_PRICE_JPY,
    badge: `リリース記念 ${FULL_ACCESS_DISCOUNT_PERCENT}%OFF`,
    iconSrc: "/pricing/full-access-connection-felt-transparent.png",
    accent: "#5B5BEF",
    soft: "#EEEEFF",
    inheritedItemCount: 4,
    items: [
      "自己診断結果のロックを8つ全て解放",
      "16ページ以上の自己分析PDF",
      "２人目以降の友達の診断を開放",
      "何度でも作り直せる友達診断分析PDF",
      "恋愛パートナー相性診断を開放",
      "出生情報から仕事・恋愛・人生の転機を読む、あなた専用の運命の設計図",
      "星読みの案内人とのチャット5回分",
    ],
  },
  {
    product: "premium_bundle",
    eyebrow: "人生の設計図まで受け取る",
    title: "プレミアムコース",
    basePrice: PREMIUM_BUNDLE_PRICE_JPY,
    listPrice: PREMIUM_BUNDLE_LIST_PRICE_JPY,
    badge: `リリース記念 ${PREMIUM_BUNDLE_DISCOUNT_PERCENT}%OFF`,
    iconSrc: "/pricing/premium-destiny-felt-transparent.png",
    accent: "#9A6A24",
    soft: "#FFF6DF",
    inheritedItemCount: 6,
    items: [
      "自己診断結果のロックを8つ全て解放",
      "16ページ以上の自己分析PDF",
      "２人目以降の友達の診断を開放",
      "何度でも作り直せる友達診断分析PDF",
      "恋愛パートナー相性診断を開放",
      "出生情報から仕事・恋愛・人生の転機を読む、あなた専用の運命の設計図",
      "星読みの案内人とのチャット30回分",
    ],
  },
] as const;

const KO_PLANS: readonly PlanDefinition[] = [
  {
    product: "self_report",
    eyebrow: "나와 친구 관계를 깊이 이해하기",
    title: "라이트 코스",
    basePrice: SELF_REPORT_PRICE_KRW,
    listPrice: SELF_REPORT_LIST_PRICE_KRW,
    badge: `출시 기념 ${SELF_REPORT_DISCOUNT_PERCENT_KRW}% 할인`,
    iconSrc: "/pricing/self-report-felt-transparent.png",
    accent: "#4F92A7",
    soft: "#EAF6F8",
    inheritedItemCount: 0,
    items: [
      "자기 진단의 잠긴 결과 전체 해제",
      "16페이지 이상의 자기 분석 PDF",
      "두 번째 친구부터의 친구 진단 결과 전체 해제",
      "몇 번이든 다시 만들 수 있는 친구 분석 PDF",
    ],
  },
  {
    product: "full_access",
    eyebrow: "연애와 별자리 상담까지 즐기기",
    title: "완전판 코스",
    basePrice: FULL_ACCESS_PRICE_KRW,
    listPrice: FULL_ACCESS_LIST_PRICE_KRW,
    badge: `출시 기념 ${FULL_ACCESS_DISCOUNT_PERCENT_KRW}% 할인`,
    iconSrc: "/pricing/full-access-connection-felt-transparent.png",
    accent: "#5B5BEF",
    soft: "#EEEEFF",
    inheritedItemCount: 4,
    items: [
      "자기 진단의 잠긴 결과 전체 해제",
      "16페이지 이상의 자기 분석 PDF",
      "두 번째 친구부터 친구 진단 결과 전체 해제",
      "몇 번이든 다시 만들 수 있는 친구 분석 PDF",
      "연애 파트너 궁합 분석",
      "출생 정보와 성격 진단을 함께 읽는 한국어 운명의 설계도",
      "별자리 상담사와의 채팅 5회분",
    ],
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
    inheritedItemCount: 6,
    items: [
      "자기 진단의 잠긴 결과 전체 해제",
      "16페이지 이상의 자기 분석 PDF",
      "친구 진단 결과와 친구 분석 PDF 전체 해제",
      "연애 파트너 궁합 분석",
      "출생 정보와 성격 진단을 함께 읽는 한국어 운명의 설계도",
      "별자리 상담사와의 채팅 30회분",
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
    if (product === "self_report") return "라이트로 잠금 해제";
    if (product === "full_access") return "완전판으로 잠금 해제";
    return "프리미엄으로 잠금 해제";
  }
  if (product === "self_report") return "お試し版で開放";
  if (product === "full_access") return "完全版で開放";
  return "プレミアム版で開放";
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
}: {
  plan: PlanDefinition;
  entitlements: AccessEntitlements;
  ownerToken?: string;
  ctaSource?: string;
  placement: PaywallPlacement;
  returnTo: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  locale: ResultLocale;
  previewMode: boolean;
}) {
  const purchased = isPurchased(plan.product, entitlements);
  const checkoutPrice = accessProductPrice(locale, plan.product, entitlements);
  const isUpgrade = !purchased && checkoutPrice !== plan.basePrice;

  return (
    <article
      role="listitem"
      data-plan={plan.product}
      className={`relative flex w-[88%] shrink-0 snap-center flex-col rounded-[22px] border-2 bg-white p-4 sm:w-[80%] md:min-h-[610px] md:w-[350px] md:rounded-[26px] md:p-6 ${
        plan.product === "full_access"
          ? "shadow-[0_12px_34px_rgba(91,91,239,0.20)] md:shadow-[0_18px_44px_rgba(91,91,239,0.22)]"
          : "shadow-[0_10px_28px_rgba(46,46,92,0.09)] md:shadow-[0_14px_36px_rgba(46,46,92,0.10)]"
      }`}
      style={{ borderColor: plan.accent }}
    >
      <div
        className={
          plan.iconSrc
            ? "relative pr-[94px] md:pr-[116px]"
            : undefined
        }
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

      <div className="mt-5 min-h-[62px] py-0 md:mt-7 md:min-h-[74px] md:py-1">
        {isUpgrade ? (
          <p className="text-[10px] font-black md:text-[11px]" style={{ color: plan.accent }}>
            {locale === "ko" ? "구매한 코스와의 차액만 결제" : "購入済みコースとの差額だけ"}
          </p>
        ) : plan.listPrice ? (
          <p className="text-[12px] font-bold text-[#9A9DB0] line-through md:text-[13px]">
            {locale === "ko" ? "정가" : "通常"} {formatPrice(plan.listPrice, locale)}
          </p>
        ) : (
          <p className="text-[10px] font-black md:text-[11px]" style={{ color: plan.accent }}>
            {locale === "ko" ? "모두 1회 결제" : "すべて買い切り"}
          </p>
        )}
        <div className="mt-1 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
          {isUpgrade ? (
            <span className="pb-1 text-[13px] font-black" style={{ color: plan.accent }}>
              {locale === "ko" ? "추가" : "追加"}
            </span>
          ) : null}
          <span
            className="text-[36px] font-black leading-none tabular-nums md:text-[38px]"
            style={{ color: plan.accent }}
          >
            {formatPrice(checkoutPrice, locale)}
          </span>
          {plan.badge ? (
            <span
              className="mb-0.5 max-w-full shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-black md:px-2.5 md:text-[10px]"
              style={{ backgroundColor: plan.soft, color: plan.accent }}
            >
              {plan.badge}
            </span>
          ) : null}
        </div>
        {isUpgrade ? (
          <p className="mt-1.5 text-[10px] font-bold text-[#7F8294] md:mt-2 md:text-[11px]">
            {locale === "ko"
              ? `코스 가격 ${formatPrice(plan.basePrice, locale)}에서 구매 금액을 차감`
              : `コース価格 ${formatPrice(plan.basePrice, locale)} から購入済み分を差し引き`}
          </p>
        ) : null}
      </div>

      <div className="mt-3 md:mt-4">
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
            {isUpgrade
              ? locale === "ko"
                ? `추가 ${formatPrice(checkoutPrice, locale)}로 업그레이드`
                : `追加${formatPrice(checkoutPrice, locale)}でアップグレード`
              : baseCtaLabel(plan.product, locale)}
          </FullAccessCta>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-2 border-t border-[#E5E6ED] pt-4 text-left md:mt-5 md:flex-1 md:gap-3 md:pt-5">
        {plan.items.map((item, index) => {
          const inherited = index < plan.inheritedItemCount;
          const isNewToPlan = plan.inheritedItemCount > 0 && !inherited;
          const newItemColor =
            plan.product === "full_access" ? "#5552B5" : plan.accent;
          return (
            <li
              key={item}
              data-inherited={inherited ? "true" : undefined}
              className="flex items-start gap-2 md:gap-2.5"
            >
              <span
                aria-hidden="true"
                className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white md:mt-0.5 md:text-[12px]"
                style={{ backgroundColor: plan.accent }}
              >
                ✓
              </span>
              <span
                className="text-[12px] font-bold leading-[1.45] md:text-[13px] md:leading-[1.55]"
                style={{ color: isNewToPlan ? newItemColor : "#3F4358" }}
              >
                {item}
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
}) {
  const allPlans = locale === "ko" ? KO_PLANS : JA_PLANS;
  const plans = useMemo(
    () =>
      products
        ? allPlans.filter((plan) => products.includes(plan.product))
        : allPlans,
    [allPlans, products],
  );
  const defaultPlanIndex = Math.max(
    0,
    plans.findIndex((plan) => plan.product === defaultProduct),
  );
  const [entitlements, setEntitlements] = useState<AccessEntitlements>(
    EMPTY_ACCESS_ENTITLEMENTS,
  );
  const [activeIndex, setActiveIndex] = useState(defaultPlanIndex);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const placement: PaywallPlacement = onClose ? "modal" : "inline";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const target = scroller?.children.item(defaultPlanIndex) as
        | HTMLElement
        | null;
      if (!scroller || !target) return;

      const centeredLeft =
        target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;
      scroller.scrollTo({ left: centeredLeft, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [defaultPlanIndex]);

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
      const page = window.location.pathname.split("/")[1] || "top";
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
    if (!ownerToken || previewMode) return;
    const controller = new AbortController();
    void fetch(
      `/api/checkout/full-access-status?owner_token=${encodeURIComponent(ownerToken)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as Partial<AccessEntitlements>;
      })
      .then((data) => {
        if (!data) return;
        setEntitlements({
          selfReport: data.selfReport === true,
          full: data.full === true,
          premiumBundle: data.premiumBundle === true,
        });
      })
      .catch(() => {
        // 表示価格は未購入時の定価へ安全に倒す。決済額はサーバ側で再判定する。
      });
    return () => controller.abort();
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
    const target = scrollerRef.current?.children.item(index) as
      | HTMLElement
      | null;
    target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <section
      id={anchorId}
      aria-labelledby={`${anchorId}-title`}
      className={`relative mx-auto w-full max-w-[1120px] scroll-mt-[80px] overflow-hidden py-4 md:py-8 ${
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
          {locale === "ko" ? "원하는 이용 범위를 선택하세요" : "あなたに合う解放範囲を選ぶ"}
        </h2>
      </div>

      <div
        ref={scrollerRef}
        role="list"
        aria-label={locale === "ko" ? "요금제" : "料金プラン"}
        onScroll={handleScroll}
        className={`mt-3 flex items-stretch snap-x snap-mandatory gap-3 overflow-x-auto px-[6%] pb-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-[10%] md:mt-6 md:gap-4 md:px-6 md:pb-5 md:pt-5 ${
          plans.length < 3 ? "md:justify-center" : ""
        }`}
      >
        {plans.map((plan) => (
          <PlanCard
            key={plan.product}
            plan={plan}
            entitlements={entitlements}
            ownerToken={ownerToken}
            ctaSource={ctaSource}
            placement={placement}
            returnTo={returnTo}
            locale={locale}
            previewMode={previewMode}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2" aria-label={locale === "ko" ? "표시 중인 코스" : "表示中のコース"}>
        {plans.map((plan, index) => (
          <button
            key={plan.product}
            type="button"
            onClick={() => scrollToPlan(index)}
            aria-label={locale === "ko" ? `${plan.title} 보기` : `${plan.title}を表示`}
            aria-current={activeIndex === index ? "true" : undefined}
            className={`h-2.5 rounded-full transition-all ${
              activeIndex === index ? "w-8 bg-[#5B5BEF]" : "w-2.5 bg-[#CDD0E1]"
            }`}
          />
        ))}
      </div>

      <p className="mt-2 px-6 text-center text-[10px] font-bold text-[#8B8FA2] md:mt-4 md:text-[11px]">
        {locale === "ko"
          ? "모두 1회 결제 · 30일 환불 보장"
          : "すべて買い切り・30日間の返金保証つき"}
      </p>
    </section>
  );
}
