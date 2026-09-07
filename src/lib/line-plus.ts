// Alice Plus (LINE): Stripeの月額/年額サブスクと期間パスの判定・購入導線。
//
// 購入導線はLINEトーク内に送る署名付きURLのみ (サイト側UIは最後に作る方針)。
// URLは line_user_id を HMAC で署名して運び、/api/line/plus/checkout が
// 未加入者を Stripe Checkout へ、加入済みの人を Billing Portal へ流す。
//
// env:
//   LINE_ALICE_PLUS_ENABLED   - "true" で無料枠超過時にPlus案内リンクを出す
//   STRIPE_PRICE_ALICE_PLUS          - ¥480/月 の recurring Price ID
//   STRIPE_PRICE_ALICE_PLUS_ANNUAL   - ¥4,800/年 の recurring Price ID
//   STRIPE_PRICE_ALICE_PLUS_PASS_*   - 24時間/7日/30日パスの one-time Price ID
//   LINE_PLUS_DAILY_MESSAGES  - Plus加入者の上限 (コスト暴走防止の安全弁・既定100)

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  isLinePlusPassPlan,
  LINE_PLUS_PLAN_IDS,
  LINE_PLUS_PLANS,
  type LinePlusPassPlanId,
  type LinePlusPlanId,
} from "@/lib/line-plus-products";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PLUS_DAILY = 100;

// 課金関係が残っている状態はすべて新規CheckoutよりPortalを優先する。
// incompleteはCheckout Routeで再開できるopen Sessionを先に探す。
const MANAGEABLE_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
];
// lifetime = 買い切り¥9,800の無期限プラン (Stripeサブスクではない合成行・期限なし)。
// ポータルで管理するものが無いので MANAGEABLE には入れない
const ACTIVE_STATUSES = ["active", "trialing", "lifetime"];
const ACTIVE_PASS_STATUSES = ["time_pass", "week_pass"];
const LINE_PLUS_HISTORY_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
  // 旧買い切り購入者に月額の初回トライアルを再度出さない。
  "lifetime",
];

export function linePlusEnabled(): boolean {
  return (
    process.env.LINE_ALICE_PLUS_ENABLED === "true" &&
    linePlusPlanPriceConfigured("monthly")
  );
}

/** サーバーenvから対象プランのStripe Price IDを解決する。 */
export function linePlusPlanPriceId(planId: LinePlusPlanId): string | null {
  const value = process.env[LINE_PLUS_PLANS[planId].priceEnvKey]?.trim();
  return value || null;
}

export function linePlusPlanPriceConfigured(planId: LinePlusPlanId): boolean {
  return linePlusPlanPriceId(planId) !== null;
}

export function configuredLinePlusPlanIds(): LinePlusPlanId[] {
  return LINE_PLUS_PLAN_IDS.filter(linePlusPlanPriceConfigured);
}

export function linePlusDailyLimit(): number {
  const raw = Number(process.env.LINE_PLUS_DAILY_MESSAGES);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_PLUS_DAILY;
}

// hashLineLinkCode と同じ secret 系列。kind プレフィックスを分けて衝突を避ける。
function linePlusSecret(): string {
  const secret =
    process.env.ALICE_TRANSFER_CODE_SECRET ??
    process.env.RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("line plus secret is not configured");
  return secret;
}

function signLinePlusToken(lineUserId: string, expiresAtMs: number): string {
  return createHmac("sha256", linePlusSecret())
    .update(`line-plus\0${lineUserId}\0${expiresAtMs}`)
    .digest("hex");
}

function signedLinePlusParams(lineUserId: string): string {
  const expiresAtMs = Date.now() + TOKEN_TTL_MS;
  const params = new URLSearchParams({
    u: lineUserId,
    e: String(expiresAtMs),
    s: signLinePlusToken(lineUserId, expiresAtMs),
  });
  return params.toString();
}

/** 現在このLINEアカウントへ紐づく課金主体。過去の紐付け先を参照しない。 */
async function currentLinkedUserId(lineUserId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (error) {
    console.error("[line-plus] linked user lookup failed", {
      message: error.message,
    });
    return null;
  }
  return data?.user_id ?? null;
}

/** 決済アクションURL。未加入→Checkout・加入済み→Billing Portal に振り分ける。 */
export function buildLinePlusCheckoutUrl(lineUserId: string): string {
  return `${resolveSiteUrl()}/api/line/plus/checkout?${signedLinePlusParams(lineUserId)}`;
}

/**
 * トークに送る案内リンク。直Stripeでなく紹介LP (/line/plus) に着地させ、
 * 内容と解約方法を見せてから CTA で checkout API へ進ませる (2026-09-01 オーナー指示)。
 * 加入済みの人への管理リンクは buildLinePlusCheckoutUrl を直接使ってよい。
 */
export function buildLinePlusPageUrl(lineUserId: string): string {
  return `${resolveSiteUrl()}/line/plus?${signedLinePlusParams(lineUserId)}`;
}

/**
 * ミッションページ (/line/missions) の署名付きリンク。トークン形式はPlus LPと共用
 * (意味は「このLINEユーザー本人」の証明であってプラン購入専用ではないため)。
 */
export function buildLineMissionsPageUrl(lineUserId: string): string {
  return `${resolveSiteUrl()}/line/missions?${signedLinePlusParams(lineUserId)}`;
}

export function verifyLinePlusToken(input: {
  lineUserId: string;
  expiresAtMs: number;
  signature: string;
}): boolean {
  if (!input.lineUserId) return false;
  if (!Number.isFinite(input.expiresAtMs) || input.expiresAtMs < Date.now()) {
    return false;
  }
  const expected = Buffer.from(
    signLinePlusToken(input.lineUserId, input.expiresAtMs),
    "hex",
  );
  const provided = Buffer.from(input.signature ?? "", "hex");
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

/** Plus加入中か (無料枠スキップの判定)。エラー時は無料扱いに倒して会話は止めない。 */
export async function hasActiveLinePlus(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .limit(1);
  if (error) {
    console.error("[line-plus] subscription lookup failed", {
      message: error.message,
    });
    return false;
  }
  if ((data ?? []).length > 0) return true;

  // 新期間パスは time_pass、旧¥480週間パスは week_pass。
  // いずれも current_period_end の期限内だけ有効とする。
  const { data: pass, error: passError } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ACTIVE_PASS_STATUSES)
    .gt("current_period_end", new Date().toISOString())
    .limit(1);
  if (passError) {
    console.error("[line-plus] time pass lookup failed", {
      message: passError.message,
    });
    return false;
  }
  return (pass ?? []).length > 0;
}

/** 有効な期間パス。LPの表示分岐用。 */
export async function findActiveLinePlusPass(
  lineUserId: string,
): Promise<{ expiresAt: string; planId: LinePlusPassPlanId } | null> {
  const userId = await currentLinkedUserId(lineUserId);
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("current_period_end, plan_key, status")
    .eq("user_id", userId)
    .in("status", ACTIVE_PASS_STATUSES)
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[line-plus] active pass lookup failed", {
      message: error.message,
    });
    return null;
  }
  if (!data?.current_period_end) return null;

  // migration前の week_pass は plan_key を持たないため後方互換する。
  const planId = isLinePlusPassPlan(data.plan_key)
    ? data.plan_key
    : data.status === "week_pass"
      ? "week"
      : null;
  if (!planId) {
    console.error("[line-plus] active pass has an invalid plan_key", {
      plan_key: data.plan_key,
    });
    return null;
  }
  return { expiresAt: data.current_period_end, planId };
}

/** @deprecated 旧LP互換。新規表示は findActiveLinePlusPass を使う。 */
export async function findActiveWeekPass(
  lineUserId: string,
): Promise<{ expiresAt: string } | null> {
  const pass = await findActiveLinePlusPass(lineUserId);
  return pass ? { expiresAt: pass.expiresAt } : null;
}

/** @deprecated 旧LP互換。新7日パス (¥380) の設定を返す。 */
export function linePlusWeekPriceConfigured(): boolean {
  return linePlusPlanPriceConfigured("week");
}

/** 無期限プラン (買い切り¥9,800) を持っているか。LPの表示分岐用。 */
export async function hasLifetimeLinePlus(
  lineUserId: string,
): Promise<boolean> {
  const userId = await currentLinkedUserId(lineUserId);
  if (!userId) return false;

  const { data, error } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "lifetime")
    .limit(1);
  if (error) {
    console.error("[line-plus] lifetime lookup failed", {
      message: error.message,
    });
    return false;
  }
  return (data ?? []).length > 0;
}

/** @deprecated 無期限プランの新規販売は終了。 */
export function linePlusLifetimePriceConfigured(): boolean {
  return false;
}

/**
 * 月額の初回7日無料を案内してよいか判断するための購入履歴チェック。
 * 取得に失敗した場合は無料と誤案内しないよう「履歴あり」側へ倒す。
 */
export async function hasLinePlusHistory(lineUserId: string): Promise<boolean> {
  const { data: account, error: accountError } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (accountError || !account?.user_id) {
    if (accountError) {
      console.error("[line-plus] account lookup for history failed", {
        message: accountError.message,
      });
    }
    return true;
  }

  const { data, error } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("id")
    .eq("user_id", account.user_id)
    // 期間パスの購入履歴は月額の初回無料体験を失わせない。
    .in("status", LINE_PLUS_HISTORY_STATUSES)
    .limit(1);
  if (error) {
    console.error("[line-plus] subscription history lookup failed", {
      message: error.message,
    });
    return true;
  }
  return (data ?? []).length > 0;
}

export type LinePlusCheckoutState =
  | {
      kind: "subscription";
      stripeCustomerId: string;
      stripeCheckoutSessionId: string | null;
      status: string;
    }
  | { kind: "pass"; expiresAt: string }
  | { kind: "lifetime" }
  | { kind: "none" };

/**
 * 課金作成前の厳密な二重購入ガード。通常の権利判定と違い、
 * DB取得失敗を未加入とみなさずthrowし、Checkoutをfail closedにする。
 */
export async function findLinePlusCheckoutState(
  userId: string,
): Promise<LinePlusCheckoutState> {
  const { data, error } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select(
      "stripe_customer_id, stripe_checkout_session_id, status, current_period_end, updated_at",
    )
    .eq("user_id", userId)
    .in("status", [
      ...MANAGEABLE_STATUSES,
      ...ACTIVE_PASS_STATUSES,
      "lifetime",
    ])
    .order("updated_at", { ascending: false });
  if (error) {
    throw new Error(
      `[line-plus] checkout entitlement lookup failed: ${error.message}`,
    );
  }

  const manageable = (data ?? []).find((row) =>
    MANAGEABLE_STATUSES.includes(row.status),
  );
  if (manageable) {
    if (!manageable.stripe_customer_id) {
      throw new Error("[line-plus] manageable subscription has no Stripe customer");
    }
    return {
      kind: "subscription",
      stripeCustomerId: manageable.stripe_customer_id,
      stripeCheckoutSessionId:
        manageable.stripe_checkout_session_id ?? null,
      status: manageable.status,
    };
  }
  if ((data ?? []).some((row) => row.status === "lifetime")) {
    return { kind: "lifetime" };
  }

  const activePass = (data ?? []).find((row) => {
    if (!ACTIVE_PASS_STATUSES.includes(row.status)) return false;
    const expiresAt = Date.parse(row.current_period_end ?? "");
    if (!Number.isFinite(expiresAt)) {
      throw new Error("[line-plus] active pass has no valid expiry");
    }
    return expiresAt > Date.now();
  });
  if (activePass?.current_period_end) {
    return { kind: "pass", expiresAt: activePass.current_period_end };
  }
  return { kind: "none" };
}

/** このLINEアカウントがポータルで管理すべきサブスクリプション (未加入なら null)。 */
export async function findManageableLinePlusSubscription(
  lineUserId: string,
): Promise<{ stripeCustomerId: string; status: string } | null> {
  const userId = await currentLinkedUserId(lineUserId);
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", userId)
    .in("status", MANAGEABLE_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[line-plus] manageable subscription lookup failed", {
      message: error.message,
    });
    return null;
  }
  if (!data?.stripe_customer_id) return null;
  return {
    stripeCustomerId: data.stripe_customer_id,
    status: data.status,
  };
}
