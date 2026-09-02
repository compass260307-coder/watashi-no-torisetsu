// Alice Plus (LINE) Phase 3: Stripe 月額サブスク (¥480/月) の判定と購入導線。
//
// 購入導線はLINEトーク内に送る署名付きURLのみ (サイト側UIは最後に作る方針)。
// URLは line_user_id を HMAC で署名して運び、/api/line/plus/checkout が
// 未加入者を Stripe Checkout へ、加入済みの人を Billing Portal へ流す。
//
// env:
//   LINE_ALICE_PLUS_ENABLED   - "true" で無料枠超過時にPlus案内リンクを出す
//   STRIPE_PRICE_ALICE_PLUS   - ¥480/月 の recurring Price ID
//   LINE_PLUS_DAILY_MESSAGES  - Plus加入者の上限 (コスト暴走防止の安全弁・既定100)

import { createHmac, timingSafeEqual } from "node:crypto";

import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_PLUS_DAILY = 100;

// past_due も含める: 支払い失敗中の人は「解約」ではなくポータルでカード更新してほしい
const MANAGEABLE_STATUSES = ["active", "trialing", "past_due"];
const ACTIVE_STATUSES = ["active", "trialing"];

export function linePlusEnabled(): boolean {
  return (
    process.env.LINE_ALICE_PLUS_ENABLED === "true" &&
    Boolean(process.env.STRIPE_PRICE_ALICE_PLUS)
  );
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
  return (data ?? []).length > 0;
}

/** このLINEアカウントがポータルで管理すべきサブスクリプション (未加入なら null)。 */
export async function findManageableLinePlusSubscription(
  lineUserId: string,
): Promise<{ stripeCustomerId: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("stripe_customer_id, status")
    .eq("line_user_id", lineUserId)
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
  return { stripeCustomerId: data.stripe_customer_id };
}
