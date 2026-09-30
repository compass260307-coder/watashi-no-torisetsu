"use client";

import { useUiText } from "@/i18n/ui/use-ui-copy";

import { useUiCopy } from "@/i18n/ui/use-ui-copy";

import {
  CheckoutCancelledModal,
  useCheckoutCancelledProduct,
} from "@/components/checkout/CheckoutCancelledNotice";
import { KoreanPurchaseLegalNotice } from "@/components/checkout/KoreanPurchaseLegalNotice";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { FullAccessCta } from "./FullAccessCta";
import { PeekButton, type UnlockPeek } from "./PaywallPeek";

import type { AppResultLocale } from "@/i18n/result";
import {
  accessPaywallVersionForLocale,
  accessProductPrice,
  EMPTY_ACCESS_ENTITLEMENTS,
  EN_FULL_ACCESS_PRICE_USD_CENTS,
  formatIdrMinor,
  FULL_ACCESS_PRICE_JPY,
  FULL_ACCESS_PRICE_KRW,
  ID_FULL_ACCESS_PRICE_IDR_MINOR,
  SINGLE_ALL_ACCESS_PAYWALL_PRODUCT,
  type AccessEntitlements,
  type AccessProduct,
  type PaywallPlacement,
  type ThreeCoursePaywallVersion
} from "@/lib/access-products";
import { DIAGNOSIS_COUNT_SNAPSHOT } from "@/lib/proof-stats";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import { requestFullAccessStatus } from "@/lib/use-course-navigation-access";

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

function formatJpy(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function formatPrice(value: number, locale: AppResultLocale): string {
  if (locale === "en") return `$${(value / 100).toFixed(2)}`;
  if (locale === "id") return formatIdrMinor(value);
  return locale === "ko" ? `₩${value.toLocaleString("ko-KR")}` : formatJpy(value);
}

// 価格タグは本文と同じ Noto Sans JP/KR の 700 で描く (M PLUS は丸すぎるため撤回
// 2026-09-04)。数字幅の安定は表示側の tabular-nums で担保する。
function priceNode(value: number, locale: AppResultLocale): React.ReactNode {
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

// 運命の設計図アップセル (LegacyPremiumCard) の特典リスト。現行の販売は
// premium_bundle のみのため、内容は全部入りの仕様 (チャット30回・相性込み)。


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
  returnTo: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi" | "tarot";
  locale: AppResultLocale;
  previewMode: boolean;
  anchorId: string;
  onClose?: () => void;
}) {
  const uiText = useUiText(locale, "result.SelfAccessPlanCarousel");
  // LegacyPremiumCard は premium_bundle 専用 (2コース期の完全版分岐は 2026-08-26 撤去)。
  const checkoutPrice = accessProductPrice(locale, plan.product, entitlements);
  const isUpgrade = checkoutPrice !== plan.basePrice;
  const features = useUiCopy(locale).carousel.premiumFeatures;

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
          aria-label={uiText("閉じる")}
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
          {uiText("全部入りで解放")}
        </span>
        <h2
          id={`${anchorId}-title`}
          className="mt-3 max-w-[650px] text-[27px] font-bold leading-[1.25] text-[#2E2E5C] sm:text-[31px] md:text-[36px]"
        >
          {uiText("あなたの物語の続きを、全部入りで解放")}
        </h2>
        <p className="mt-3 max-w-[650px] text-[13.5px] font-bold leading-[1.7] text-[#5F6072] md:text-[15px]">
          {uiText("性格診断で分かったのは、いまのあなた。ここから先は、これまでの歩みと、これから訪れる転換点の話です。出生図と掛け合わせた、あなただけの1冊をつくりました。")}
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
              {uiText("購入済みコースとの差額だけ")}
            </p>
          ) : plan.listPrice ? (
            <p className="mb-1 text-[13px] font-bold tabular-nums text-[#A0A0B4] line-through">
              {uiText("通常")} {priceNode(plan.listPrice, locale)}
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
            paywallVersion={accessPaywallVersionForLocale(locale)}
            placement={onClose ? "modal" : "inline"}
            previewMode={previewMode}
          >
            {uiText("結果を全部入りにアップグレード")}
          </FullAccessCta>
        </div>

        <p className="mt-2 text-[12px] font-bold text-[#7D7E8E]">
          {uiText("買い切り・30日間の返金保証つき")}
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
  returnTo: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi" | "tarot";
  locale: AppResultLocale;
  previewMode: boolean;
  compactModal?: boolean;
  usePlanBasePrice?: boolean;
  moveOneTimePurchaseCaptionBelowPrice?: boolean;
  /** 日本版の主商品・学生向けを1枚だけ見せるときのカード幅。 */
  singleOffer?: boolean;
  ctaLabel?: string;
  ebookPeek: UnlockPeek;
}) {
  const uiText = useUiText(locale, "result.SelfAccessPlanCarousel");
  const { carousel: carouselCopy } = useUiCopy(locale);
  const paywallVersion: ThreeCoursePaywallVersion =
    accessPaywallVersionForLocale(locale);
  const purchased = isPurchased(plan.product, entitlements);
  const checkoutPrice = usePlanBasePrice || purchased
    ? plan.basePrice
    : accessProductPrice(locale, plan.product, entitlements);
  const isUpgrade = !purchased && checkoutPrice !== plan.basePrice;
  const upgradeReferencePrice = plan.listPrice ?? plan.basePrice;
  const upgradeDiscountPercent = isUpgrade
    ? Math.round((1 - checkoutPrice / upgradeReferencePrice) * 100)
    : null;
  const visibleItems = plan.items;

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
          {uiText("購入済みコース")}
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
            {uiText("通常")} {priceNode(upgradeReferencePrice, locale)}
          </p>
        ) : plan.listPrice ? (
          <p className="text-[12px] font-bold tabular-nums text-[#9A9DB0] line-through md:text-[13px]">
            {uiText("通常")} {priceNode(plan.listPrice, locale)}
          </p>
        ) : moveOneTimePurchaseCaptionBelowPrice ? null : (
          <p className="text-[10px] font-black md:text-[11px]" style={{ color: plan.accent }}>
            {uiText("すべて買い切り")}
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
              {uiText("{upgradeDiscountPercent}% OFF", { upgradeDiscountPercent })}
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
            {uiText("買い切り（お支払いは1回のみ）")}
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
            {uiText("購入済み")}
          </div>
        ) : (
          <FullAccessCta
            ownerToken={ownerToken}
            locale={locale}
            source={ctaSource}
            returnTo={returnTo}
            product={plan.product}
            paywallVersion={paywallVersion}
            placement={placement}
            compact
            previewMode={previewMode}
          >
            {ctaLabel ??
              (isUpgrade
                ? plan.product === "premium_bundle"
                  ? uiText("全部入りにアップグレード")
                  : uiText("完全版にアップグレード")
                : carouselCopy.ctaLabel(plan.product))}
          </FullAccessCta>
        )}
      </div>

      <ul
        className={`mt-4 flex flex-col gap-2 border-t border-[#E5E6ED] pt-4 text-left md:mt-5 md:flex-1 md:gap-3 md:pt-5 ${
          purchased ? "opacity-60" : ""
        }`}
      >
        {visibleItems.map((item, index) => {
          const inherited = index < plan.inheritedItemCount;
          const peek = carouselCopy.peekForItem(item, ebookPeek);
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
                  <PeekButton
                    peek={peek}
                    title={item}
                    accent={plan.accent}
                    locale={locale}
                  />
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
  ebookPeek: suppliedEbookPeek,
}: {
  ownerToken?: string;
  anchorId: string;
  onClose?: () => void;
  ctaSource?: string;
  frameless?: boolean;
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi" | "tarot";
  locale?: AppResultLocale;
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
  const uiText = useUiText(locale, "result.SelfAccessPlanCarousel");
  const { carousel: copy, peeks } = useUiCopy(locale);
  const allPlans = copy.plans;
  const ebookPeek = suppliedEbookPeek ?? peeks.ebook;
  const paywallVersion: ThreeCoursePaywallVersion =
    accessPaywallVersionForLocale(locale);
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
      const dedupKey = `torisetsu_paywall_plan_viewed_${paywallVersion}_${page}_${placement}_${product}`;
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
          paywall_version: paywallVersion,
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
    paywallVersion,
    previewMode,
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
          aria-label={uiText("閉じる")}
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
              paywallVersion={paywallVersion}
              placement={placement}
              compact
              previewMode={previewMode}
            >
              {uiText("同じコースでもう一度決済する")}
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
              ? locale === "id"
                ? `Buka Edisi Lengkap seharga ${formatPrice(plans[0]?.basePrice ?? ID_FULL_ACCESS_PRICE_IDR_MINOR, locale)}`
                : locale === "en"
                ? `Unlock the Complete Edition for ${formatPrice(plans[0]?.basePrice ?? EN_FULL_ACCESS_PRICE_USD_CENTS, locale)}`
                : locale === "ko"
                  ? `완전판을 ${formatPrice(plans[0]?.basePrice ?? FULL_ACCESS_PRICE_KRW, locale)}에 모두 해제`
                  : `完全版を、${formatJpy(plans[0]?.basePrice ?? FULL_ACCESS_PRICE_JPY)}で全開放`
              : uiText("あなたに合う解放範囲を選ぶ"))}
        </h2>
      </div>

      {plans.length > 1 ? (
        <div
          role="tablist"
          aria-label={uiText("コースを選択")}
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
        aria-label={uiText("料金プラン")}
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
            {uiText("30日間の返金保証・{DIAGNOSIS_COUNT_SNAPSHOT}人以上から信頼されています", { DIAGNOSIS_COUNT_SNAPSHOT })}
          </p>
        </div>
        {locale === "ko" ? (
          <KoreanPurchaseLegalNotice className="mx-auto mt-2 max-w-[760px] px-6 text-center" />
        ) : null}
      </div>
    </section>
  );
}
