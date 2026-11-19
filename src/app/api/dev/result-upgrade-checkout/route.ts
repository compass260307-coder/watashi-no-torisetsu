import { NextRequest, NextResponse } from "next/server";
import { JA_WEB_RESULT_UPGRADE_CHECKOUT, LINE_RESULT_UPGRADE_LIST_PRICE_JPY, LINE_RESULT_UPGRADE_COUPON_JPY, LINE_RESULT_UPGRADE_OFFER_VERSION } from "@/lib/access-products";
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
  // Stripe は localhost の画像を読めないため、Webの表示確認では DEV_CHECKOUT_RESULT_UPGRADE_IMAGE_URL（https）があるときだけ画像を付ける。
  const previewImage = process.env.DEV_CHECKOUT_RESULT_UPGRADE_IMAGE_URL?.trim();
  try {
    // 本番と同じく、LINEは「LINE結果アップグレードクーポン」、Webは宝箱のクーポン名で ¥1,398 − ¥499 を見せる。
    let couponId: string | undefined;
    {
      const id = linePreview
        ? `wt-line-result-upgrade-off${LINE_RESULT_UPGRADE_COUPON_JPY}-jpy`
        : JA_WEB_RESULT_UPGRADE_CHECKOUT.couponId;
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
            name: linePreview ? "LINE結果アップグレードクーポン" : JA_WEB_RESULT_UPGRADE_CHECKOUT.couponName,
          }, { idempotencyKey: `${id}-preview` });
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
            unit_amount: LINE_RESULT_UPGRADE_LIST_PRICE_JPY,
            tax_behavior: "inclusive",
            product_data: {
              name: linePreview ? "結果アップグレード（LINE限定）" : JA_WEB_RESULT_UPGRADE_CHECKOUT.productName,
              ...(linePreview
                ? { description: "あなた専用のキャラクター・自己診断結果・Aliceの鑑定書を作成します。" }
                : previewImage?.startsWith("https://") ? { images: [previewImage] } : {}),
            },
          },
        },
      ],
      success_url: `${baseUrl}/dev/${linePreview ? "line-result-upgrade-complete-preview" : "result-upgrade-generation-preview"}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: linePreview ? `${baseUrl}/dev/line-result-upgrade-chat` : `${baseUrl}/dev/full-access-result-preview`,
      custom_text: { submit: { message: linePreview
        ? "通常価格1,398円から499円クーポン適用で899円（税込・買い切り）。30日間の返金保証。Alice Plusの定期課金とは別購入です。"
        : JA_WEB_RESULT_UPGRADE_CHECKOUT.submitMessage } },
      locale: "ja",
      metadata: {
        dev_preview: "result_upgrade",
        ...(linePreview ? {} : { checkout_display_version: JA_WEB_RESULT_UPGRADE_CHECKOUT.displayVersion }),
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
