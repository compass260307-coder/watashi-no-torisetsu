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

// content_ids / content_name (Meta Purchase の商品識別)。
// ID は「商品キー_実売価格」で固定する (full_access は日本 ¥499 / 韓国 ₩4,900)。
const META_PURCHASE_CONTENT: Record<
  MetaPurchaseProduct,
  { id: string; koId?: string; name: string }
> = {
  self_report: {
    id: "self_report_199",
    name: "自己診断・友達診断＋分析PDF",
  },
  full_access: {
    id: "full_access_499",
    koId: "full_access_4900",
    name: "full_access",
  },
  premium_bundle: {
    id: "premium_bundle_899",
    name: "完全版＋運命の設計図",
  },
  unmei: { id: "unmei_1980", name: "運命の設計図" },
  unmei_upgrade: { id: "unmei_1480", name: "運命の設計図" },
};

export function metaPurchaseContent(
  product: MetaPurchaseProduct,
  locale: "ja" | "ko",
): { contentIds: string[]; contentName: string } {
  const entry = META_PURCHASE_CONTENT[product];
  const id = locale === "ko" && entry.koId ? entry.koId : entry.id;
  return { contentIds: [id], contentName: entry.name };
}

// ブラウザ側の送信済み抑止キー (localStorage)。
// v1 (商品なし) から、商品ごとに分けた v2 へ移行。旧 v1 キーは残るが、
// 送信済みかは DB の一意クレームが正なので再クレーム時に shouldPush:false となり
// 二重 push は起きない (v2 キーが改めて書かれる)。
const STORAGE_PREFIX = "wt_meta_purchase_sent_v2:";

export function metaPurchaseStorageKey(
  product: MetaPurchaseProduct,
  checkoutSessionId: string,
): string {
  return `${STORAGE_PREFIX}${product}:${checkoutSessionId}`;
}

// どの商品でも送信済みなら true (クライアント専用。localStorage 不可環境は false)。
// 静的ページの着地 (/aisho) で claim token 取得の API を無駄打ちしないための事前判定。
export function wasAnyMetaPurchaseSent(checkoutSessionId: string): boolean {
  try {
    return META_PURCHASE_PRODUCTS.some(
      (product) =>
        localStorage.getItem(
          metaPurchaseStorageKey(product, checkoutSessionId),
        ) === "1",
    );
  } catch {
    return false;
  }
}
