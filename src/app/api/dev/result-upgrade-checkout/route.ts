import { NextRequest, NextResponse } from "next/server";
import { LINE_RESULT_UPGRADE_LIST_PRICE_JPY, LINE_RESULT_UPGRADE_COUPON_JPY, LINE_RESULT_UPGRADE_OFFER_VERSION, RESULT_UPGRADE_PRICE_JPY } from "@/lib/access-products";
import { checkOrigin } from "@/lib/origin-check";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    return NextResponse.json(
      { error: "Stripeのテストキーが設定されていません" },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripeが設定されていません" },
      { status: 503 },
    );
  }

  const baseUrl = request.nextUrl.origin;

  const linePreview = request.nextUrl.searchParams.get("channel") === "line";
  try {
    let couponId: string | undefined;
    if (linePreview) {
      const id = `wt-line-result-upgrade-off${LINE_RESULT_UPGRADE_COUPON_JPY}-jpy`;
      const expected = (coupon: Awaited<ReturnType<typeof stripe.coupons.retrieve>>) =>
        !coupon.deleted && coupon.valid && coupon.currency === "jpy" &&
        coupon.amount_off === LINE_RESULT_UPGRADE_COUPON_JPY;
      try {
        const coupon = await stripe.coupons.retrieve(id);
        if (expected(coupon)) couponId = coupon.id;
      } catch {
        try {
          const coupon = await stripe.coupons.create({
            id, amount_off: LINE_RESULT_UPGRADE_COUPON_JPY, currency: "jpy", duration: "once",
            name: "LINE結果アップグレードクーポン",
          }, { idempotencyKey: `${LINE_RESULT_UPGRADE_OFFER_VERSION}-preview` });
          if (expected(coupon)) couponId = coupon.id;
        } catch {
          const coupon = await stripe.coupons.retrieve(id);
          if (expected(coupon)) couponId = coupon.id;
        }
      }
      if (!couponId) return NextResponse.json({ error: "テスト用クーポンの金額・通貨を確認できませんでした" }, { status: 503 });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: linePreview ? LINE_RESULT_UPGRADE_LIST_PRICE_JPY : RESULT_UPGRADE_PRICE_JPY,
            tax_behavior: "inclusive",
            product_data: {
              name: linePreview ? "結果アップグレード（LINE限定）" : "結果アップグレード",
              description:
                "あなた専用のキャラクター・自己診断結果・Aliceの鑑定書を作成します。",
            },
          },
        },
      ],
      success_url: `${baseUrl}/dev/${linePreview ? "line-result-upgrade-complete-preview" : "result-upgrade-generation-preview"}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: linePreview ? `${baseUrl}/dev/line-result-upgrade-chat` : `${baseUrl}/dev/full-access-result-preview`,
      ...(linePreview ? { custom_text: { submit: { message: "通常価格1,398円から499円クーポン適用で899円（税込・買い切り）。30日間の返金保証。Alice Plusの定期課金とは別購入です。" } } } : {}),
      locale: "ja",
      metadata: {
        dev_preview: "result_upgrade",
        ...(linePreview ? { sales_channel: "line", offer_version: LINE_RESULT_UPGRADE_OFFER_VERSION } : {}),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe Checkoutを開けませんでした" },
        { status: 500 },
      );
    }

    return NextResponse.redirect(session.url, 303);
  } catch {
    console.error("[dev/result-upgrade-checkout] Stripe test checkout failed");
    return NextResponse.json(
      { error: "Stripe Checkoutの作成に失敗しました" },
      { status: 500 },
    );
  }
}
