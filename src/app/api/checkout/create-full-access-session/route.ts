// 日本版 (¥199 / ¥499 / ¥899)・韓国版 (₩1,900 / ₩4,900 / ₩8,900) の
// Stripe Checkout Session を作成する。購入済みコースがある場合は差額をサーバで算出する。
//
// POST /api/checkout/create-full-access-session
//   - 認可: body.owner_token (秘密の capability URL のトークン) でその本人を解決。
//     Cookie wn_session は fallback。理由: /me/[token]・/tako/[token] は token だけで
//     閲覧でき Cookie 不在でも CTA が出る (別端末 / アプリ内ブラウザ / ITP で Cookie 消失)。
//     Cookie 必須だとスマホで 401 → 「うまく開けません」になり課金導線が死ぬ。
//     owner_token は解放対象=そのトークン本人なので、支払いで解放されるのも本人の分だけ。
//     (編集権限 isOwner は従来通り session のみ。ここは "支払って解放" のみで安全。)
//   - 二重課金防止: 商品ごとの entitlement を確認して 409 を返す。
//   - 完了は webhook の metadata.product
//     ('self_report' / 'full_access' / 'premium_bundle') で分岐する。
//   - 戻り値: { url }
//
// 既存の create-session / create-perception-unlock-session とは別エンドポイント。
// 金額はサーバ側の共通定数と Price/price_data で固定し、
// クライアントからは金額・数量・price を一切受け取らない (改ざん不可)。

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  consumeRateLimit,
  isSafeOpaqueToken,
  readJsonObject,
} from "@/lib/api-security";
import { getSession } from "@/lib/session";
import {
  getAccessPurchaseEntitlements,
  hasFullAccess,
  hasPremiumBundleAccess,
  hasSelfReportAccess,
} from "@/lib/entitlements";
import {
  accessProductPrice,
  DESTINY_ACCESS_POLICY_PREMIUM_ONLY,
  EMPTY_ACCESS_ENTITLEMENTS,
  FRIEND_ACCESS_POLICY_FULL_ONLY,
  HOSHIYOMI_CHAT_POLICY_PREMIUM_ONLY_FULL_TRIAL,
  FULL_ACCESS_LIST_PRICE_JPY,
  FULL_ACCESS_PRICE_JPY,
  FULL_ACCESS_PRICE_KRW,
  isAccessProduct,
  isThreeCoursePaywallVersion,
  PREMIUM_BUNDLE_PRICE_JPY,
  PREMIUM_BUNDLE_PRICE_KRW,
  SELF_REPORT_PRICE_JPY,
  SELF_REPORT_PRICE_KRW,
  type AccessEntitlements,
  type AccessProduct,
} from "@/lib/access-products";
import { allThirtyTwoTypeIds } from "@/lib/thirty-two-types";
import { getStripe, getFullAccessPriceId } from "@/lib/stripe-server";
import { checkOrigin } from "@/lib/origin-check";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  DIRECT_PAYWALL_SOURCE,
  normalizePaywallSource,
} from "@/lib/paywall-source";

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
// 実課金額 (saleAmount) はサーバ固定の実売価格。
// listAmount は値引き表示のアンカー (二重価格) で、結果カード側の表示と揃える。
const CHECKOUT_PRICING = {
  ja: {
    currency: "jpy",
    saleAmount: FULL_ACCESS_PRICE_JPY,
    listAmount: FULL_ACCESS_LIST_PRICE_JPY,
    discountAmount: FULL_ACCESS_LIST_PRICE_JPY - FULL_ACCESS_PRICE_JPY,
  },
  ko: {
    currency: "krw",
    saleAmount: FULL_ACCESS_PRICE_KRW,
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
    couponId: "full-access-anchor-off400-jpy",
    couponName: "リリース記念",
    // 自己診断＋友達診断＋相性を含む ¥499 完全版パッケージ。
    productName: "ワタシのトリセツ 完全版パッケージ",
    productDescription:
      "自己診断とPDF、友達診断、恋愛パートナー相性診断に加え、専属占い師 Alice を1回答体験できます。買い切り。",
    submitMessage:
      "一度きりの買い切りで、ずっと見返せます。30日間の返金保証つき。",
  },
  ko: {
    couponId: "full-access-anchor-off8000-krw",
    couponName: "출시 기념",
    productName: "나의 사용설명서 완전판 패키지",
    productDescription:
      "자기 진단과 PDF, 친구 진단, 연애 파트너 궁합 분석을 해제하는 완전판 패키지예요. 1회 결제.",
    submitMessage:
      "한 번만 결제하면 계속 확인할 수 있어요. 30일 환불 보장. 결제 전 사이트의 이용약관 및 판매·환불 안내를 확인해 주세요.",
  },
};

const SELF_REPORT_COPY = {
  ja: {
    productName: "ワタシのトリセツ お試しコース",
    productDescription:
      "自己診断結果のロックされた8セクションをすべて解放し、16ページ以上の自己分析PDFを利用できます。買い切り。",
    submitMessage:
      "一度きりの買い切りで、自己診断結果と自己分析PDFをずっと見返せます。30日間の返金保証つき。",
  },
  ko: {
    productName: "나의 사용설명서 라이트 코스",
    productDescription:
      "자기 진단의 잠긴 8개 섹션을 모두 해제하고 16페이지 이상의 자기 분석 PDF를 이용할 수 있어요. 1회 결제.",
    submitMessage:
      "한 번만 결제하면 자기 진단 결과와 자기 분석 PDF를 계속 확인할 수 있어요. 30일 환불 보장.",
  },
} as const;

const PREMIUM_BUNDLE_COPY = {
  ja: {
    productName: "ワタシのトリセツ プレミアムコース",
    productDescription:
      "完全版のすべてと『運命の設計図』に加え、あなたの専属占い師とのチャット（30回分）を解放します。買い切り。",
    submitMessage:
      "一度きりの買い切りで、すべての診断結果・運命の設計図・専属占い師とのチャットを利用できます。30日間の返金保証つき。",
  },
  ko: {
    productName: "나의 사용설명서 프리미엄 코스",
    productDescription:
      "완전판의 모든 기능과 한국어 운명의 설계도에 더해, 나만의 전담 점성술사와 채팅 30회를 이용할 수 있어요. 1회 결제.",
    submitMessage:
      "한 번만 결제하면 모든 진단 결과, 운명의 설계도와 전담 점성술사 채팅을 이용할 수 있어요. 30일 환불 보장.",
  },
} as const;

type CheckoutSessionCreateParams = NonNullable<
  Parameters<Stripe["checkout"]["sessions"]["create"]>[0]
>;
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
      price.active &&
      price.type === "one_time" &&
      price.unit_amount === pricing.saleAmount &&
      price.currency === pricing.currency &&
      (process.env.STRIPE_AUTOMATIC_TAX_ENABLED !== "true" ||
        price.tax_behavior === "inclusive")
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
  if (body.ui_mode !== undefined && body.ui_mode !== "embedded") {
    return NextResponse.json({ error: "Invalid ui mode" }, { status: 400 });
  }
  if (
    body.payment_method !== undefined &&
    body.payment_method !== "paypay"
  ) {
    return NextResponse.json(
      { error: "Invalid payment method" },
      { status: 400 },
    );
  }
  // ui_mode:'embedded' は既存クライアントとの互換用。指定がなければカード・Link・
  // PayPayなどをStripe-hosted Checkoutで扱う。
  const paypayRedirect = body.payment_method === "paypay";
  const embedded = body.ui_mode === "embedded" && !paypayRedirect;
  const checkoutLocale: CheckoutLocale = body.locale === "ko" ? "ko" : "ja";
  if (body.product !== undefined && !isAccessProduct(body.product)) {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }
  // product 未指定は既存クライアント互換のため full_access。
  // 不正値は¥499へフォールバックせず、誤課金防止で拒否する。
  const requestedProduct: AccessProduct = body.product ?? "full_access";
  const product = requestedProduct;
  const paywallVersion =
    body.paywall_version === undefined
      ? "legacy"
      : isThreeCoursePaywallVersion(body.paywall_version)
        ? body.paywall_version
        : null;
  if (paywallVersion === null) {
    return NextResponse.json(
      { error: "Invalid paywall version" },
      { status: 400 },
    );
  }
  const paywallPlacement =
    body.paywall_placement === undefined
      ? "unknown"
      : body.paywall_placement === "inline" ||
          body.paywall_placement === "modal"
        ? body.paywall_placement
        : null;
  if (paywallPlacement === null) {
    return NextResponse.json(
      { error: "Invalid paywall placement" },
      { status: 400 },
    );
  }
  // 戻り先は allowlist 化 (任意 URL への open redirect を防ぐ)。既定 me。
  // すべてのコースで呼び出し元へ戻す。¥199にも友達診断を含むため、
  // /tako から購入した場合はその場で解放結果を確認できる。
  const requestedReturnTo =
    body.return_to === "tako"
      ? "tako"
      : body.return_to === "aisho"
        ? "aisho"
        : body.return_to === "hoshiyomi"
          ? "hoshiyomi"
          : body.return_to === "unmei"
            ? "unmei"
            : "me";
  const returnTo = requestedReturnTo;
  const checkoutCopy =
    product === "self_report"
      ? SELF_REPORT_COPY[checkoutLocale]
      : product === "premium_bundle"
        ? PREMIUM_BUNDLE_COPY[checkoutLocale]
        : CHECKOUT_COPY[checkoutLocale];
  const checkoutPricing = CHECKOUT_PRICING[checkoutLocale];
  const priceId =
    product === "full_access" ? getFullAccessPriceId(checkoutLocale) : null;
  const normalizedPaywallSource = normalizePaywallSource(body.paywall_source);
  const paywallSource =
    returnTo === "tako" && normalizedPaywallSource === DIRECT_PAYWALL_SOURCE
      ? "tako_promo_card"
      : normalizedPaywallSource;
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

  // ===== 二重課金防止 + 差額計算 =====
  // 本人が判る場合だけ現在の権限を並列取得する。クライアント表示は信用せず、
  // Checkout直前のこの値だけで実売価格を決める。
  const entitlements: AccessEntitlements = userId
    ? await Promise.all([
        hasSelfReportAccess(userId),
        hasFullAccess(userId),
        hasPremiumBundleAccess(userId),
      ]).then(([selfReport, full, premiumBundle]) => ({
        selfReport,
        full,
        premiumBundle,
      }))
    : EMPTY_ACCESS_ENTITLEMENTS;
  const alreadyPurchased =
    product === "self_report"
      ? entitlements.selfReport
      : product === "full_access"
        ? entitlements.full
        : entitlements.premiumBundle;
  if (alreadyPurchased) {
    const code =
      product === "self_report"
        ? "already_self_report"
        : product === "full_access"
          ? "already_full"
          : "already_premium_bundle";
    return NextResponse.json(
      {
        error: code,
        code,
      },
      { status: 409 },
    );
  }
  const effectivePrice = accessProductPrice(
    checkoutLocale,
    product,
    entitlements,
  );
  // 差額依存関係は users.plan ではなく、実際に残っている有効な購入履歴で記録する。
  // 旧来の plan='full' ユーザーには価格上の優待を維持しつつ、存在しない決済へ
  // premium_bundle を依存させない。
  const purchaseEntitlements = userId
    ? await getAccessPurchaseEntitlements(userId)
    : EMPTY_ACCESS_ENTITLEMENTS;
  const upgradeFrom = purchaseEntitlements.full
    ? "full_access"
    : purchaseEntitlements.selfReport
      ? "self_report"
      : "none";
  const inlineFullUpgrade =
    product === "full_access" &&
    effectivePrice !== checkoutPricing.saleAmount;
  // 日本版の新価格テストは inline price_data でサーバ固定する。
  // 韓国版の通常購入だけは従来の通貨別 Price ID を継続する。
  if (
    product === "full_access" &&
    checkoutLocale === "ko" &&
    !inlineFullUpgrade &&
    !priceId
  ) {
    const envName = "STRIPE_PRICE_FULL_ACCESS_KRW";
    return NextResponse.json(
      { error: `${envName} not configured` },
      { status: 500 },
    );
  }

  // 購入後の着地:
  //   ログイン中/owner_token あり → 既定は自分のトリセツ (/me/[owner_token])。
  //     body.return_to==='tako' のとき (/tako から購入) は /tako/[owner_token] に戻す
  //     (2026-07-22 完全版一本化: 友達診断ロックからの購入者は元の /tako に戻す)。
  //   ゲスト → 「購入完了 → 登録メールでログイン」ページ。
  const ownerToken = (buyer?.owner_token ?? "").trim();
  const localePrefix = checkoutLocale === "ko" ? "/ko" : "";
  const checkoutBaseUrl = getCheckoutBaseUrl(request);
  const aishoPath = `${localePrefix}/aisho`;
  // /aisho からの購入 (return_to='aisho') は、閲覧中のペア (?a=&b=) ごと /aisho に戻す。
  // クエリ値は実在の32タイプIDのみ許可 (success/cancel URL への注入を防ぐ)。
  const aishoPairQuery = (() => {
    if (returnTo !== "aisho") return null;
    const a = body.aisho_a;
    const b = body.aisho_b;
    const valid = new Set<string>(allThirtyTwoTypeIds() as string[]);
    return typeof a === "string" &&
      typeof b === "string" &&
      valid.has(a) &&
      valid.has(b) &&
      a !== b
      ? `a=${a}&b=${b}`
      : null;
  })();
  const successPath =
    returnTo === "aisho"
      ? `${aishoPath}?${aishoPairQuery ? `${aishoPairQuery}&` : ""}paid=1&session_id={CHECKOUT_SESSION_ID}`
      : returnTo === "hoshiyomi"
        ? `${localePrefix}/hoshiyomi?paid=1&session_id={CHECKOUT_SESSION_ID}`
        : returnTo === "unmei"
          ? `${localePrefix}/unmei?checkout=success&session_id={CHECKOUT_SESSION_ID}`
          : returnTo === "tako"
            ? `${localePrefix}/tako/${ownerToken}?paid=1&session_id={CHECKOUT_SESSION_ID}`
            : `${localePrefix}/me/${ownerToken}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const successUrl = ownerToken
    ? `${checkoutBaseUrl}${successPath}`
    : `${checkoutBaseUrl}${localePrefix}/purchase-complete?session_id={CHECKOUT_SESSION_ID}`;
  // キャンセルは購入前にいたページへ戻す。/aisho はゲスト (owner_token なし) でも
  // /aisho に戻す (従来はトップに落ちて迷子になっていた)。
  const cancelPath =
    returnTo === "aisho"
      ? `${aishoPath}${aishoPairQuery ? `?${aishoPairQuery}` : ""}`
      : returnTo === "hoshiyomi"
        ? `${localePrefix}/hoshiyomi`
        : returnTo === "unmei"
          ? `${localePrefix}/unmei`
          : ownerToken
            ? `${localePrefix}/${returnTo}/${ownerToken}`
            : localePrefix || "/";
  const cancelUrl = `${checkoutBaseUrl}${cancelPath}`;

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
    tax_code?: string;
  } = {
    name:
      upgradeFrom !== "none"
        ? checkoutLocale === "ko"
          ? `${checkoutCopy.productName} 업그레이드`
          : `${checkoutCopy.productName}へのアップグレード`
        : checkoutCopy.productName,
    description: checkoutCopy.productDescription,
    ...(PRODUCT_IMAGE ? { images: [PRODUCT_IMAGE] } : {}),
    ...(process.env.STRIPE_TAX_CODE_DIGITAL_SERVICES
      ? { tax_code: process.env.STRIPE_TAX_CODE_DIGITAL_SERVICES }
      : {}),
  };

  let lineItems: NonNullable<CheckoutSessionCreateParams["line_items"]>;
  let discounts: CheckoutSessionCreateParams["discounts"];
  let chargedAmount: number;

  if (product === "self_report") {
    // ライトはサーバー固定の inline price_data。完全版 Price IDへのフォールバックで
    // 誤課金しないよう、自己診断商品では外部 Price IDを参照しない。
    lineItems = [
      {
        price_data: {
          currency: checkoutPricing.currency,
          unit_amount: effectivePrice,
          tax_behavior: "inclusive",
          product_data: productData,
        },
        quantity: 1,
      },
    ];
    chargedAmount = effectivePrice;
  } else if (product === "premium_bundle" || inlineFullUpgrade) {
    // ¥499への差額アップグレードと、¥899プレミアム (定価/差額) は
    // サーバ計算済みのinline price_dataを使う。クライアントから金額は受け取らない。
    lineItems = [
      {
        price_data: {
          currency: checkoutPricing.currency,
          unit_amount: effectivePrice,
          tax_behavior: "inclusive",
          product_data: productData,
        },
        quantity: 1,
      },
    ];
    chargedAmount = effectivePrice;
  } else if (checkoutLocale === "ja") {
    // 日本版完全版は、クーポン解決時は通常価格−割引を Stripe に表示する。
    // クーポンを使えない場合も、共通定数の ¥499 を inline で課金する。
    const couponId = await getCouponIdCached(stripe, checkoutLocale);
    const useDiscount = !!couponId;
    lineItems = [
      {
        price_data: {
          currency: checkoutPricing.currency,
          unit_amount: useDiscount
            ? checkoutPricing.listAmount
            : checkoutPricing.saleAmount,
          tax_behavior: "inclusive",
          product_data: productData,
        },
        quantity: 1,
      },
    ];
    discounts = useDiscount ? [{ coupon: couponId! }] : undefined;
    chargedAmount = checkoutPricing.saleAmount;
  } else {
    const [couponId, saleOk] = await Promise.all([
      getCouponIdCached(stripe, checkoutLocale),
      getSaleOkCached(stripe, priceId!, checkoutLocale),
    ]);
    if (!saleOk) {
      console.error(
        "[checkout/create-full-access-session] price validation failed",
        { locale: checkoutLocale, price_id: priceId },
      );
      return NextResponse.json(
        {
          error: "price_configuration_invalid",
          code: "price_configuration_invalid",
        },
        { status: 503 },
      );
    }
    const useDiscount = !!couponId;

    // 韓国版は従来どおり、検証済みの値引き経路かPrice IDへフォールバックする。
    lineItems = useDiscount
      ? [
          {
            price_data: {
              currency: checkoutPricing.currency,
              unit_amount: checkoutPricing.listAmount,
              tax_behavior: "inclusive",
              product_data: productData,
            },
            quantity: 1,
          },
        ]
      : [{ price: priceId!, quantity: 1 }];
    discounts = useDiscount ? [{ coupon: couponId! }] : undefined;
    chargedAmount = checkoutPricing.saleAmount;
  }

  // ===== Stripe Session 作成 =====
  let stripeSession;
  try {
    const automaticTaxEnabled =
      process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true";
    const sessionParams: CheckoutSessionCreateParams = {
      mode: "payment", // 買い切り (subscription ではない)
      line_items: lineItems,
      // payment_method_types は固定せず、Stripe Dashboard で有効な決済手段を
      // 通貨・国・端末に応じて動的表示する。韓国では現地カード、Kakao Pay、
      // Naver Pay、Samsung Pay、PAYCO をDashboard側で有効化する。
      ...(automaticTaxEnabled
        ? {
            automatic_tax: { enabled: true },
            billing_address_collection: "required" as const,
          }
        : {}),
      ...(discounts ? { discounts } : {}),
      ...(userId ? { client_reference_id: userId } : {}),
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      // 支払い直前の安心コピー (買い切り・返金保証)。
      custom_text: {
        submit: {
          message: checkoutCopy.submitMessage,
        },
      },
      // webhook は商品キーで分岐。user_id があればその行、無ければ (guest=1)
      // Stripe 確定 email をキーに紐付ける (email or id・email 優先)。
      metadata: {
        user_id: userId ?? "",
        owner_token: ownerToken,
        product,
        // サーバ側で固定し、クライアント入力には依存させない。
        // この印が無い旧 full_access セッションは従来特典を維持する。
        destiny_access_policy: DESTINY_ACCESS_POLICY_PREMIUM_ONLY,
        // 日本版の完全版だけ、Aliceを1回答試せる。継続利用はプレミアム。
        hoshiyomi_chat_policy:
          checkoutLocale === "ja" && product === "full_access"
            ? HOSHIYOMI_CHAT_POLICY_PREMIUM_ONLY_FULL_TRIAL
            : "",
        // この印が無い旧 self_report セッションは従来の友達特典を維持する。
        friend_access_policy: FRIEND_ACCESS_POLICY_FULL_ONLY,
        upgrade_from: upgradeFrom,
        course_price_minor: String(
          checkoutLocale === "ko"
            ? product === "self_report"
              ? SELF_REPORT_PRICE_KRW
              : product === "full_access"
                ? FULL_ACCESS_PRICE_KRW
                : PREMIUM_BUNDLE_PRICE_KRW
            : product === "self_report"
              ? SELF_REPORT_PRICE_JPY
              : product === "full_access"
                ? FULL_ACCESS_PRICE_JPY
                : PREMIUM_BUNDLE_PRICE_JPY,
        ),
        course_price_jpy:
          checkoutLocale === "ja"
            ? String(
                product === "self_report"
                  ? SELF_REPORT_PRICE_JPY
                  : product === "full_access"
                    ? FULL_ACCESS_PRICE_JPY
                    : PREMIUM_BUNDLE_PRICE_JPY,
              )
            : "",
        tax_behavior: "inclusive",
        automatic_tax: automaticTaxEnabled ? "1" : "0",
        guest: userId ? "0" : "1",
        email: customerEmail ?? "",
        paywall_source: paywallSource,
        paywall_version: paywallVersion,
        paywall_placement: paywallPlacement,
        return_to: returnTo,
        locale: checkoutLocale,
      },
      locale: checkoutLocale,
      ...(embedded
        ? {
            ui_mode: "embedded_page" as const,
            redirect_on_completion: "never" as const,
          }
        : {
            success_url: successUrl,
            cancel_url: cancelUrl,
            ...(paypayRedirect
              ? {
                  payment_method_types: ["paypay"] as unknown as NonNullable<
                    CheckoutSessionCreateParams["payment_method_types"]
                  >,
                }
              : {}),
          }),
    };
    stripeSession = await stripe.checkout.sessions.create(sessionParams);
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
        user_id: userId,
        stripe_session_id: stripeSession.id,
        product,
        upgrade_from: upgradeFrom,
        charged_amount: chargedAmount,
        source: paywallSource,
        paywall_version: paywallVersion,
        placement: paywallPlacement,
        return_to: returnTo,
        locale: checkoutLocale,
        payment_method: paypayRedirect
          ? "paypay"
          : embedded
            ? "card_embedded"
            : "redirect",
      },
    });
  } catch {
    // noop
  }

  // amount / currency は meta_initiate_checkout (GTM) 用の実売価格。
  // 実課金額の源泉はサーバ (ロケール別 Price) なので、クライアントに持たせない。
  return NextResponse.json({
    sessionId: stripeSession.id,
    ...(embedded
      ? { clientSecret: stripeSession.client_secret }
      : { url: stripeSession.url }),
    amount: chargedAmount,
    currency: checkoutPricing.currency.toUpperCase(),
  });
}
