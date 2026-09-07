"use client";

// Alice Plus LPのプラン選択UI。利用方法と期間の選択状態だけを
// Client Componentに閉じ込め、詳細・請求条件・固定CTAを同期する。

import { useEffect, useId, useRef, useState } from "react";

import {
  LINE_PLUS_PLANS,
  type LinePlusPlanId,
} from "@/lib/line-plus-products";

import motionStyles from "./LinePlusMotion.module.css";

type PlanGroupId = "subscription" | "pass";
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
  eyebrow: string;
  lead: string;
  price: string;
  unit?: string;
  secondaryPrice?: string;
  summary: string;
  stickyNote: string;
  ctaLabel: string;
  billing: readonly [
    { label: string; value: string; caption: string },
    { label: string; value: string; caption: string },
  ];
  condition: string;
};

const GROUP_PLAN_IDS = {
  subscription: ["monthly", "annual"],
  pass: ["day", "week", "month_pass"],
} as const satisfies Record<PlanGroupId, readonly LinePlusPlanId[]>;

const GROUP_COPY: Record<
  PlanGroupId,
  { title: string; description: string; selectorLabel: string }
> = {
  subscription: {
    title: "続けて使う",
    description: "月額・年額",
    selectorLabel: "サブスクの期間を選択",
  },
  pass: {
    title: "必要なときだけ",
    description: "自動更新なし",
    selectorLabel: "期間パスの利用期間を選択",
  },
};

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

function includesPlan(
  planIds: readonly LinePlusPlanId[],
  planId: LinePlusPlanId | null,
): planId is LinePlusPlanId {
  return planId !== null && planIds.some((candidate) => candidate === planId);
}

function preferredPlan(
  groupId: PlanGroupId,
  availability: PlusPlanAvailability,
  checkoutUrls: PlusPlanCheckoutUrls,
): LinePlusPlanId | null {
  const preference =
    groupId === "subscription"
      ? GROUP_PLAN_IDS.subscription
      : (["week", "day", "month_pass"] as const);

  return (
    preference.find((planId) =>
      isPlanAvailable(planId, availability, checkoutUrls),
    ) ?? null
  );
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
            eyebrow: "迷ったら、まずはこれ",
            lead: "7日間、Alice Plusの全機能を0円で試せます。",
            price: "¥0",
            unit: " / 7日間",
            secondaryPrice: `その後 ${price} / 月`,
            summary: "月額Plus　最初の7日間 ¥0",
            stickyNote: `8日目から${price} / 月・毎月自動更新`,
            ctaLabel: "0円で7日間ためす",
            billing: [
              { label: "今日", value: "¥0", caption: "初回登録" },
              { label: "8日目", value: price, caption: "以後、月ごと" },
            ],
            condition:
              "無料期間中に解約すれば料金はかかりません。8日目以降は毎月自動更新され、いつでも解約できます。",
          }
        : {
            eyebrow: "迷ったら、まずはこれ",
            lead: "毎月気軽に続けられる、Alice Plusの基本プランです。",
            price,
            unit: " / 月",
            summary: `月額Plus　${price} / 月`,
            stickyNote: "本日決済・毎月自動更新",
            ctaLabel: "月額Plusではじめる",
            billing: [
              { label: "今日", value: price, caption: "初回決済" },
              { label: "次回", value: "1か月後", caption: "以後、月ごと" },
            ],
            condition:
              "毎月自動更新されます。次回更新日の前まで、いつでも解約できます。",
          };
    case "annual": {
      const monthlyEquivalent = formatYen(Math.round(plan.priceYen / 12));
      return {
        eyebrow: "1年分をまとめて",
        lead: "更新を気にせず、Aliceと一年を通して話したい方に。",
        price,
        unit: " / 年",
        secondaryPrice: `月あたり ${monthlyEquivalent}`,
        summary: `年額Plus　${price} / 年`,
        stickyNote: "本日決済・1年ごとに自動更新",
        ctaLabel: "年額Plusではじめる",
        billing: [
          { label: "今日", value: price, caption: "1年分を決済" },
          { label: "次回", value: "1年後", caption: "以後、年ごと" },
        ],
        condition:
          "1年ごとに自動更新されます。次回更新日の前まで、いつでも解約できます。",
      };
    }
    case "day":
    case "week":
    case "month_pass": {
      const duration =
        planId === "day" ? "24時間" : planId === "week" ? "7日間" : "30日間";
      const extendsCurrentPass = activePass !== null;

      return {
        eyebrow: "1回払い・自動更新なし",
        lead: `${duration}だけ、Plusの全機能を自由に使えます。`,
        price,
        secondaryPrice: extendsCurrentPass
          ? `現在の期限に${duration}追加`
          : `利用期間 ${duration}`,
        summary: `${plan.label}　${price}`,
        stickyNote: "1回払い・自動更新なし",
        ctaLabel: extendsCurrentPass
          ? `${duration}を追加する`
          : `${plan.label}を購入する`,
        billing: [
          { label: "今日", value: price, caption: "1回だけ決済" },
          {
            label: extendsCurrentPass ? "追加" : "期間",
            value: duration,
            caption: extendsCurrentPass ? "現在の期限から" : "自動で終了",
          },
        ],
        condition: extendsCurrentPass
          ? `現在の利用期限に${duration}が追加されます。自動更新や追加の請求はありません。`
          : "購入手続きの完了後に利用が始まります。期間終了後の自動更新や追加の請求はありません。",
      };
    }
  }
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20" fill="none">
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

export default function PlusPlanChooser({
  checkoutUrls,
  availability,
  trialEligible,
  activePass = null,
}: PlusPlanChooserProps) {
  const instanceId = useId();
  const inlineCtaRef = useRef<HTMLDivElement>(null);
  const [inlineCtaVisible, setInlineCtaVisible] = useState(false);

  const defaultSubscription = preferredPlan(
    "subscription",
    availability,
    checkoutUrls,
  );
  const defaultPass = preferredPlan("pass", availability, checkoutUrls);
  const [selectedGroup, setSelectedGroup] = useState<PlanGroupId>(
    defaultSubscription ? "subscription" : "pass",
  );
  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<PlanGroupId, LinePlusPlanId | null>
  >({
    subscription: defaultSubscription,
    pass: defaultPass,
  });

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

  const availableSubscriptions = GROUP_PLAN_IDS.subscription.filter((planId) =>
    isPlanAvailable(planId, availability, checkoutUrls),
  );
  const availablePasses = GROUP_PLAN_IDS.pass.filter((planId) =>
    isPlanAvailable(planId, availability, checkoutUrls),
  );
  const availableGroups = [
    ...(availableSubscriptions.length > 0
      ? (["subscription"] as const)
      : []),
    ...(availablePasses.length > 0 ? (["pass"] as const) : []),
  ];
  const plansInSelectedGroup =
    selectedGroup === "subscription" ? availableSubscriptions : availablePasses;
  const savedSelection = selectedByGroup[selectedGroup];
  const selectedPlanId =
    includesPlan(plansInSelectedGroup, savedSelection)
      ? savedSelection
      : plansInSelectedGroup[0] ?? null;

  if (!selectedPlanId) {
    return (
      <section id="plans" className={`${motionStyles.planSection} scroll-mt-4 px-5 py-12 text-white`}>
        <p className="rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-6 text-center text-[13px] leading-6 text-white/70">
          現在、お申し込み可能なプランはありません。
        </p>
      </section>
    );
  }

  const selectedPlan = LINE_PLUS_PLANS[selectedPlanId];
  const view = planView(selectedPlanId, trialEligible, activePass);
  const checkoutUrl = checkoutUrls[selectedPlanId];
  const isMonthly = selectedPlanId === "monthly";
  const ctaLabel = view.ctaLabel;
  const stickyNote = view.stickyNote;
  const selectorLegendId = `${instanceId}-plan-selector`;

  const selectGroup = (groupId: PlanGroupId) => {
    const availablePlans =
      groupId === "subscription" ? availableSubscriptions : availablePasses;
    if (availablePlans.length === 0) return;

    setSelectedGroup(groupId);
    setSelectedByGroup((current) => ({
      ...current,
      [groupId]:
        includesPlan(availablePlans, current[groupId])
          ? current[groupId]
          : preferredPlan(groupId, availability, checkoutUrls),
    }));
  };

  const selectPlan = (planId: LinePlusPlanId) => {
    setSelectedByGroup((current) => ({
      ...current,
      [selectedGroup]: planId,
    }));
  };

  return (
    <section
      id="plans"
      className={`${motionStyles.planSection} scroll-mt-4 px-5 pb-10 pt-12 text-white`}
    >
      <header data-plus-reveal="up" className={motionStyles.revealUp}>
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#E9C96D]">
          <span className="h-px w-5 bg-[#E9C96D]/55" />
          プランを選ぶ
        </p>
        <h2 className="mt-3 text-[25px] font-bold leading-[1.45] tracking-[-0.025em]">
          {activePass ? "必要な期間だけ、追加できます。" : "まずは月額Plusから。"}
        </h2>
        <p className="mt-3 text-[13px] leading-6 text-white/65">
          {activePass
            ? "追加した期間は、いまのパスが終わったあとから始まります。"
            : "使えるPlus機能はすべて同じ。続け方だけ、シンプルに選べます。"}
        </p>
      </header>

      {activePass && (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-[#F0D77D]/25 bg-[#F0D77D]/10 px-4 py-3 text-[12px] font-bold leading-6 text-[#FFE8A1]"
        >
          現在、{LINE_PLUS_PLANS[activePass.planId].label}を
          {activePass.untilLabel}まで利用できます。
          追加購入分はこの期限のあとに続きます。月額・年額はパス終了後にお申し込みいただけます。
        </div>
      )}

      <fieldset
        data-plus-reveal="up"
        className={`${motionStyles.revealUp} mt-7`}
      >
        <legend className="sr-only">Alice Plusの使い方を選択</legend>
        <div
          className="grid gap-1.5 rounded-[22px] border border-white/10 bg-white/[0.06] p-1.5"
          style={{
            gridTemplateColumns: `repeat(${availableGroups.length}, minmax(0, 1fr))`,
          }}
        >
          {availableGroups.map((groupId) => {
            const isSelected = selectedGroup === groupId;
            const copy = GROUP_COPY[groupId];

            return (
              <label key={groupId} className="cursor-pointer">
                <input
                  type="radio"
                  name={`${instanceId}-alice-plus-group`}
                  value={groupId}
                  checked={isSelected}
                  onChange={() => selectGroup(groupId)}
                  className="peer sr-only"
                />
                <span
                  className={`block rounded-[17px] px-2 py-3 text-center transition duration-300 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-[#F1D980]/45 motion-reduce:transition-none ${
                    isSelected
                      ? "bg-white text-[#302847] shadow-[0_8px_24px_rgba(8,4,28,0.22)]"
                      : "text-white/65 active:scale-[0.98] motion-reduce:active:scale-100"
                  }`}
                >
                  <span className="block text-[13px] font-bold leading-5">
                    {copy.title}
                  </span>
                  <span
                    className={`mt-0.5 block text-[9px] font-medium ${
                      isSelected ? "text-[#756D82]" : "text-white/40"
                    }`}
                  >
                    {copy.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5" aria-labelledby={selectorLegendId}>
        <p
          id={selectorLegendId}
          className="mb-2.5 text-[10px] font-bold tracking-[0.08em] text-white/50"
        >
          {GROUP_COPY[selectedGroup].selectorLabel}
        </p>
        <fieldset>
          <legend className="sr-only">
            {GROUP_COPY[selectedGroup].selectorLabel}
          </legend>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${plansInSelectedGroup.length}, minmax(0, 1fr))`,
            }}
          >
            {plansInSelectedGroup.map((planId) => {
              const isSelected = selectedPlanId === planId;
              const plan = LINE_PLUS_PLANS[planId];
              const active = activePass?.planId === planId;

              return (
                <label key={planId} className="min-w-0 cursor-pointer">
                  <input
                    type="radio"
                    name={`${instanceId}-alice-plus-plan`}
                    value={planId}
                    checked={isSelected}
                    onChange={() => selectPlan(planId)}
                    className="peer sr-only"
                  />
                  <span
                    className={`relative flex min-h-[62px] flex-col items-center justify-center rounded-2xl border px-1.5 py-2.5 text-center transition duration-300 peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-[#F1D980]/45 motion-reduce:transition-none ${
                      isSelected
                        ? planId === "monthly"
                          ? "border-[#F1D980] bg-[#FFF8DF] text-[#4A3500] shadow-[0_8px_20px_rgba(8,4,28,0.18)]"
                          : "border-white bg-white text-[#403753] shadow-[0_8px_20px_rgba(8,4,28,0.18)]"
                        : "border-white/10 bg-white/[0.06] text-white/65 active:scale-[0.98] motion-reduce:active:scale-100"
                    }`}
                  >
                    <span className="text-[12px] font-bold leading-5">
                      {PLAN_SHORT_LABELS[planId]}
                    </span>
                    <span
                      className={`text-[10px] font-bold tabular-nums ${
                        isSelected ? "opacity-75" : "text-white/45"
                      }`}
                    >
                      {formatYen(plan.priceYen)}
                    </span>
                    {planId === "monthly" && (
                      <span className="absolute -top-2 rounded-full bg-[#F1D36F] px-2 py-0.5 text-[8px] font-bold text-[#5A4200] shadow-sm">
                        まずはこれ
                      </span>
                    )}
                    {active && (
                      <span className="absolute -top-2 rounded-full bg-[#68D59A] px-2 py-0.5 text-[8px] font-bold text-[#153F29] shadow-sm">
                        利用中
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <p className="sr-only" aria-live="polite">
        {selectedPlan.label}を選択中。{view.summary}。{stickyNote}
      </p>

      <article
        key={selectedPlanId}
        data-selected="true"
        className={`${motionStyles.planCard} mt-4 overflow-hidden rounded-[26px] border-2 bg-white text-[#302847] shadow-[0_16px_38px_rgba(8,4,28,0.28)] ${
          isMonthly ? "border-[#F1D980]" : "border-white"
        }`}
      >
        <div className="px-5 pb-5 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={`text-[10px] font-bold tracking-[0.08em] ${
                isMonthly ? "text-[#9A6D00]" : "text-[#7165C7]"
              }`}
            >
              {view.eyebrow}
            </p>
            {isMonthly && (
              <span className="rounded-full bg-[#FFE7A1] px-2.5 py-1 text-[9px] font-bold text-[#765600]">
                まずはこれ
              </span>
            )}
          </div>
          <h3 className="mt-2 text-[18px] font-bold tracking-[-0.02em]">
            {selectedPlan.label}
          </h3>
          <p className="mt-2 text-[12px] leading-5 text-[#706879]">
            {view.lead}
          </p>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-[#E8E2F1] pb-4">
            <p className="whitespace-nowrap">
              <span className="text-[32px] font-bold tracking-[-0.04em] tabular-nums">
                {view.price}
              </span>
              {view.unit && (
                <span className="ml-1 text-[12px] font-bold text-[#6E667B]">
                  {view.unit}
                </span>
              )}
            </p>
            {view.secondaryPrice && (
              <p className="pb-1 text-[11px] font-bold text-[#675C92]">
                {view.secondaryPrice}
              </p>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {view.billing.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-[#F5F2FA] px-3 py-3"
              >
                <p className="text-[9px] font-bold text-[#898195]">
                  {item.label}
                </p>
                <p className="mt-1 text-[15px] font-bold tabular-nums text-[#4A4160]">
                  {item.value}
                </p>
                <p className="mt-0.5 text-[9px] text-[#928A9E]">
                  {item.caption}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-[#746D7D]">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 flex-none text-[#7160D6]" />
            <span>{view.condition}</span>
          </p>
        </div>
      </article>

      <div
        ref={inlineCtaRef}
        data-plus-sticky-stop
        className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.06] p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className="text-[11px] font-bold text-white">{view.summary}</p>
          <p className="text-right text-[9px] leading-4 text-white/55">
            {stickyNote}
          </p>
        </div>
        <CheckoutButton
          href={checkoutUrl}
          label={ctaLabel}
          animationKey={`inline-${selectedPlanId}-${ctaLabel}`}
          primary={isMonthly}
          disabled={false}
        />
      </div>

      <div
        className={`${motionStyles.stickyCta} ${
          inlineCtaVisible ? motionStyles.stickyCtaBlocked : ""
        } fixed inset-x-0 bottom-0 z-40 border-t border-[#DDD7EE] bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+9px)] pt-2.5 shadow-[0_-12px_32px_rgba(38,24,78,0.13)] backdrop-blur-xl`}
      >
        <div className="mx-auto w-full max-w-[440px]">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="text-[11px] font-bold text-[#403753]">
              {view.summary}
            </p>
            <p className="text-right text-[9px] leading-4 text-[#696273]">
              {stickyNote}
            </p>
          </div>
          <CheckoutButton
            href={checkoutUrl}
            label={ctaLabel}
            animationKey={`sticky-${selectedPlanId}-${ctaLabel}`}
            primary={isMonthly}
            disabled={false}
            lightSurface
          />
        </div>
      </div>
    </section>
  );
}
