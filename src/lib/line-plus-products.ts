export type LinePlusPurchaseKind = "subscription" | "pass";

export type LinePlusPlanId =
  | "monthly"
  | "annual"
  | "day"
  | "week"
  | "month_pass";

export type LinePlusSubscriptionPlanId = Extract<
  LinePlusPlanId,
  "monthly" | "annual"
>;
export type LinePlusPassPlanId = Exclude<
  LinePlusPlanId,
  LinePlusSubscriptionPlanId
>;

type LinePlusPlan = {
  id: LinePlusPlanId;
  purchaseKind: LinePlusPurchaseKind;
  label: string;
  priceYen: number;
  accessDays: number | null;
  priceEnvKey: string;
  recurringInterval: "month" | "year" | null;
};

/**
 * Alice Plusの商品カタログ。UI表示額とStripe Price検証の共通の真実にする。
 * StripeのPrice IDそのものはサーバー側envから解決し、このファイルには置かない。
 */
export const LINE_PLUS_PLANS = {
  monthly: {
    id: "monthly",
    purchaseKind: "subscription",
    label: "月額Plus",
    priceYen: 480,
    accessDays: null,
    priceEnvKey: "STRIPE_PRICE_ALICE_PLUS",
    recurringInterval: "month",
  },
  annual: {
    id: "annual",
    purchaseKind: "subscription",
    label: "年額Plus",
    priceYen: 4_800,
    accessDays: null,
    priceEnvKey: "STRIPE_PRICE_ALICE_PLUS_ANNUAL",
    recurringInterval: "year",
  },
  day: {
    id: "day",
    purchaseKind: "pass",
    label: "24時間パス",
    priceYen: 180,
    accessDays: 1,
    priceEnvKey: "STRIPE_PRICE_ALICE_PLUS_PASS_24H",
    recurringInterval: null,
  },
  week: {
    id: "week",
    purchaseKind: "pass",
    label: "7日間パス",
    priceYen: 380,
    accessDays: 7,
    priceEnvKey: "STRIPE_PRICE_ALICE_PLUS_PASS_7D",
    recurringInterval: null,
  },
  month_pass: {
    id: "month_pass",
    purchaseKind: "pass",
    label: "30日間パス",
    priceYen: 680,
    accessDays: 30,
    priceEnvKey: "STRIPE_PRICE_ALICE_PLUS_PASS_30D",
    recurringInterval: null,
  },
} as const satisfies Record<LinePlusPlanId, LinePlusPlan>;

export const LINE_PLUS_PLAN_IDS = Object.keys(
  LINE_PLUS_PLANS,
) as LinePlusPlanId[];

export function isLinePlusPlanId(value: unknown): value is LinePlusPlanId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(LINE_PLUS_PLANS, value)
  );
}

export function isLinePlusSubscriptionPlan(
  value: unknown,
): value is LinePlusSubscriptionPlanId {
  return (
    isLinePlusPlanId(value) &&
    LINE_PLUS_PLANS[value].purchaseKind === "subscription"
  );
}

export function isLinePlusPassPlan(
  value: unknown,
): value is LinePlusPassPlanId {
  return isLinePlusPlanId(value) && LINE_PLUS_PLANS[value].purchaseKind === "pass";
}
