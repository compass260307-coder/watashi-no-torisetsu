// 日本版・韓国版の買い切り「フルアクセス(全解放)」Stripe Checkout Session 作成。
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
// Price はロケール別の環境変数 (one-time)。金額はサーバ側の Price 固定で、
// クライアントからは金額・数量・price を一切受け取らない (改ざん不可)。

import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimit,
  isSafeOpaqueToken,
  readJsonObject,
} from "@/lib/api-security";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";
import { getStripe, getFullAccessPriceId } from "@/lib/stripe-server";
import { checkOrigin } from "@/lib/origin-check";
import { supabaseAdmin } from "@/lib/supabase-server";
import { normalizePaywallSource } from "@/lib/paywall-source";

// 支払いで解放する対象 (= そのトークンの本人 / session 本人)。
type Buyer = { id: string; email: string | null; owner_token: string | null };
type CheckoutLocale = "ja" | "ko";

export const runtime = "nodejs";
export const maxDuration = 30;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Preview はデプロイごとにホスト名が変わるため、固定の NEXT_PUBLIC_SITE_URL を
// success_url / cancel_url に使うと別デプロイへ戻ってしまう。Preview だけは実際に
// Checkout を発行したリクエストの origin を使い、本番は正規ドメインを維持する。
function getCheckoutBaseUrl(request: NextRequest): string {
  return process.env.VERCEL_ENV === "preview"
    ? request.nextUrl.origin
    : BASE_URL;
}

// ===== 「買いたくなる」Checkout 表示の定数 =====
// 実課金額 (saleAmount) はロケール別 Price ID の実額と一致していること。
// listAmount は値引き表示のアンカー (二重価格) で、結果カード側の表示と揃える。
const CHECKOUT_PRICING = {
  ja: {
    currency: "jpy",
    saleAmount: 499,
    listAmount: 1299,
    discountAmount: 800,
  },
  ko: {
    currency: "krw",
    saleAmount: 4900,
    listAmount: 12900,
    discountAmount: 8000,
  },
} as const satisfies Record<
  CheckoutLocale,
  {
    currency: "jpy" | "krw";
    saleAmount: number;
    listAmount: number;
    discountAmount: number;
  }
>;

// 値引きアンカー用クーポン (once・amount_off=discountAmount)。
// id に金額と通貨を埋めて、ロケール間の取り違えを防止する。
const CHECKOUT_COPY: Record<
  CheckoutLocale,
  {
    couponId: string;
    couponName: string;
    productName: string;
    productDescription: string;
    submitMessage: string;
  }
> = {
  ja: {
    couponId: "full-access-anchor-off800-jpy",
    couponName: "リリース記念",
    productName: "ワタシのトリセツ 性格レポート完全版",
    productDescription:
      "16ページ以上の完全版PDFレポート、恋愛・キャリアの深掘り、周りから見た印象、友達ごとの見え方・ギャップ、シーン別の相性・注意点まで、ぜんぶ解放。買い切り・追加課金なし。",
    submitMessage:
      "一度きりの買い切りで、ずっと見返せます。30日間の返金保証つき・追加課金なし。",
  },
  ko: {
    couponId: "full-access-anchor-off8000-krw",
    couponName: "출시 기념",
    productName: "나의 사용설명서 성격 리포트 완전판",
    productDescription:
      "연애·커리어 심층 분석, 주변에서 보는 나의 인상, 친구별 시선과 차이, 상황별 궁합과 주의점까지 웹에서 모두 열어 드려요. 한 번만 결제하면 언제든 다시 볼 수 있고 추가 비용은 없어요.",
    submitMessage:
      "한 번만 결제하면 계속 확인할 수 있어요. 30일 환불 보장, 추가 결제 없음. 결제 전 사이트의 이용약관 및 판매·환불 안내를 확인해 주세요.",
  },
};
// Checkout 左の商品サムネ (現行キービジュアルの PNG・768x512)。
// Stripe は JPEG/PNG/GIF 推奨なので webp ではなく PNG を使う。取得できる公開 https のみ許可。
const PRODUCT_IMAGE =
  BASE_URL.startsWith("https://") ? `${BASE_URL}/checkout-fullaccess.png` : null;

// getStripe() の非 null 戻り値 = Stripe クライアント型。
type StripeClient = NonNullable<ReturnType<typeof getStripe>>;

// 値引きアンカー用クーポンを取得 (無ければ作成)。金額・通貨が一致するものだけ採用。
// ★実課金安全: 解決できなければ null を返し、呼び出し側は Price ID (実額) にフォールバックする。
async function resolveAnchorCoupon(
  stripe: StripeClient,
  locale: CheckoutLocale,
): Promise<string | null> {
  const coupon = CHECKOUT_COPY[locale];
  const pricing = CHECKOUT_PRICING[locale];
  try {
    const c = await stripe.coupons.retrieve(coupon.couponId);
    if (
      !c.deleted &&
      c.valid &&
      c.amount_off === pricing.discountAmount &&
      c.currency === pricing.currency
    ) {
      return c.id;
    }
    // 既存だが金額/通貨が不一致 → 誤課金回避のため使わない。
    return null;
  } catch {
    // 未作成 → 作成 (id 固定で冪等)。
    try {
      const created = await stripe.coupons.create({
        id: coupon.couponId,
        amount_off: pricing.discountAmount,
        currency: pricing.currency,
        duration: "once",
        name: coupon.couponName,
      });
      return created.id;
    } catch {
      // 競合で他リクエストが作成済み → もう一度取得を試みる。
      try {
        const c = await stripe.coupons.retrieve(coupon.couponId);
        return !c.deleted &&
          c.valid &&
          c.amount_off === pricing.discountAmount &&
          c.currency === pricing.currency
          ? c.id
          : null;
      } catch {
        return null;
      }
    }
  }
}

// Price ID の実額がロケール別の saleAmount と一致するか検証 (ダッシュボードで価格変更された場合に
// 値引き経路 [LIST−DISCOUNT] で誤課金しないための安全弁)。
async function priceChargesSale(
  stripe: StripeClient,
  priceId: string,
  locale: CheckoutLocale,
): Promise<boolean> {
  const pricing = CHECKOUT_PRICING[locale];
  try {
    const price = await stripe.prices.retrieve(priceId);
    return (
      price.unit_amount === pricing.saleAmount &&
      price.currency === pricing.currency
    );
  } catch {
    return false;
  }
}

// ===== レイテンシ削減: クーポン/価格検証の結果をプロセス内キャッシュ =====
// クリックのたびに Stripe へ往復すると遷移が遅く離脱に繋がる。値引き設定は不変/ほぼ不変
// なので warm な Function インスタンス内で使い回す (cold start でリセット=再取得されるので
// ダッシュボード変更も遠からず反映される)。
const cachedCouponIds: Partial<Record<CheckoutLocale, string>> = {};
const cachedSaleChecks: Partial<
  Record<CheckoutLocale, { value: boolean; at: number; priceId: string }>
> = {};
const SALE_OK_TTL_MS = 10 * 60 * 1000; // 価格実額検証は 10 分 TTL

async function getCouponIdCached(
  stripe: StripeClient,
  locale: CheckoutLocale,
): Promise<string | null> {
  if (cachedCouponIds[locale]) return cachedCouponIds[locale] ?? null;
  const id = await resolveAnchorCoupon(stripe, locale);
  if (id) cachedCouponIds[locale] = id; // 失敗(null)はキャッシュせず次回再試行
  return id;
}

async function getSaleOkCached(
  stripe: StripeClient,
  priceId: string,
  locale: CheckoutLocale,
): Promise<boolean> {
  const now = Date.now();
  const cached = cachedSaleChecks[locale];
  if (
    cached &&
    cached.priceId === priceId &&
    now - cached.at < SALE_OK_TTL_MS
  ) {
    return cached.value;
  }
  const value = await priceChargesSale(stripe, priceId, locale);
  cachedSaleChecks[locale] = { value, at: now, priceId };
  return value;
}

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const ipLimit = await consumeRateLimit(request, {
    scope: "full-access-checkout-ip",
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

  // ===== Stripe 環境 =====
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY not configured" },
      { status: 500 },
    );
  }
  // ===== 対象本人の解決 (owner_token 優先 → session fallback) =====
  // owner_token は推測不可 (nanoid 22) の秘密トークン。閲覧と同じ capability なので、
  // これで本人を解決してよい。Cookie が無いスマホでも課金できるのが目的。
  const parsedBody = await readJsonObject(request, 2 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;
  const checkoutLocale: CheckoutLocale = body.locale === "ko" ? "ko" : "ja";
  const checkoutCopy = CHECKOUT_COPY[checkoutLocale];
  const checkoutPricing = CHECKOUT_PRICING[checkoutLocale];
  const priceId = getFullAccessPriceId(checkoutLocale);
  if (!priceId) {
    const envName =
      checkoutLocale === "ko"
        ? "STRIPE_PRICE_FULL_ACCESS_KRW"
        : "STRIPE_PRICE_FULL_ACCESS";
    return NextResponse.json(
      { error: `${envName} not configured` },
      { status: 500 },
    );
  }
  const paywallSource = normalizePaywallSource(body.paywall_source);
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
      scope: "full-access-checkout-owner",
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
  const localePrefix = checkoutLocale === "ko" ? "/ko" : "";
  const checkoutBaseUrl = getCheckoutBaseUrl(request);
  const successUrl = ownerToken
    ? `${checkoutBaseUrl}${localePrefix}/me/${ownerToken}?paid=1&session_id={CHECKOUT_SESSION_ID}`
    : `${checkoutBaseUrl}${localePrefix}/purchase-complete?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = ownerToken
    ? `${checkoutBaseUrl}${localePrefix}/me/${ownerToken}`
    : `${checkoutBaseUrl}${localePrefix || "/"}`;

  // ログイン中は email を prefill。ゲストは Stripe が Checkout で email を収集する。
  const customerEmail =
    typeof buyer?.email === "string" && buyer.email.includes("@")
      ? buyer.email
      : undefined;

  // ===== 「買いたくなる」表示: 商品説明/画像 + ロケール別の値引き表示 =====
  // 安全設計: 値引き経路 (price_data LIST + クーポン) は
  //   ① Price ID の実額が SALE と一致し ② クーポンが amount_off=DISCOUNT で解決
  //   できたときだけ使う。どちらか欠けたら Price ID (実額) にフォールバックし、
  //   アンカー価格を誤課金しない。商品説明/画像は両経路とも付ける。
  const productData: {
    name: string;
    description: string;
    images?: string[];
  } = {
    name: checkoutCopy.productName,
    description: checkoutCopy.productDescription,
    ...(PRODUCT_IMAGE ? { images: [PRODUCT_IMAGE] } : {}),
  };

  const [couponId, saleOk] = await Promise.all([
    getCouponIdCached(stripe, checkoutLocale),
    getSaleOkCached(stripe, priceId, checkoutLocale),
  ]);
  const useDiscount = !!couponId && saleOk;

  // 値引き経路: price_data で LIST を出し、クーポンで DISCOUNT 引いて実額 SALE を課金。
  //   商品名・説明・画像もここで付く (リッチ表示)。
  // フォールバック: ダッシュボードの Price ID をそのまま使う (実課金額は常にダッシュボード源泉。
  //   アンカー価格を誤課金しない)。この経路は商品表示もダッシュボード Product 依存。
  const lineItems = useDiscount
    ? [
        {
          price_data: {
            currency: checkoutPricing.currency,
            unit_amount: checkoutPricing.listAmount,
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
          message: checkoutCopy.submitMessage,
        },
      },
      // webhook は product='full_access' で分岐。user_id があればその行、無ければ (guest=1)
      // Stripe 確定 email をキーに紐付ける (email or id・email 優先)。
      metadata: {
        user_id: userId ?? "",
        product: "full_access",
        guest: userId ? "0" : "1",
        email: customerEmail ?? "",
        paywall_source: paywallSource,
        locale: checkoutLocale,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: checkoutLocale,
    });
  } catch (err) {
    console.error("[checkout/create-full-access-session] Stripe error:", err);
    return NextResponse.json(
      { error: "Stripe session 作成に失敗しました" },
      { status: 500 },
    );
  }

  // 課金ファネル計測: Stripe Checkout 到達 (サーバ発行なので session_id は無し。件数集計)。
  // 計測失敗で課金導線を止めない (エラーは握りつぶす)。
  try {
    await supabaseAdmin.from("events").insert({
      event_name: "checkout_session_created",
      owner_token: buyer?.owner_token ?? null,
      locale: checkoutLocale,
      metadata: {
        guest: userId ? false : true,
        stripe_session_id: stripeSession.id,
        source: paywallSource,
        locale: checkoutLocale,
      },
    });
  } catch {
    // noop
  }

  return NextResponse.json({ url: stripeSession.url });
}
