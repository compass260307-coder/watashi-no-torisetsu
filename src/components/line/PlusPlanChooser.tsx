"use client";

// Alice Plus LPのプラン選択UI。全プランを一度に見せ、
// 選択 → 申し込みの2アクションだけで完了できる構成にする。

import { useEffect, useId, useRef, useState } from "react";

import {
  LINE_PLUS_PLANS,
  type LinePlusPlanId,
} from "@/lib/line-plus-products";

import motionStyles from "./LinePlusMotion.module.css";

export type LinePlusPassPlanId = Extract<
  LinePlusPlanId,
  "day" | "week" | "month_pass"
>;

export type PlusPlanAvailability = Record<LinePlusPlanId, boolean>;
export type PlusPlanCheckoutUrls = Partial<Record<LinePlusPlanId, string>>;

export type PlusActivePass = {
  planId: LinePlusPassPlanId;
  /** 「9月9日 18:00」のような、ユーザーにそのまま見せられる期限。 */
  untilLabel: string;
};

export type PlusPlanChooserProps = {
  checkoutUrls: PlusPlanCheckoutUrls;
  availability: PlusPlanAvailability;
  /** Checkoutと同じ購入履歴を参照し、無料期間を誤案内しない。 */
  trialEligible: boolean;
  /** 期間パス利用中の場合に期限を案内する。 */
  activePass?: PlusActivePass | null;
};

type PlanView = {
  optionPrice: string;
  optionNote: string;
  summary: string;
  ctaLabel: string;
  condition: string;
};

const SUBSCRIPTION_PLAN_IDS = ["monthly", "annual"] as const;
const PASS_PLAN_IDS = ["day", "week", "month_pass"] as const;

const PLAN_SHORT_LABELS: Record<LinePlusPlanId, string> = {
  monthly: "月額",
  annual: "年額",
  day: "24時間",
  week: "7日間",
  month_pass: "30日間",
};

const YEN_FORMATTER = new Intl.NumberFormat("ja-JP");

function formatYen(amount: number): string {
  return `¥${YEN_FORMATTER.format(amount)}`;
}

function isPlanAvailable(
  planId: LinePlusPlanId,
  availability: PlusPlanAvailability,
  checkoutUrls: PlusPlanCheckoutUrls,
): boolean {
  return availability[planId] && Boolean(checkoutUrls[planId]);
}

function planView(
  planId: LinePlusPlanId,
  trialEligible: boolean,
  activePass: PlusActivePass | null,
): PlanView {
  const plan = LINE_PLUS_PLANS[planId];
  const price = formatYen(plan.priceYen);

  switch (planId) {
    case "monthly":
      return trialEligible
        ? {
            optionPrice: "7日間 ¥0",
            optionNote: `その後 ${price}/月`,
            summary: `月額　7日間 ¥0 → ${price}/月`,
            ctaLabel: "7日間無料で試す",
            condition: `無料期間中に解約すれば0円。8日目から${price}で毎月自動更新。`,
          }
        : {
            optionPrice: `${price}/月`,
            optionNote: "毎月更新",
            summary: `月額　${price}/月`,
            ctaLabel: "月額プランを申し込む",
            condition: "毎月自動更新。次回更新日の前までいつでも解約できます。",
          };
    case "annual": {
      const monthlyEquivalent = formatYen(Math.round(plan.priceYen / 12));
      return {
        optionPrice: `${price}/年`,
        optionNote: `月あたり${monthlyEquivalent}`,
        summary: `年額　${price}/年`,
        ctaLabel: "年額プランを申し込む",
        condition: "1年ごとに自動更新。次回更新日の前までいつでも解約できます。",
      };
    }
    case "day":
    case "week":
    case "month_pass": {
      const duration = PLAN_SHORT_LABELS[planId];
      const extendsCurrentPass = activePass !== null;

      return {
        optionPrice: price,
        optionNote: "1回払い",
        summary: `${duration}　${price}`,
        ctaLabel: extendsCurrentPass
          ? `${duration}を追加する`
          : `${duration}パスを購入する`,
        condition: extendsCurrentPass
          ? `現在の利用期限に${duration}を追加します。自動更新はありません。`
          : `${duration}で自動終了。追加の請求はありません。`,
      };
    }
  }
}

function CheckoutButton({
  href,
  label,
  animationKey,
  primary,
  disabled,
  lightSurface = false,
}: {
  href: string | undefined;
  label: string;
  animationKey: string;
  primary: boolean;
  disabled: boolean;
  lightSurface?: boolean;
}) {
  const isDisabled = disabled || !href;
  const colorClass = primary
    ? "bg-gradient-to-r from-[#F2CB62] to-[#FFE7A1] text-[#4A3500] shadow-[0_8px_24px_rgba(232,185,62,0.3)]"
    : "bg-gradient-to-r from-[#5B50C7] to-[#7B65DE] text-white shadow-[0_8px_22px_rgba(91,80,199,0.28)]";
  const className = `block w-full rounded-2xl py-3.5 text-center text-[14px] font-bold transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F1D980]/45 motion-reduce:transition-none ${
    isDisabled
      ? lightSurface
        ? "cursor-not-allowed bg-[#ECE8F2] text-[#8A8295] shadow-none"
        : "cursor-not-allowed bg-white/10 text-white/45 shadow-none"
      : `active:scale-[0.98] motion-reduce:active:scale-100 ${colorClass}`
  }`;

  if (isDisabled) {
    return (
      <button type="button" disabled className={className}>
        <span key={animationKey} className={motionStyles.ctaLabel}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <a href={href} className={className}>
      <span key={animationKey} className={motionStyles.ctaLabel}>
        {label}
      </span>
    </a>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M10 2.5 16 5v4.2c0 3.7-2.4 6.7-6 8.3-3.6-1.6-6-4.6-6-8.3V5l6-2.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m7.4 9.9 1.7 1.7 3.6-3.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanOptions({
  title,
  note,
  planIds,
  selectedPlanId,
  trialEligible,
  activePass,
  radioName,
  onSelect,
}: {
  title: string;
  note?: string;
  planIds: readonly LinePlusPlanId[];
  selectedPlanId: LinePlusPlanId;
  trialEligible: boolean;
  activePass: PlusActivePass | null;
  radioName: string;
  onSelect: (planId: LinePlusPlanId) => void;
}) {
  if (planIds.length === 0) return null;

  return (
    <fieldset className="rounded-[24px] border border-white/10 bg-white/[0.065] p-3.5 shadow-[0_12px_30px_rgba(7,3,28,0.14)]">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-white">
          <span aria-hidden="true" className="text-[#E9C96D]">
            ✦
          </span>
          {title}
        </p>
        {note && (
          <p className="text-[10px] font-medium text-white/50">{note}</p>
        )}
      </div>
      <div className="space-y-2.5">
        {planIds.map((planId) => {
          const isSelected = selectedPlanId === planId;
          const view = planView(planId, trialEligible, activePass);

          return (
            <label key={planId} className="block min-w-0 cursor-pointer">
              <input
                type="radio"
                name={radioName}
                value={planId}
                checked={isSelected}
                onChange={() => onSelect(planId)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-[68px] items-center gap-3 rounded-[18px] border-2 px-3.5 py-3 text-left transition duration-200 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-[#F1D980]/45 motion-reduce:transition-none ${
                  isSelected
                    ? "border-[#F1D36F] bg-[#FFF8DF] text-[#403109] shadow-[0_8px_20px_rgba(8,4,28,0.2)]"
                    : "border-transparent bg-white text-[#403753] shadow-[0_4px_14px_rgba(8,4,28,0.1)] active:scale-[0.99] motion-reduce:active:scale-100"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${
                    isSelected
                      ? "border-[#E3B936] bg-white"
                      : "border-[#D8D3E1] bg-white"
                  }`}
                >
                  {isSelected && (
                    <span className="h-3 w-3 rounded-full bg-[#E3B936]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold leading-5">
                      {PLAN_SHORT_LABELS[planId]}
                    </span>
                    {planId === "monthly" && (
                      <span className="rounded-full bg-[#F1D36F] px-2 py-0.5 text-[8px] font-bold text-[#5A4200]">
                        おすすめ
                      </span>
                    )}
                  </span>
                  <span className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[15px] font-bold leading-5 tabular-nums">
                      {view.optionPrice}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        isSelected ? "text-[#75672E]" : "text-[#878091]"
                      }`}
                    >
                      {view.optionNote}
                    </span>
                  </span>
                </span>
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#E5BE4E] text-[12px] font-black text-[#463300]"
                  >
                    ✓
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function PlusPlanChooser({
  checkoutUrls,
  availability,
  trialEligible,
  activePass = null,
}: PlusPlanChooserProps) {
  const instanceId = useId();
  const inlineCtaRef = useRef<HTMLDivElement>(null);
  const [inlineCtaVisible, setInlineCtaVisible] = useState(false);
  const availableSubscriptions = SUBSCRIPTION_PLAN_IDS.filter((planId) =>
    isPlanAvailable(planId, availability, checkoutUrls),
  );
  const availablePasses = PASS_PLAN_IDS.filter((planId) =>
    isPlanAvailable(planId, availability, checkoutUrls),
  );
  const availablePlans = [...availableSubscriptions, ...availablePasses];
  const defaultPass =
    availablePasses.find((planId) => planId === "week") ??
    availablePasses[0] ??
    null;
  const [selectedPlanId, setSelectedPlanId] = useState<LinePlusPlanId | null>(
    availableSubscriptions[0] ?? defaultPass,
  );

  useEffect(() => {
    const target = inlineCtaRef.current;
    if (!target || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInlineCtaVisible(entry.isIntersecting),
      { threshold: 0.08 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (!selectedPlanId || availablePlans.length === 0) {
    return (
      <section
        id="plans"
        className={`${motionStyles.planSection} relative z-10 -mt-52 scroll-mt-4 px-5 py-12 text-white`}
      >
        <p className="rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-6 text-center text-[13px] leading-6 text-white/70">
          現在、お申し込み可能なプランはありません。
        </p>
      </section>
    );
  }

  const view = planView(selectedPlanId, trialEligible, activePass);
  const checkoutUrl = checkoutUrls[selectedPlanId];

  return (
    <section
      id="plans"
      className={`${motionStyles.planSection} relative z-10 -mt-52 scroll-mt-4 px-5 pb-10 pt-12 text-white`}
    >
      <header>
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#E9C96D]">
          <span className="h-px w-5 bg-[#E9C96D]/55" />
          プランを選ぶ
        </p>
        <h2 className="mt-3 text-[25px] font-bold leading-[1.45] tracking-[-0.025em]">
          どのプランにしますか？
        </h2>
      </header>

      {activePass && (
        <div
          role="status"
          className="mt-5 rounded-2xl border border-[#F0D77D]/25 bg-[#F0D77D]/10 px-4 py-3 text-[12px] font-bold leading-5 text-[#FFE8A1]"
        >
          {activePass.untilLabel}まで利用中。購入分はそのあとに追加されます。
        </div>
      )}

      <div className="mt-7 space-y-4">
        <PlanOptions
          title="月額・年額"
          planIds={availableSubscriptions}
          selectedPlanId={selectedPlanId}
          trialEligible={trialEligible}
          activePass={activePass}
          radioName={`${instanceId}-alice-plus-plan`}
          onSelect={setSelectedPlanId}
        />
        <PlanOptions
          title="買い切りプラン"
          note="自動更新なし・PayPay対応"
          planIds={availablePasses}
          selectedPlanId={selectedPlanId}
          trialEligible={trialEligible}
          activePass={activePass}
          radioName={`${instanceId}-alice-plus-plan`}
          onSelect={setSelectedPlanId}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {view.summary}を選択中。{view.condition}
      </p>

      <div
        ref={inlineCtaRef}
        data-plus-sticky-stop
        className="mt-7"
      >
        <CheckoutButton
          href={checkoutUrl}
          label={view.ctaLabel}
          animationKey={`inline-${selectedPlanId}-${view.ctaLabel}`}
          primary
          disabled={false}
        />
        <div className="mt-3 flex items-center justify-center gap-2.5 text-[10px] font-medium text-white/55">
          <span className="flex shrink-0 items-center gap-1">
            <ShieldIcon className="h-3.5 w-3.5" />
            30日間の返金保証
          </span>
          <span className="whitespace-nowrap">
            68,438人以上のお客様から信頼されています
          </span>
        </div>
      </div>

      <div
        className={`${motionStyles.stickyCta} ${
          inlineCtaVisible ? motionStyles.stickyCtaBlocked : ""
        } fixed inset-x-0 bottom-0 z-40 border-t border-[#DDD7EE] bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+9px)] pt-2.5 shadow-[0_-12px_32px_rgba(38,24,78,0.13)] backdrop-blur-xl`}
      >
        <div className="mx-auto w-full max-w-[440px]">
          <p className="mb-2 text-center text-[11px] font-bold text-[#403753]">
            {view.summary}
          </p>
          <CheckoutButton
            href={checkoutUrl}
            label={view.ctaLabel}
            animationKey={`sticky-${selectedPlanId}-${view.ctaLabel}`}
            primary
            disabled={false}
            lightSurface
          />
        </div>
      </div>
    </section>
  );
}
