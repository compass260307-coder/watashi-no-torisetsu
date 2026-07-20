// 運命の設計図 (unmei) の Stripe Checkout Session 作成。
//
// POST /api/checkout/create-unmei-session
//   - body: { product: 'unmei' | 'unmei_upgrade' }
//   - 価格はサーバ側の環境変数で固定。クライアントから金額を渡さない。
//   - unmei_upgrade は ¥499 購入済み (hasFullAccess) の本人だけが作成可能。
//   - 完了は webhook (checkout.session.completed / metadata.product) 側で entitlement 付与 + 鑑定生成。

import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, isSafeOpaqueToken, readJsonObject } from "@/lib/api-security";
import { checkOrigin } from "@/lib/origin-check";
import { hasFullAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { getStripe, getUnmeiPriceId } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type Buyer = { id: string; email: string | null; owner_token: string | null };

type ProductKey = "unmei" | "unmei_upgrade";

const PRODUCT_LABELS: Record<ProductKey, { saleJpy: number; name: string }> = {
  unmei: { saleJpy: 1980, name: "運命の設計図（ベーシック）" },
  unmei_upgrade: { saleJpy: 1480, name: "運命の設計図（アップグレード）" },
};

async function resolveBuyer(request: NextRequest, bodyToken: string): Promise<{ buyer: Buyer | null; userId: string | null }> {
  let buyer: Buyer | null = null;
  if (bodyToken) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, email, owner_token")
      .eq("owner_token", bodyToken)
      .maybeSingle();
    if (data) buyer = data as Buyer;
  }
  if (!buyer) {
    const session = await getSession(request);
    if (session) {
      buyer = {
        id: session.id,
        email: session.email,
        owner_token: session.owner_token,
      };
    }
  }
  return { buyer, userId: buyer?.id ?? null };
}

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const ipLimit = await consumeRateLimit(request, {
    scope: "unmei-checkout-ip",
    limit: 10,
    windowSeconds: 600,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 60) },
      },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }

  const parsedBody = await readJsonObject(request, 2 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;
  const product = body.product === "unmei" || body.product === "unmei_upgrade" ? body.product : null;
  if (!product) {
    return NextResponse.json({ error: "product required" }, { status: 400 });
  }

  const priceId = getUnmeiPriceId(product);
  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_PRICE_UNMEI_${product === "unmei" ? "1980" : "1480"} not configured` },
      { status: 500 },
    );
  }

  const bodyToken =
    body.owner_token === undefined || body.owner_token === null
      ? ""
      : isSafeOpaqueToken(body.owner_token)
        ? body.owner_token
        : null;
  if (bodyToken === null) {
    return NextResponse.json({ error: "Invalid owner token" }, { status: 400 });
  }

  if (bodyToken) {
    const ownerLimit = await consumeRateLimit(request, {
      scope: "unmei-checkout-owner",
      identifier: bodyToken,
      limit: 6,
      windowSeconds: 600,
    });
    if (!ownerLimit.allowed) {
      return NextResponse.json(
        { error: "Too many checkout attempts" },
        {
          status: 429,
          headers: {
            "Retry-After": String(ownerLimit.retryAfterSeconds ?? 60),
          },
        },
      );
    }
  }

  const { buyer, userId } = await resolveBuyer(request, bodyToken);
  if (product === "unmei_upgrade") {
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await hasFullAccess(userId))) {
      return NextResponse.json(
        { error: "not_eligible_for_unmei_upgrade", code: "not_eligible_for_unmei_upgrade" },
        { status: 403 },
      );
    }
  }

  const ownerToken = (buyer?.owner_token ?? "").trim();
  const successUrl = `${BASE_URL}/unmei?checkout=success`;
  const cancelUrl = `${BASE_URL}/unmei`;

  let customerEmail = buyer?.email ?? null;
  if (!customerEmail && userId) {
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    customerEmail = (userRow?.email as string | null) ?? null;
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.unit_amount !== PRODUCT_LABELS[product].saleJpy || price.currency !== "jpy") {
      return NextResponse.json({ error: "price_mismatch" }, { status: 500 });
    }
  } catch {
    // price check is best-effort; proceed with checkout creation if Stripe can resolve the price.
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      metadata: {
        user_id: userId ?? "",
        product,
        email: customerEmail ?? "",
        owner_token: ownerToken,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "ja",
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error("[checkout/create-unmei-session] Stripe error:", err);
    return NextResponse.json(
      { error: "Stripe session 作成に失敗しました" },
      { status: 500 },
    );
  }
}
