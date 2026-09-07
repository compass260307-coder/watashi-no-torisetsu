// Alice Plus (LINE): 購入/管理リンクの着地点。
//
// LINEトークに送った署名付きURLから開かれる。課金作成はアプリuser_id単位の
// DB leaseで直列化し、同じStripe Customerと未完了Checkout Sessionを再利用する。

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/api-security";
import { recordLineEvent } from "@/lib/line-events";
import {
  buildLinePlusPageUrl,
  findLinePlusCheckoutState,
  hasLinePlusHistory,
  linePlusEnabled,
  linePlusPlanPriceId,
  type LinePlusCheckoutState,
  verifyLinePlusToken,
} from "@/lib/line-plus";
import {
  isLinePlusPlanId,
  LINE_PLUS_PLANS,
  type LinePlusPlanId,
} from "@/lib/line-plus-products";
import { resolveSiteUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import type Stripe from "stripe";

export const runtime = "nodejs";

const CHECKOUT_LEASE_SECONDS = 120;
const CHECKOUT_TTL_SECONDS = 60 * 60;
const MIN_REUSABLE_SECONDS = 60;
const BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "unpaid",
  "paused",
]);

type CheckoutLease = {
  acquired: boolean;
  customer_request_id: string;
  stripe_customer_id: string | null;
  customer_mapping_conflict: boolean;
  checkout_attempt_id: string | null;
  checkout_attempt_fingerprint: string | null;
  checkout_session_id: string | null;
  checkout_plan_key: string | null;
  checkout_session_expires_at: string | null;
};

function completeRedirect(status: string): NextResponse {
  return NextResponse.redirect(
    `${resolveSiteUrl()}/line/plus/complete?status=${status}`,
    303,
  );
}

function stripeId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

function firstRpcRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isAlicePlusCheckoutForUser(
  session: Stripe.Checkout.Session,
  userId: string,
): boolean {
  return (
    session.metadata?.user_id === userId &&
    (session.metadata.product === "alice_plus" ||
      session.metadata.product === "alice_plus_pass" ||
      session.metadata.product === "alice_plus_week" ||
      session.metadata.product === "alice_plus_lifetime")
  );
}

async function isReusableCheckoutSession(input: {
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  customerId: string;
  lineUserId: string;
  userId: string;
  planId: LinePlusPlanId;
  priceId: string;
}): Promise<boolean> {
  const { stripe, session, customerId, lineUserId, userId, planId, priceId } =
    input;
  const product = LINE_PLUS_PLANS[planId];
  const expectedMode =
    product.purchaseKind === "subscription" ? "subscription" : "payment";

  if (
    session.status !== "open" ||
    !session.url ||
    session.expires_at <= Math.floor(Date.now() / 1000) + MIN_REUSABLE_SECONDS ||
    stripeId(session.customer) !== customerId ||
    session.mode !== expectedMode ||
    session.metadata?.user_id !== userId ||
    session.metadata?.line_user_id !== lineUserId ||
    session.metadata?.plan_id !== planId ||
    session.metadata?.stripe_price_id !== priceId
  ) {
    return false;
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 2,
  });
  const firstItem = lineItems.data[0];
  return (
    lineItems.data.length === 1 &&
    firstItem?.quantity === 1 &&
    firstItem.price?.id === priceId
  );
}

/** 完了と競合した可能性がある場合はfalseにし、新しい課金を作らない。 */
async function expireOpenSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.status === "expired") return true;
  if (session.status !== "open") return false;
  try {
    const expired = await stripe.checkout.sessions.expire(session.id);
    return expired.status === "expired";
  } catch {
    const latest = await stripe.checkout.sessions.retrieve(session.id);
    return latest.status === "expired";
  }
}

async function openBillingPortal(
  stripe: Stripe,
  customerId: string,
): Promise<NextResponse> {
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${resolveSiteUrl()}/line/plus/complete?status=portal_return`,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (caught) {
    console.error("[line/plus/checkout] portal session failed", {
      message: caught instanceof Error ? caught.message : String(caught),
    });
    return completeRedirect("error");
  }
}

/** LP表示額とStripe Priceの設定違いがあれば、決済画面を作らない。 */
async function isExpectedStripePrice(
  stripe: Stripe,
  planId: LinePlusPlanId,
  priceId: string,
): Promise<boolean> {
  const expected = LINE_PLUS_PLANS[planId];
  try {
    const price = await stripe.prices.retrieve(priceId);
    const recurringMatches =
      expected.purchaseKind === "subscription"
        ? price.type === "recurring" &&
          price.recurring?.interval === expected.recurringInterval &&
          price.recurring.interval_count === 1
        : price.type === "one_time" && price.recurring === null;
    const matches =
      price.active &&
      price.currency.toLowerCase() === "jpy" &&
      price.unit_amount === expected.priceYen &&
      recurringMatches;

    if (!matches) {
      console.error("[line/plus/checkout] Stripe Price does not match catalog", {
        plan_id: planId,
        expected_amount: expected.priceYen,
        actual_amount: price.unit_amount,
        currency: price.currency,
        expected_interval: expected.recurringInterval,
        actual_interval: price.recurring?.interval ?? null,
        price_type: price.type,
        active: price.active,
      });
    }
    return matches;
  } catch (caught) {
    console.error("[line/plus/checkout] Stripe Price lookup failed", {
      plan_id: planId,
      message: caught instanceof Error ? caught.message : String(caught),
    });
    return false;
  }
}

async function releaseCheckoutLease(userId: string, leaseToken: string) {
  const { error } = await supabaseAdmin.rpc(
    "release_line_plus_checkout_lease",
    {
      p_user_id: userId,
      p_lease_token: leaseToken,
    },
  );
  if (error) {
    console.error("[line/plus/checkout] lease release failed", {
      message: error.message,
    });
  }
}

/** Migration後に旧Checkoutが完了した場合も、過去のCustomerを再利用する。 */
async function findHistoricalStripeCustomerId(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", userId)
    .not("stripe_customer_id", "is", null);
  if (error) {
    throw new Error(`historical Customer lookup failed: ${error.message}`);
  }

  const rows = (data ?? []).filter(
    (row) =>
      typeof row.stripe_customer_id === "string" &&
      row.stripe_customer_id.length >= 8,
  );
  const blockingCustomers = new Set(
    rows
      .filter((row) => BLOCKING_SUBSCRIPTION_STATUSES.has(row.status))
      .map((row) => row.stripe_customer_id as string),
  );
  if (blockingCustomers.size === 1) {
    return [...blockingCustomers][0];
  }
  if (blockingCustomers.size > 1) {
    throw new Error("multiple active Stripe Customers require reconciliation");
  }

  const allCustomers = new Set(
    rows.map((row) => row.stripe_customer_id as string),
  );
  if (allCustomers.size > 1) {
    throw new Error("multiple historical Stripe Customers require reconciliation");
  }
  return allCustomers.size === 1 ? [...allCustomers][0] : null;
}

export async function GET(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) return completeRedirect("unavailable");

  const params = request.nextUrl.searchParams;
  const lineUserId = params.get("u") ?? "";
  const expiresAtMs = Number(params.get("e"));
  const signature = params.get("s") ?? "";
  if (!verifyLinePlusToken({ lineUserId, expiresAtMs, signature })) {
    return completeRedirect("invalid");
  }

  // plan無しの旧URLは主商品の月額へ。旧lifetimeを含む未知値は販売しない。
  const planParam = params.get("plan");
  if (planParam !== null && !isLinePlusPlanId(planParam)) {
    return completeRedirect("unavailable");
  }
  const plan: LinePlusPlanId = planParam ?? "monthly";
  const product = LINE_PLUS_PLANS[plan];

  const rateLimit = await consumeRateLimit(request, {
    scope: "line-plus-checkout",
    identifier: lineUserId,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) return completeRedirect("error");

  const { data: account, error: accountError } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (accountError || !account?.user_id) {
    if (accountError) {
      console.error("[line/plus/checkout] account lookup failed", {
        message: accountError.message,
      });
    }
    return completeRedirect("invalid");
  }
  const userId = account.user_id;

  let checkoutState: LinePlusCheckoutState;
  try {
    // LINE IDでなく課金主体のアプリuser_idを必ず境界にする。
    checkoutState = await findLinePlusCheckoutState(userId);
  } catch (caught) {
    console.error("[line/plus/checkout] entitlement guard failed", {
      message: caught instanceof Error ? caught.message : String(caught),
    });
    return completeRedirect("error");
  }

  if (
    checkoutState.kind === "subscription" &&
    checkoutState.status !== "incomplete"
  ) {
    return openBillingPortal(stripe, checkoutState.stripeCustomerId);
  }
  if (checkoutState.kind === "lifetime") {
    return NextResponse.redirect(buildLinePlusPageUrl(lineUserId), 303);
  }
  // 有効パスの残り時間とサブスク期間を重複させない。
  if (
    checkoutState.kind === "pass" &&
    product.purchaseKind === "subscription"
  ) {
    return NextResponse.redirect(buildLinePlusPageUrl(lineUserId), 303);
  }

  // 販売停止中でも上記の既存会員管理は閉じない。
  if (!linePlusEnabled()) return completeRedirect("unavailable");

  const priceId = linePlusPlanPriceId(plan);
  if (!priceId || !(await isExpectedStripePrice(stripe, plan, priceId))) {
    return completeRedirect("unavailable");
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (userError) {
    console.error("[line/plus/checkout] user lookup failed", {
      message: userError.message,
    });
    return completeRedirect("error");
  }

  // 無料体験は「初回の月額登録」だけ。期間パス履歴は数えない。
  const withTrial = plan === "monthly" && !(await hasLinePlusHistory(lineUserId));
  const attemptFingerprint = [
    "v1",
    userId,
    lineUserId,
    plan,
    priceId,
    withTrial ? "trial" : "paid",
  ].join(":");
  const leaseToken = randomUUID();
  let leaseHeld = false;

  try {
    const { data: leaseData, error: leaseError } = await supabaseAdmin.rpc(
      "acquire_line_plus_checkout_lease",
      {
        p_user_id: userId,
        p_line_user_id: lineUserId,
        p_lease_token: leaseToken,
        p_lease_seconds: CHECKOUT_LEASE_SECONDS,
      },
    );
    const lease = firstRpcRow(leaseData) as CheckoutLease | null;
    if (leaseError || !lease) {
      throw new Error(
        `checkout lease failed: ${leaseError?.message ?? "no result"}`,
      );
    }
    if (!lease.acquired) return completeRedirect("processing");
    leaseHeld = true;
    if (lease.customer_mapping_conflict) {
      throw new Error("multiple Stripe Customers require reconciliation");
    }

    let customerId = lease.stripe_customer_id;
    if (
      checkoutState.kind === "subscription" &&
      customerId &&
      customerId !== checkoutState.stripeCustomerId
    ) {
      throw new Error("subscription and checkout Customer do not match");
    }
    if (!customerId && checkoutState.kind === "subscription") {
      customerId = checkoutState.stripeCustomerId;
    }
    if (!customerId) {
      customerId = await findHistoricalStripeCustomerId(userId);
    }
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          ...(user?.email ? { email: user.email } : {}),
          metadata: {
            product: "alice_plus",
            user_id: userId,
          },
        },
        {
          idempotencyKey: `line-plus-customer:${lease.customer_request_id}`,
        },
      );
      customerId = customer.id;
    }

    if (customerId !== lease.stripe_customer_id) {
      const { data: saved, error: saveCustomerError } = await supabaseAdmin.rpc(
        "save_line_plus_checkout_customer",
        {
          p_user_id: userId,
          p_lease_token: leaseToken,
          p_stripe_customer_id: customerId,
        },
      );
      if (saveCustomerError || saved !== true) {
        throw new Error(
          `customer fencing failed: ${saveCustomerError?.message ?? "lease lost"}`,
        );
      }
    }

    const sessionsById = new Map<string, Stripe.Checkout.Session>();
    if (lease.checkout_session_id) {
      const stored = await stripe.checkout.sessions.retrieve(
        lease.checkout_session_id,
      );
      sessionsById.set(stored.id, stored);
    }
    const openSessions = await stripe.checkout.sessions.list({
      customer: customerId,
      status: "open",
      limit: 100,
    });
    for (const session of openSessions.data) {
      if (isAlicePlusCheckoutForUser(session, userId)) {
        sessionsById.set(session.id, session);
      }
    }

    let reusableSession: Stripe.Checkout.Session | null = null;
    let forceNewAttempt = false;
    for (const session of sessionsById.values()) {
      if (!isAlicePlusCheckoutForUser(session, userId)) continue;

      if (
        !reusableSession &&
        (await isReusableCheckoutSession({
          stripe,
          session,
          customerId,
          lineUserId,
          userId,
          planId: plan,
          priceId,
        }))
      ) {
        reusableSession = session;
        continue;
      }

      if (session.status === "complete") {
        // 支払い確定/遅延決済/Webhook反映待ち。別の課金を作らない。
        return completeRedirect("processing");
      }
      if (session.status === "open") {
        if (!(await expireOpenSession(stripe, session))) {
          return completeRedirect("processing");
        }
        forceNewAttempt = true;
      } else if (session.status === "expired") {
        forceNewAttempt = true;
      }
    }

    if (reusableSession?.url) {
      return NextResponse.redirect(reusableSession.url, 303);
    }

    // DB Webhook反映前でもStripeの正本に非終端サブスクがあれば新規作成しない。
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    const blockingSubscription = subscriptions.data.find(
      (subscription) =>
        subscription.metadata?.product === "alice_plus" &&
        BLOCKING_SUBSCRIPTION_STATUSES.has(subscription.status),
    );
    if (
      blockingSubscription?.status === "incomplete" ||
      (checkoutState.kind === "subscription" &&
        checkoutState.status === "incomplete")
    ) {
      return completeRedirect("processing");
    }
    if (blockingSubscription) {
      return openBillingPortal(stripe, customerId);
    }

    const { data: attemptId, error: attemptError } = await supabaseAdmin.rpc(
      "prepare_line_plus_checkout_attempt",
      {
        p_user_id: userId,
        p_lease_token: leaseToken,
        p_attempt_fingerprint: attemptFingerprint,
        p_force_new:
          forceNewAttempt ||
          (lease.checkout_attempt_fingerprint !== null &&
            lease.checkout_attempt_fingerprint !== attemptFingerprint),
      },
    );
    if (attemptError || typeof attemptId !== "string") {
      throw new Error(
        `checkout attempt failed: ${attemptError?.message ?? "lease lost"}`,
      );
    }

    const metadata = {
      product:
        product.purchaseKind === "subscription"
          ? "alice_plus"
          : "alice_plus_pass",
      plan_id: plan,
      stripe_price_id: priceId,
      user_id: userId,
      line_user_id: lineUserId,
      ...(product.purchaseKind === "pass"
        ? { access_days: String(product.accessDays) }
        : {}),
    };
    const expiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_TTL_SECONDS;
    const common: Stripe.Checkout.SessionCreateParams = {
      mode:
        product.purchaseKind === "subscription" ? "subscription" : "payment",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      metadata,
      locale: "ja",
      expires_at: expiresAt,
      success_url: `${resolveSiteUrl()}/line/plus/complete?status=success`,
      cancel_url: `${resolveSiteUrl()}/line/plus/complete?status=cancelled`,
      custom_text: {
        submit: {
          message:
            product.purchaseKind === "pass"
              ? `${product.priceYen.toLocaleString("ja-JP")}円の1回きりのお支払いです。自動更新はありません。利用中のパスがある場合は、その期限から${product.label.replace("パス", "")}分が追加されます。`
              : withTrial
                ? "最初の1週間は無料です。無料期間中に解約すれば、料金はかかりません。解約はLINEトークで「プラン」と送るといつでもできます。"
                : `${product.priceYen.toLocaleString("ja-JP")}円の${product.label}です。自動更新ですが、いつでも解約でき、解約後も期間の終わりまで使えます。解約はLINEトークで「プラン」と送るといつでもできます。`,
        },
      },
      ...(product.purchaseKind === "pass"
        ? { payment_intent_data: { metadata } }
        : {
            subscription_data: {
              metadata,
              ...(withTrial ? { trial_period_days: 7 } : {}),
            },
          }),
    };
    const session = await stripe.checkout.sessions.create(common, {
      idempotencyKey: `line-plus-checkout:${attemptId}`,
    });
    if (!session.url) {
      throw new Error("checkout session has no url");
    }

    const { data: sessionSaved, error: saveSessionError } =
      await supabaseAdmin.rpc("save_line_plus_checkout_session", {
        p_user_id: userId,
        p_lease_token: leaseToken,
        p_stripe_customer_id: customerId,
        p_checkout_session_id: session.id,
        p_plan_key: plan,
        p_session_expires_at: new Date(session.expires_at * 1000).toISOString(),
      });
    if (saveSessionError || sessionSaved !== true) {
      // leaseを失った古い実行は、作ったSessionを必ず閉じてURLを返さない。
      await expireOpenSession(stripe, session);
      return completeRedirect("processing");
    }
    leaseHeld = false; // save RPCがfencing成功と同時にleaseを解放した。

    try {
      await recordLineEvent({
        eventName: "line_plus_checkout_opened",
        metadata: {
          plan,
          plan_id: plan,
          purchase_kind: product.purchaseKind,
          currency: "jpy",
        },
      });
    } catch (caught) {
      // 計測障害で、作成・保存済みの安全な決済導線を塞がない。
      console.error("[line/plus/checkout] analytics failed", {
        message: caught instanceof Error ? caught.message : String(caught),
      });
    }
    return NextResponse.redirect(session.url, 303);
  } catch (caught) {
    console.error("[line/plus/checkout] guarded session create failed", {
      plan_id: plan,
      message: caught instanceof Error ? caught.message : String(caught),
    });
    return completeRedirect("error");
  } finally {
    if (leaseHeld) await releaseCheckoutLease(userId, leaseToken);
  }
}
