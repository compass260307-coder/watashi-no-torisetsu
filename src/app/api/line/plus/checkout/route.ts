// Alice Plus (LINE) Phase 3: 購入/管理リンクの着地点。
//
// LINEトークに送った署名付きURL (src/lib/line-plus.ts buildLinePlusCheckoutUrl) から
// GET で開かれ、未加入者は Stripe Checkout (mode: subscription)、加入済みの人は
// Billing Portal (確認・支払い方法変更・解約) へ 303 リダイレクトする。
// LINE内ブラウザからのトップレベル遷移なので origin チェックや Cookie は使わない。

import { NextRequest, NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/api-security";
import { recordLineEvent } from "@/lib/line-events";
import {
  findManageableLinePlusSubscription,
  linePlusEnabled,
  verifyLinePlusToken,
} from "@/lib/line-plus";
import { resolveSiteUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function completeRedirect(status: string): NextResponse {
  return NextResponse.redirect(
    `${resolveSiteUrl()}/line/plus/complete?status=${status}`,
    303,
  );
}

export async function GET(request: NextRequest) {
  const stripe = getStripe();
  if (!linePlusEnabled() || !stripe) {
    return completeRedirect("unavailable");
  }

  const params = request.nextUrl.searchParams;
  const lineUserId = params.get("u") ?? "";
  const expiresAtMs = Number(params.get("e"));
  const signature = params.get("s") ?? "";
  if (!verifyLinePlusToken({ lineUserId, expiresAtMs, signature })) {
    return completeRedirect("invalid");
  }

  const rateLimit = await consumeRateLimit(request, {
    scope: "line-plus-checkout",
    identifier: lineUserId,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return completeRedirect("error");
  }

  const { data: account } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!account?.user_id) {
    return completeRedirect("invalid");
  }

  // 加入済み (支払い失敗中を含む) は二重契約させず Billing Portal へ
  const existing = await findManageableLinePlusSubscription(lineUserId);
  if (existing) {
    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: existing.stripeCustomerId,
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

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", account.user_id)
    .maybeSingle();

  // 初回加入のみ1週間無料。過去に一度でも加入歴 (statusを問わず行) があれば
  // トライアルなし (解約→再加入の無限無料を防ぐ)
  const { data: priorSub } = await supabaseAdmin
    .from("line_plus_subscriptions")
    .select("id")
    .eq("user_id", account.user_id)
    .limit(1)
    .maybeSingle();
  const withTrial = !priorSub;

  // プラン3種: 月額サブスク (既定)・買い切り1週間パス (?plan=week・¥480)・
  // 買い切り無期限 (?plan=lifetime・¥9,800)
  const planParam = params.get("plan");
  const plan =
    planParam === "week" || planParam === "lifetime" ? planParam : "monthly";
  const oneTimePriceId =
    plan === "week"
      ? process.env.STRIPE_PRICE_ALICE_PLUS_WEEK
      : plan === "lifetime"
        ? process.env.STRIPE_PRICE_ALICE_PLUS_LIFETIME
        : null;
  if (plan !== "monthly" && !oneTimePriceId) {
    return completeRedirect("unavailable");
  }

  try {
    const session =
      plan !== "monthly"
        ? await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [{ price: oneTimePriceId as string, quantity: 1 }],
            client_reference_id: account.user_id,
            ...(user?.email ? { customer_email: user.email } : {}),
            metadata: {
              product: plan === "week" ? "alice_plus_week" : "alice_plus_lifetime",
              user_id: account.user_id,
              line_user_id: lineUserId,
            },
            locale: "ja",
            custom_text: {
              submit: {
                message:
                  plan === "week"
                    ? "480円の1回きりのお支払いです。自動更新はありません。1週間たつと、そのまま無料プランに戻ります。"
                    : "9,800円の1回きりのお支払いです。以後の課金は一切なく、期限なしでPlusを使えます。",
              },
            },
            success_url: `${resolveSiteUrl()}/line/plus/complete?status=success`,
            cancel_url: `${resolveSiteUrl()}/line/plus/complete?status=cancelled`,
          })
        : await (async () => {
            const metadata = {
              product: "alice_plus",
              user_id: account.user_id,
              line_user_id: lineUserId,
            };
            return stripe.checkout.sessions.create({
              mode: "subscription",
              line_items: [
                {
                  price: process.env.STRIPE_PRICE_ALICE_PLUS as string,
                  quantity: 1,
                },
              ],
              client_reference_id: account.user_id,
              ...(user?.email ? { customer_email: user.email } : {}),
              metadata,
              // customer.subscription.* イベント側でも同期できるよう subscription にも刻む
              subscription_data: {
                metadata,
                ...(withTrial ? { trial_period_days: 7 } : {}),
              },
              locale: "ja",
              // 決済画面の支払いボタン上に出る安心文言 (サブスク不安の低減)
              custom_text: {
                submit: {
                  message: withTrial
                    ? "最初の1週間は無料です。無料期間中に解約すれば、料金はかかりません。解約はLINEトークで「プラン」と送るといつでもできます。"
                    : "いつでも解約できます。解約後も、期間の終わりまでは使えます。解約はLINEトークで「プラン」と送るといつでもできます。",
                },
              },
              success_url: `${resolveSiteUrl()}/line/plus/complete?status=success`,
              cancel_url: `${resolveSiteUrl()}/line/plus/complete?status=cancelled`,
            });
          })();
    if (!session.url) {
      throw new Error(`checkout session has no url: ${session.id}`);
    }
    await recordLineEvent({
      eventName: "line_plus_checkout_opened",
      metadata: {
        line_user_id: lineUserId,
        user_id: account.user_id,
        stripe_session_id: session.id,
        plan,
      },
    });
    return NextResponse.redirect(session.url, 303);
  } catch (caught) {
    console.error("[line/plus/checkout] session create failed", {
      message: caught instanceof Error ? caught.message : String(caught),
    });
    return completeRedirect("error");
  }
}
