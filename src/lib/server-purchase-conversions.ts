import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";

import {
  isMetaPurchaseProduct,
  metaPurchaseContent,
} from "@/lib/meta-purchase";
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
  stripe_session_id: string;
  user_id: string | null;
  product: string;
  paid_at: string;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
};

export type PurchaseConversionDeliverySummary = {
  claimed: number;
  sent: number;
  failed: number;
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

function deterministicEventId(provider: Provider, sessionId: string): string {
  const hex = sha256(`server_purchase_conversion\0${provider}\0${sessionId}`).slice(
    0,
    32,
  );
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
  const localePrefix = session.metadata?.locale === "ko" ? "/ko" : "";
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
  locale: "ja" | "ko",
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

async function wasDelivered(provider: Provider, sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", deterministicEventId(provider, sessionId))
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
): Promise<void> {
  const { session } = input;
  const { error } = await supabaseAdmin.from("events").insert({
    id: deterministicEventId(provider, session.id),
    event_name: "server_purchase_conversion_sent",
    locale: session.metadata?.locale === "ko" ? "ko" : "ja",
    metadata: {
      provider,
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
  const locale = session.metadata?.locale === "ko" ? "ko" : "ja";
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
    throw new Error(
      `[purchase-conversion] Meta ${result.status}: ${result.body}`,
    );
  }
  await recordDelivery("meta", input);
}

async function sendTikTok(
  input: ServerPurchaseConversionInput,
  config: { pixelCode: string; accessToken: string },
): Promise<void> {
  if (await wasDelivered("tiktok", input.session.id)) return;
  const { session, userId, product, paidAt } = input;
  if (session.amount_total === null || !session.currency) {
    throw new Error(`[purchase-conversion] missing amount for ${session.id}`);
  }
  const currency = session.currency.toLowerCase();
  const locale = session.metadata?.locale === "ko" ? "ko" : "ja";
  const content = productContent(
    product,
    locale,
    session.amount_total,
    currency,
  );
  const email = normalizedEmail(session);
  const value = valueInMajorUnit(session.amount_total, currency);
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
              ...(session.metadata?.ttp
                ? { ttp: session.metadata.ttp }
                : {}),
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
    throw new Error(
      `[purchase-conversion] TikTok ${result.status}: ${result.body}`,
    );
  }
  try {
    const parsed = JSON.parse(result.body) as { code?: unknown; message?: unknown };
    const responseCode = Number(parsed.code);
    if (Number.isFinite(responseCode) && responseCode !== 0) {
      throw new Error(
        `[purchase-conversion] TikTok code ${responseCode}: ${String(parsed.message ?? "unknown error")}`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("[purchase-conversion]")
    ) {
      throw error;
    }
    // Some successful API responses may not be JSON; HTTP success remains valid.
  }
  await recordDelivery("tiktok", input);
}

function messageFromError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1_000);
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

async function markOutboxSent(
  row: PurchaseConversionOutboxRow,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("purchase_conversion_outbox")
    .update({
      status: "sent",
      next_attempt_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", row.id);
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
    .from("purchase_conversion_outbox")
    .update({
      status: "failed",
      next_attempt_at: retryAt(row.attempts),
      last_error: messageFromError(error),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
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
    "claim_due_purchase_conversions",
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

function tiktokConfig(): { pixelCode: string; accessToken: string } {
  const pixelCode = process.env.TIKTOK_PIXEL_CODE?.trim();
  const accessToken = process.env.TIKTOK_EVENTS_API_TOKEN?.trim();
  if (!pixelCode || !accessToken) {
    throw new Error(
      "[purchase-conversion] TikTok server tracking configuration is incomplete",
    );
  }
  return { pixelCode, accessToken };
}

async function deliverClaimedRow(
  row: PurchaseConversionOutboxRow,
  input: ServerPurchaseConversionInput,
): Promise<boolean> {
  try {
    if (row.provider === "meta") {
      await sendMeta(input, metaConfig());
    } else {
      await sendTikTok(input, tiktokConfig());
    }
    await markOutboxSent(row);
    return true;
  } catch (error) {
    await markOutboxFailed(row, error);
    console.error("[purchase-conversion] delivery failed; queued for retry", {
      provider: row.provider,
      stripe_session_id: row.stripe_session_id,
      attempts: row.attempts,
      error: messageFromError(error),
    });
    return false;
  }
}

/**
 * Required webhook step: save durable jobs before returning 200 to Stripe.
 * The unique provider/session key makes every Stripe webhook replay idempotent.
 */
export async function enqueueServerPurchaseConversions(
  input: ServerPurchaseConversionInput,
): Promise<void> {
  const rows = (["meta", "tiktok"] as const).map((provider) => ({
    provider,
    stripe_session_id: input.session.id,
    user_id: input.userId,
    product: input.product,
    paid_at: input.paidAt,
    status: "pending",
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin
    .from("purchase_conversion_outbox")
    .upsert(rows, {
      onConflict: "provider,stripe_session_id",
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
    const rows = await claimOutboxRows(2, input.session.id);
    const results = await Promise.all(
      rows.map((row) => deliverClaimedRow(row, input)),
    );
    const sent = results.filter(Boolean).length;
    return { claimed: rows.length, sent, failed: rows.length - sent };
  } catch (error) {
    console.error("[purchase-conversion] immediate delivery could not start", {
      stripe_session_id: input.session.id,
      error: messageFromError(error),
    });
    return { claimed: 0, sent: 0, failed: 0 };
  }
}

/** Process durable jobs claimed by the Vercel Cron route. */
export async function processDueServerPurchaseConversions(
  limit = 25,
): Promise<PurchaseConversionDeliverySummary> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      "[purchase-conversion] STRIPE_SECRET_KEY is not configured for retry worker",
    );
  }
  const rows = await claimOutboxRows(limit, null);
  const sessionRequests = new Map<
    string,
    Promise<Stripe.Checkout.Session>
  >();
  const getSession = (sessionId: string) => {
    const existing = sessionRequests.get(sessionId);
    if (existing) return existing;
    const request = stripe.checkout.sessions.retrieve(sessionId);
    sessionRequests.set(sessionId, request);
    return request;
  };

  let sent = 0;
  let failed = 0;
  // Four concurrent jobs keep provider pressure bounded while staying well
  // within the cron function duration even when a provider hits the 8s timeout.
  for (let start = 0; start < rows.length; start += 4) {
    const batch = rows.slice(start, start + 4);
    const results = await Promise.all(
      batch.map(async (row) => {
        try {
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
          return false;
        }
      }),
    );
    sent += results.filter(Boolean).length;
    failed += results.filter((result) => !result).length;
  }
  return { claimed: rows.length, sent, failed };
}
