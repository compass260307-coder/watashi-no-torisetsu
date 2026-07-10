// PR1: ¥299 買い切り「フルアクセス(全解放)」の Stripe Checkout Session 作成。
//
// POST /api/checkout/create-full-access-session
//   - 認可: body.owner_token (秘密の capability URL のトークン) でその本人を解決。
//     Cookie wn_session は fallback。理由: /me/[token]・/tako/[token] は token だけで
//     閲覧でき Cookie 不在でも CTA が出る (別端末 / アプリ内ブラウザ / ITP で Cookie 消失)。
//     Cookie 必須だとスマホで 401 → 「うまく開けません」になり課金導線が死ぬ。
//     owner_token は解放対象=そのトークン本人なので、支払いで解放されるのも本人の分だけ。
//     (編集権限 isOwner は従来通り session のみ。ここは "支払って解放" のみで安全。)
//   - 二重課金防止: 既に plan='full' なら 409 already_full (先日の race 対策と同じ思想)
//   - 完了は webhook (checkout.session.completed / metadata.product='full_access') 側で
//     plan='full' に更新。ここでは Checkout URL を返すだけ。
//   - 戻り値: { url }
//
// 既存の create-session / create-perception-unlock-session とは別エンドポイント。
// Price は STRIPE_PRICE_FULL_ACCESS (¥299/one-time)。金額はサーバ側の Price 固定で、
// クライアントからは金額・数量・price を一切受け取らない (改ざん不可)。

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";
import { getStripe, getFullAccessPriceId } from "@/lib/stripe-server";
import { checkOrigin } from "@/lib/origin-check";
import { supabaseAdmin } from "@/lib/supabase-server";

// 支払いで解放する対象 (= そのトークンの本人 / session 本人)。
type Buyer = { id: string; email: string | null; owner_token: string | null };

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  // ===== Stripe 環境 =====
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }
  const priceId = getFullAccessPriceId();
  if (!priceId) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_FULL_ACCESS not configured" },
      { status: 500 },
    );
  }

  // ===== 対象本人の解決 (owner_token 優先 → session fallback) =====
  // owner_token は推測不可 (nanoid 22) の秘密トークン。閲覧と同じ capability なので、
  // これで本人を解決してよい。Cookie が無いスマホでも課金できるのが目的。
  const body = (await request.json().catch(() => ({}))) as {
    owner_token?: unknown;
  };
  const bodyToken =
    typeof body.owner_token === "string" ? body.owner_token.trim() : "";

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
  if (!buyer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = buyer.id;

  // ===== 二重課金防止 =====
  if (await hasFullAccess(userId)) {
    return NextResponse.json(
      { error: "already_full", code: "already_full" },
      { status: 409 },
    );
  }

  // 購入後の着地は自分のトリセツ (/me/[owner_token])。owner_token が無ければトップ。
  const ownerToken = (buyer.owner_token ?? "").trim();
  const successUrl = ownerToken
    ? `${BASE_URL}/me/${ownerToken}?paid=1`
    : `${BASE_URL}/?paid=1`;
  const cancelUrl = ownerToken ? `${BASE_URL}/me/${ownerToken}` : `${BASE_URL}/`;

  const customerEmail =
    typeof buyer.email === "string" && buyer.email.includes("@")
      ? buyer.email
      : undefined;

  // ===== Stripe Session 作成 =====
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.create({
      mode: "payment", // 買い切り (subscription ではない)
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      // 既存 webhook は metadata.user_id を読む。product='full_access' で分岐する。
      metadata: {
        user_id: userId,
        product: "full_access",
        email: customerEmail ?? "",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "ja",
    });
  } catch (err) {
    console.error("[checkout/create-full-access-session] Stripe error:", err);
    return NextResponse.json(
      {
        error: "Stripe session 作成に失敗しました",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: stripeSession.url });
}
