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

// ===== 「買いたくなる」Checkout 表示の定数 =====
// 実課金額 (SALE) は必ず STRIPE_PRICE_FULL_ACCESS (Price ID) の実額と一致していること。
// LIST は値引き表示のアンカー (二重価格)。カード側の ¥1,299 と揃える。
const SALE_JPY = 299;
const LIST_JPY = 1299;
const DISCOUNT_JPY = LIST_JPY - SALE_JPY; // 1000
// 値引きアンカー用クーポン (once・amount_off=DISCOUNT_JPY)。id に金額を埋めて取り違え防止。
const ANCHOR_COUPON_ID = `full-access-anchor-off${DISCOUNT_JPY}-jpy`;

const PRODUCT_NAME = "ワタシのトリセツ｜フルアクセス";
const PRODUCT_DESC =
  "深掘り(キャリア・成長)/友達ひとりずつの本音/シーン別の相性まで、ぜんぶ解放。買い切り・追加課金なし。";
// Checkout 左の商品サムネ (現行キービジュアルの PNG・768x512)。
// Stripe は JPEG/PNG/GIF 推奨なので webp ではなく PNG を使う。取得できる公開 https のみ許可。
const PRODUCT_IMAGE =
  BASE_URL.startsWith("https://") ? `${BASE_URL}/checkout-fullaccess.png` : null;

// getStripe() の非 null 戻り値 = Stripe クライアント型。
type StripeClient = NonNullable<ReturnType<typeof getStripe>>;

// 値引きアンカー用クーポンを取得 (無ければ作成)。amount_off が一致するものだけ採用。
// ★実課金安全: 解決できなければ null を返し、呼び出し側は Price ID (実額) にフォールバックする。
async function resolveAnchorCoupon(stripe: StripeClient): Promise<string | null> {
  try {
    const c = await stripe.coupons.retrieve(ANCHOR_COUPON_ID);
    if (
      !c.deleted &&
      c.valid &&
      c.amount_off === DISCOUNT_JPY &&
      (c.currency ?? "jpy") === "jpy"
    ) {
      return c.id;
    }
    // 既存だが金額/通貨が不一致 → 誤課金回避のため使わない。
    return null;
  } catch {
    // 未作成 → 作成 (id 固定で冪等)。
    try {
      const created = await stripe.coupons.create({
        id: ANCHOR_COUPON_ID,
        amount_off: DISCOUNT_JPY,
        currency: "jpy",
        duration: "once",
        name: "初回特別",
      });
      return created.id;
    } catch {
      // 競合で他リクエストが作成済み → もう一度取得を試みる。
      try {
        const c = await stripe.coupons.retrieve(ANCHOR_COUPON_ID);
        return !c.deleted && c.valid && c.amount_off === DISCOUNT_JPY
          ? c.id
          : null;
      } catch {
        return null;
      }
    }
  }
}

// Price ID の実額が SALE_JPY と一致するか検証 (ダッシュボードで価格変更された場合に
// 値引き経路 [LIST−DISCOUNT] で誤課金しないための安全弁)。
async function priceChargesSale(
  stripe: StripeClient,
  priceId: string,
): Promise<boolean> {
  try {
    const price = await stripe.prices.retrieve(priceId);
    return price.unit_amount === SALE_JPY && price.currency === "jpy";
  } catch {
    return false;
  }
}

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
  // ★ゲスト決済: buyer が解決できなくても 401 にしない。誰でも購入できるようにし、
  //   本人紐付けは webhook が Stripe 確定 email を優先キーに行う (email or id で紐付け)。
  //   userId=null がゲスト。買い手が判る場合のみ user_id/owner_token を使う。
  const userId: string | null = buyer?.id ?? null;

  // ===== 二重課金防止 (本人が判るときのみ。ゲストは email 未確定なので webhook 側で冪等) =====
  if (userId && (await hasFullAccess(userId))) {
    return NextResponse.json(
      { error: "already_full", code: "already_full" },
      { status: 409 },
    );
  }

  // 購入後の着地:
  //   ログイン中/owner_token あり → 自分のトリセツ (/me/[owner_token])。
  //   ゲスト → 「購入完了 → 登録メールでログイン」ページ。
  const ownerToken = (buyer?.owner_token ?? "").trim();
  const successUrl = ownerToken
    ? `${BASE_URL}/me/${ownerToken}?paid=1`
    : `${BASE_URL}/purchase-complete`;
  const cancelUrl = ownerToken ? `${BASE_URL}/me/${ownerToken}` : `${BASE_URL}/`;

  // ログイン中は email を prefill。ゲストは Stripe が Checkout で email を収集する。
  const customerEmail =
    typeof buyer?.email === "string" && buyer.email.includes("@")
      ? buyer.email
      : undefined;

  // ===== 「買いたくなる」表示: 商品説明/画像 + 値引き表示 (¥1,299 → ¥299) =====
  // 安全設計: 値引き経路 (price_data LIST + クーポン) は
  //   ① Price ID の実額が SALE (¥299) と一致し ② クーポンが amount_off=DISCOUNT で解決
  //   できたときだけ使う。どちらか欠けたら Price ID (実額) にフォールバックし、
  //   ¥1,299 を誤課金しない。商品説明/画像は両経路とも付ける。
  const productData: {
    name: string;
    description: string;
    images?: string[];
  } = {
    name: PRODUCT_NAME,
    description: PRODUCT_DESC,
    ...(PRODUCT_IMAGE ? { images: [PRODUCT_IMAGE] } : {}),
  };

  const [couponId, saleOk] = await Promise.all([
    resolveAnchorCoupon(stripe),
    priceChargesSale(stripe, priceId),
  ]);
  const useDiscount = !!couponId && saleOk;

  // 値引き経路: price_data で LIST を出し、クーポンで DISCOUNT 引いて実額 SALE (=¥299) を課金。
  //   商品名・説明・画像もここで付く (リッチ表示)。
  // フォールバック: ダッシュボードの Price ID をそのまま使う (実課金額は常にダッシュボード源泉。
  //   ¥1,299 を誤課金しない)。この経路は商品表示もダッシュボード Product 依存。
  const lineItems = useDiscount
    ? [
        {
          price_data: {
            currency: "jpy",
            unit_amount: LIST_JPY,
            product_data: productData,
          },
          quantity: 1,
        },
      ]
    : [{ price: priceId, quantity: 1 }];

  // ===== Stripe Session 作成 =====
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.create({
      mode: "payment", // 買い切り (subscription ではない)
      line_items: lineItems,
      ...(useDiscount ? { discounts: [{ coupon: couponId! }] } : {}),
      ...(userId ? { client_reference_id: userId } : {}),
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      // 支払い直前の安心コピー (買い切り・返金保証)。
      custom_text: {
        submit: {
          message:
            "一度きりの買い切りで、ずっと見返せます。30日間の返金保証つき・追加課金なし。",
        },
      },
      // webhook は product='full_access' で分岐。user_id があればその行、無ければ (guest=1)
      // Stripe 確定 email をキーに紐付ける (email or id・email 優先)。
      metadata: {
        user_id: userId ?? "",
        product: "full_access",
        guest: userId ? "0" : "1",
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
