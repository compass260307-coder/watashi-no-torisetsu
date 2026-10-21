import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";

import {
  isMetaPurchaseProduct,
  metaPurchaseContent,
} from "@/lib/meta-purchase";
import {
  SITE_TIKTOK_PIXEL_CODES,
  purchaseEventExpiryReason,
  readTikTokSettings,
  tikTokConfigForPixel,
} from "@/lib/purchase-conversion-config";
import { resolveSiteUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/lib/supabase-server";

type Provider = "meta" | "tiktok";

export type ServerPurchaseConversionInput = {
  session: Stripe.Checkout.Session;
  userId: string | null;
  product: string;
  paidAt: string;
};

type PurchaseConversionOutboxRow = {
  id: string;
  provider: Provider;
  destination_id: string;
  stripe_session_id: string;
  user_id: string | null;
  product: string;
  paid_at: string;
  status: "pending" | "processing" | "sent" | "failed" | "expired";
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
};

export type PurchaseConversionDeliverySummary = {
  claimed: number;
  sent: number;
  failed: number;
  expired: number;
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function deterministicEventId(
  provider: Provider,
  sessionId: string,
  destinationId = "",
): string {
  // The original integration sent only to the first site pixel. Keep its
  // audit key so an old success never suppresses either additional pixel.
  const scope =
    provider === "tiktok" && destinationId !== SITE_TIKTOK_PIXEL_CODES[0]
      ? `${provider}:${destinationId}`
      : provider;
  const hex = sha256(
    `server_purchase_conversion\0${scope}\0${sessionId}`,
  ).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizedEmail(session: Stripe.Checkout.Session): string | null {
  const value =
    session.customer_details?.email ??
    session.customer_email ??
    session.metadata?.email ??
    null;
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized && normalized.length <= 320 ? normalized : null;
}

function valueInMajorUnit(amountMinor: number, currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency)
    ? amountMinor
    : amountMinor / 100;
}

function sourceUrl(session: Stripe.Checkout.Session): string {
  const localePrefix =
    session.metadata?.locale === "ko"
      ? "/ko"
      : session.metadata?.locale === "en"
        ? "/en"
        : session.metadata?.locale === "id"
          ? "/id"
          : "";
  const path =
    session.metadata?.return_to === "tako"
      ? "/tako"
      : session.metadata?.return_to === "aisho"
        ? "/aisho"
        : session.metadata?.return_to === "unmei" ||
            session.metadata?.product === "unmei" ||
            session.metadata?.product === "unmei_upgrade"
          ? "/unmei"
          : "/me";
  return `${resolveSiteUrl()}${localePrefix}${path}`;
}

function productContent(
  product: string,
  locale: "ja" | "ko" | "en" | "id",
  amountMinor: number,
  currency: string,
) {
  if (isMetaPurchaseProduct(product)) {
    return metaPurchaseContent(product, locale, amountMinor, currency);
  }
  const safeProduct = product.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return {
    contentIds: [`${safeProduct || "purchase"}_${currency}_${amountMinor}`],
    contentName: safeProduct || "purchase",
  };
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return {
      ok: response.ok,
      status: response.status,
      body: (await response.text()).slice(0, 500),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function wasDelivered(
  provider: Provider,
  sessionId: string,
  destinationId = "",
) {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", deterministicEventId(provider, sessionId, destinationId))
    .maybeSingle();
  if (error) {
    throw new Error(
      `[purchase-conversion] ${provider} audit lookup failed: ${error.message}`,
    );
  }
  return !!data;
}

async function recordDelivery(
  provider: Provider,
  input: ServerPurchaseConversionInput,
  destinationId = "",
): Promise<void> {
  const { session } = input;
  const { error } = await supabaseAdmin.from("events").insert({
    id: deterministicEventId(provider, session.id, destinationId),
    event_name: "server_purchase_conversion_sent",
    locale:
      session.metadata?.locale === "ko"
        ? "ko"
        : session.metadata?.locale === "en"
          ? "en"
          : session.metadata?.locale === "id"
            ? "id"
            : "ja",
    metadata: {
      provider,
      ...(provider === "tiktok" ? { pixel_code: destinationId } : {}),
      stripe_session_id: session.id,
      product: input.product,
      amount_total: session.amount_total,
      currency: session.currency,
      event_id: session.id,
      paid_at: input.paidAt,
    },
  });
  if (error && error.code !== "23505") {
    throw new Error(
      `[purchase-conversion] ${provider} audit insert failed: ${error.message}`,
    );
  }
}

async function sendMeta(
  input: ServerPurchaseConversionInput,
  config: { pixelId: string; accessToken: string; apiVersion: string },
): Promise<void> {
  if (await wasDelivered("meta", input.session.id)) return;
  const { session, userId, product, paidAt } = input;
  if (session.amount_total === null || !session.currency) {
    throw new Error(`[purchase-conversion] missing amount for ${session.id}`);
  }
  const currency = session.currency.toLowerCase();
  const locale =
    session.metadata?.locale === "ko"
      ? "ko"
      : session.metadata?.locale === "en"
        ? "en"
        : session.metadata?.locale === "id"
          ? "id"
          : "ja";
  const content = productContent(
    product,
    locale,
    session.amount_total,
    currency,
  );
  const email = normalizedEmail(session);
  const userData = {
    ...(email ? { em: [sha256(email)] } : {}),
    ...(userId ? { external_id: [sha256(userId.trim().toLowerCase())] } : {}),
    ...(session.metadata?.fbp ? { fbp: session.metadata.fbp } : {}),
    ...(session.metadata?.fbc ? { fbc: session.metadata.fbc } : {}),
  };
  const endpoint = new URL(
    `https://graph.facebook.com/${encodeURIComponent(config.apiVersion)}/${encodeURIComponent(config.pixelId)}/events`,
  );
  endpoint.searchParams.set("access_token", config.accessToken);
  assertFreshEvent(input);
  const result = await fetchJsonWithTimeout(endpoint.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.parse(paidAt) / 1000),
          event_id: session.id,
          action_source: "website",
          event_source_url: sourceUrl(session),
          user_data: userData,
          custom_data: {
            currency: currency.toUpperCase(),
            value: valueInMajorUnit(session.amount_total, currency),
            content_ids: content.contentIds,
            content_name: content.contentName,
            content_type: "product",
          },
        },
      ],
    }),
  });
  if (!result.ok) {
    throw new Error(`[purchase-conversion] Meta HTTP ${result.status}`);
  }
  let acknowledgement: { events_received?: unknown; error?: unknown };
  try {
    acknowledgement = JSON.parse(result.body);
  } catch {
    throw new Error(
      "[purchase-conversion] Meta returned an invalid acknowledgement",
    );
  }
  if (
    !acknowledgement ||
    acknowledgement.error ||
    acknowledgement.events_received !== 1
  ) {
    throw new Error(
      "[purchase-conversion] Meta did not acknowledge the purchase event",
    );
  }
  await recordDelivery("meta", input);
}

async function sendTikTok(
  input: ServerPurchaseConversionInput,
  config: { pixelCode: string; accessToken: string },
): Promise<void> {
  if (await wasDelivered("tiktok", input.session.id, config.pixelCode)) return;
  const { session, userId, product, paidAt } = input;
  if (session.amount_total === null || !session.currency) {
    throw new Error(`[purchase-conversion] missing amount for ${session.id}`);
  }
  const currency = session.currency.toLowerCase();
  const locale =
    session.metadata?.locale === "ko"
      ? "ko"
      : session.metadata?.locale === "en"
        ? "en"
        : session.metadata?.locale === "id"
          ? "id"
          : "ja";
  const content = productContent(
    product,
    locale,
    session.amount_total,
    currency,
  );
  const email = normalizedEmail(session);
  const value = valueInMajorUnit(session.amount_total, currency);
  assertFreshEvent(input);
  const result = await fetchJsonWithTimeout(
    "https://business-api.tiktok.com/open_api/v1.3/event/track/",
    {
      method: "POST",
      headers: {
        "Access-Token": config.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_source: "web",
        event_source_id: config.pixelCode,
        data: [
          {
            event: "Purchase",
            event_time: Math.floor(Date.parse(paidAt) / 1000),
            event_id: session.id,
            user: {
              ...(email ? { email: [sha256(email)] } : {}),
              ...(userId
                ? { external_id: [sha256(userId.trim().toLowerCase())] }
                : {}),
              ...(session.metadata?.ttclid
                ? { ttclid: session.metadata.ttclid }
                : {}),
              ...(session.metadata?.ttp ? { ttp: session.metadata.ttp } : {}),
            },
            page: { url: sourceUrl(session) },
            properties: {
              content_type: "product",
              content_ids: content.contentIds,
              contents: [
                {
                  price: value,
                  quantity: 1,
                  content_type: "product",
                  content_id: content.contentIds[0],
                },
              ],
              description: content.contentName,
              currency: currency.toUpperCase(),
              value,
              quantity: 1,
            },
          },
        ],
      }),
    },
  );
  if (!result.ok) {
    throw new Error(`[purchase-conversion] TikTok HTTP ${result.status}`);
  }
  let acknowledgement: { code?: unknown };
  try {
    acknowledgement = JSON.parse(result.body);
  } catch {
    throw new Error(
      "[purchase-conversion] TikTok returned an invalid acknowledgement",
    );
  }
  if (!acknowledgement || acknowledgement.code !== 0) {
    // Do not persist provider messages, which may echo identifiers or tokens.
    throw new Error(
      "[purchase-conversion] TikTok did not acknowledge the purchase event",
    );
  }
  await recordDelivery("tiktok", input, config.pixelCode);
}

function messageFromError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  const secrets = [
    process.env.META_CONVERSIONS_API_TOKEN,
    process.env.TIKTOK_EVENTS_API_TOKEN,
    ...[...readTikTokSettings().pixels.values()].map(
      (pixel) => pixel.accessToken,
    ),
  ].filter((value): value is string => !!value);
  for (const secret of secrets)
    message = message.split(secret).join("[redacted]");
  return message.slice(0, 1_000);
}

class ExpiredPurchaseError extends Error {}

function assertFreshEvent(input: ServerPurchaseConversionInput): void {
  // Called immediately before the HTTP request as well as when claiming a row.
  const reason = purchaseEventExpiryReason("meta", input.paidAt);
  if (reason) throw new ExpiredPurchaseError(reason);
}

async function expireClaimedRow(
  row: PurchaseConversionOutboxRow,
): Promise<boolean> {
  const reason = purchaseEventExpiryReason(row.provider, row.paid_at);
  if (!reason) return false;
  const { error } = await supabaseAdmin
    .from("purchase_conversion_delivery_outbox")
    .update({
      status: "expired",
      last_error: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .eq("attempts", row.attempts);
  if (error)
    throw new Error("[purchase-conversion] outbox expiry update failed");
  return true;
}

function retryAt(attempts: number): string {
  // 5m, 10m, 20m ... capped at 24h. The deterministic provider event_id makes
  // a retry safe even if the provider accepted a request before our audit write.
  const delayMs = Math.min(
    24 * 60 * 60 * 1_000,
    5 * 60 * 1_000 * 2 ** Math.max(0, Math.min(attempts - 1, 12)),
  );
  return new Date(Date.now() + delayMs).toISOString();
}

async function markOutboxSent(row: PurchaseConversionOutboxRow): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("purchase_conversion_delivery_outbox")
    .update({
      status: "sent",
      next_attempt_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .eq("attempts", row.attempts);
  if (error) {
    throw new Error(
      `[purchase-conversion] ${row.provider} outbox completion failed: ${error.message}`,
    );
  }
}

async function markOutboxFailed(
  row: PurchaseConversionOutboxRow,
  error: unknown,
): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from("purchase_conversion_delivery_outbox")
    .update({
      status: "failed",
      next_attempt_at: retryAt(row.attempts),
      last_error: messageFromError(error),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "processing")
    .eq("attempts", row.attempts);
  if (updateError) {
    console.error("[purchase-conversion] outbox failure update failed", {
      provider: row.provider,
      stripe_session_id: row.stripe_session_id,
      error: updateError.message,
      delivery_error: messageFromError(error),
    });
  }
}

async function claimOutboxRows(
  limit: number,
  sessionId: string | null,
): Promise<PurchaseConversionOutboxRow[]> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_due_purchase_conversion_deliveries",
    {
      p_limit: Math.max(1, Math.min(limit, 100)),
      p_session_id: sessionId,
    },
  );
  if (error) {
    throw new Error(
      `[purchase-conversion] outbox claim failed: ${error.message}`,
    );
  }
  return (data ?? []) as PurchaseConversionOutboxRow[];
}

function metaConfig(): {
  pixelId: string;
  accessToken: string;
  apiVersion: string;
} {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN?.trim();
  const apiVersion = process.env.META_GRAPH_API_VERSION?.trim();
  if (!pixelId || !accessToken || !apiVersion) {
    throw new Error(
      "[purchase-conversion] Meta server tracking configuration is incomplete",
    );
  }
  return { pixelId, accessToken, apiVersion };
}

type DeliveryResult = "sent" | "failed" | "expired";

async function deliverClaimedRow(
  row: PurchaseConversionOutboxRow,
  input: ServerPurchaseConversionInput,
): Promise<DeliveryResult> {
  // The original queue timestamp is immutable, including on webhook replay.
  input = { ...input, paidAt: row.paid_at };
  try {
    if (await expireClaimedRow(row)) return "expired";
    if (row.provider === "meta") {
      await sendMeta(input, metaConfig());
    } else {
      await sendTikTok(input, tikTokConfigForPixel(row.destination_id));
    }
    await markOutboxSent(row);
    return "sent";
  } catch (error) {
    if (error instanceof ExpiredPurchaseError && (await expireClaimedRow(row)))
      return "expired";
    await markOutboxFailed(row, error);
    console.error("[purchase-conversion] delivery failed; queued for retry", {
      provider: row.provider,
      destination_id: row.destination_id,
      stripe_session_id: row.stripe_session_id,
      attempts: row.attempts,
      error: messageFromError(error),
    });
    return "failed";
  }
}

function summarize(
  rows: PurchaseConversionOutboxRow[],
  results: DeliveryResult[],
): PurchaseConversionDeliverySummary {
  return {
    claimed: rows.length,
    sent: results.filter((result) => result === "sent").length,
    failed: results.filter((result) => result === "failed").length,
    expired: results.filter((result) => result === "expired").length,
  };
}

/**
 * Required webhook step: save durable jobs before returning 200 to Stripe.
 * The provider/destination/session key makes every Stripe webhook replay idempotent.
 */
export async function enqueueServerPurchaseConversions(
  input: ServerPurchaseConversionInput,
): Promise<void> {
  const destinations = [
    { provider: "meta" as const, destination_id: "" },
    ...readTikTokSettings().pixelCodes.map((pixelCode) => ({
      provider: "tiktok" as const,
      destination_id: pixelCode,
    })),
  ];
  const rows = destinations.map((destination) => ({
    ...destination,
    stripe_session_id: input.session.id,
    user_id: input.userId,
    product: input.product,
    paid_at: input.paidAt,
    status: "pending",
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin
    .from("purchase_conversion_delivery_outbox")
    .upsert(rows, {
      onConflict: "provider,destination_id,stripe_session_id",
      ignoreDuplicates: true,
    });
  if (error) {
    throw new Error(
      `[purchase-conversion] outbox enqueue failed for ${input.session.id}: ${error.message}`,
    );
  }
}

/**
 * Best-effort immediate delivery for Next.js after(). Failures stay in the DB
 * and are retried by the cron worker; they never turn a paid webhook into 500.
 */
export async function deliverServerPurchaseConversions(
  input: ServerPurchaseConversionInput,
): Promise<PurchaseConversionDeliverySummary> {
  try {
    const rows = await claimOutboxRows(100, input.session.id);
    const results = await Promise.all(
      rows.map((row) => deliverClaimedRow(row, input)),
    );
    return summarize(rows, results);
  } catch (error) {
    console.error("[purchase-conversion] immediate delivery could not start", {
      stripe_session_id: input.session.id,
      error: messageFromError(error),
    });
    return { claimed: 0, sent: 0, failed: 0, expired: 0 };
  }
}

/** Process durable jobs claimed by the Vercel Cron route. */
export async function processDueServerPurchaseConversions(
  limit = 25,
): Promise<PurchaseConversionDeliverySummary> {
  // Claim also expires the entire stale backlog before applying the batch limit.
  const rows = await claimOutboxRows(limit, null);
  const stripe = getStripe();
  const sessionRequests = new Map<string, Promise<Stripe.Checkout.Session>>();
  const getSession = (sessionId: string) => {
    const existing = sessionRequests.get(sessionId);
    if (existing) return existing;
    if (!stripe)
      throw new Error(
        "[purchase-conversion] STRIPE_SECRET_KEY is not configured for retry worker",
      );
    const request = stripe.checkout.sessions.retrieve(sessionId);
    sessionRequests.set(sessionId, request);
    return request;
  };

  const results: DeliveryResult[] = [];
  // Four concurrent jobs keep provider pressure bounded while staying well
  // within the cron function duration even when a provider hits the 8s timeout.
  for (let start = 0; start < rows.length; start += 4) {
    const batch = rows.slice(start, start + 4);
    const batchResults = await Promise.all(
      batch.map(async (row) => {
        try {
          if (await expireClaimedRow(row)) return "expired" as const;
          const session = await getSession(row.stripe_session_id);
          return await deliverClaimedRow(row, {
            session,
            userId: row.user_id,
            product: row.product,
            paidAt: row.paid_at,
          });
        } catch (error) {
          await markOutboxFailed(row, error);
          console.error("[purchase-conversion] retry preparation failed", {
            provider: row.provider,
            stripe_session_id: row.stripe_session_id,
            error: messageFromError(error),
          });
          return "failed" as const;
        }
      }),
    );
    results.push(...batchResults);
  }
  return summarize(rows, results);
}
