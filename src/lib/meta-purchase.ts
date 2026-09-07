// Meta Purchase 計測の商品定義と共有ヘルパー。
//
// server-only の paid-checkout-session.ts とクライアント (MetaPurchaseDataLayer 等)
// の両方から参照するため、このモジュールは isomorphic に保つ (Node API を使わない)。

export const META_PURCHASE_PRODUCTS = [
  "self_report",
  "full_access",
  "premium_bundle",
  "unmei",
  "unmei_upgrade",
] as const;

export type MetaPurchaseProduct = (typeof META_PURCHASE_PRODUCTS)[number];

export function isMetaPurchaseProduct(
  value: unknown,
): value is MetaPurchaseProduct {
  return (
    typeof value === "string" &&
    (META_PURCHASE_PRODUCTS as readonly string[]).includes(value)
  );
}

const CHECKOUT_SESSION_ID_RE = /^cs_(?:test|live)_[A-Za-z0-9]+$/;

export function isCheckoutSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 255 &&
    CHECKOUT_SESSION_ID_RE.test(value)
  );
}

// content_ids / content_name (広告 Purchase の商品識別)。
// 金額は差額購入や旧価格もあるため、利用可能なら実決済の通貨・minor amountを使う。
const META_PURCHASE_CONTENT: Record<
  MetaPurchaseProduct,
  { fallbackId: string; koFallbackId?: string; name: string }
> = {
  self_report: {
    fallbackId: "self_report_jpy_299",
    koFallbackId: "self_report_krw_1900",
    name: "学生向けライトコース",
  },
  full_access: {
    fallbackId: "full_access_jpy_499",
    koFallbackId: "full_access_krw_4900",
    name: "完全版コース",
  },
  premium_bundle: {
    fallbackId: "premium_bundle_jpy_1299",
    name: "全部入り・買い切り",
  },
  unmei: { fallbackId: "unmei_jpy_1980", name: "運命の設計図" },
  unmei_upgrade: {
    fallbackId: "unmei_upgrade_jpy_1480",
    name: "運命の設計図",
  },
};

export function metaPurchaseContent(
  product: MetaPurchaseProduct,
  locale: "ja" | "ko",
  amountMinor?: number | null,
  currency?: string | null,
): { contentIds: string[]; contentName: string } {
  const entry = META_PURCHASE_CONTENT[product];
  const normalizedCurrency = currency?.trim().toLowerCase();
  const hasActualPrice =
    Number.isSafeInteger(amountMinor) &&
    (amountMinor ?? -1) >= 0 &&
    !!normalizedCurrency &&
    /^[a-z]{3}$/.test(normalizedCurrency);
  const id = hasActualPrice
    ? `${product}_${normalizedCurrency}_${amountMinor}`
    : locale === "ko" && entry.koFallbackId
      ? entry.koFallbackId
      : entry.fallbackId;
  return { contentIds: [id], contentName: entry.name };
}

// ブラウザ側の送信済み抑止キー (localStorage)。
// v1 (商品なし) から、商品ごとに分けた v2 へ移行。旧 v1 キーは残るが、
// 同じブラウザからの再送を抑止する。端末・タブをまたぐ重複は Stripe Session IDを
// 広告側 event_id に使って重複排除する。
const STORAGE_PREFIX = "wt_meta_purchase_sent_v2:";
const TIKTOK_STORAGE_PREFIX = "wt_tiktok_purchase_sent_v1:";

export function metaPurchaseStorageKey(
  product: MetaPurchaseProduct,
  checkoutSessionId: string,
): string {
  return `${STORAGE_PREFIX}${product}:${checkoutSessionId}`;
}

export function tiktokPurchaseStorageKey(
  product: MetaPurchaseProduct,
  checkoutSessionId: string,
): string {
  return `${TIKTOK_STORAGE_PREFIX}${product}:${checkoutSessionId}`;
}

// どの商品でも送信済みなら true (クライアント専用。localStorage 不可環境は false)。
// 静的ページの着地 (/aisho) で claim token 取得の API を無駄打ちしないための事前判定。
export function wasAnyMetaPurchaseSent(checkoutSessionId: string): boolean {
  try {
    return META_PURCHASE_PRODUCTS.some((product) => {
      const metaSent =
        localStorage.getItem(
          metaPurchaseStorageKey(product, checkoutSessionId),
        ) === "1";
      const tiktokSent =
        localStorage.getItem(
          tiktokPurchaseStorageKey(product, checkoutSessionId),
        ) === "1";
      return metaSent && tiktokSent;
    });
  } catch {
    return false;
  }
}
