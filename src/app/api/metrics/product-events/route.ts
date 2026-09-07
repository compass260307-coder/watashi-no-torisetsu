// Google Sheets 向けの Alice・運命の設計図イベント差分エンドポイント。
// 個人情報や生のトークン、Stripe IDは返さず、集計用の参照IDだけを返す。
//
// GET /api/metrics/product-events?after=<ISO>&after_id=<UUID>&limit=<1..999>

import {
  authorizeSheetsMetricsRequest,
  metricsExportReference,
  metricsPrivateHeaders,
} from "@/lib/metrics-access";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 999;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PRODUCT_EVENT_NAMES = [
  "unmei_lp_view",
  "unmei_purchase_start",
  "unmei_reading_view",
  "unmei_checkout_step_view",
  "unmei_purchase_complete_embedded",
  "unmei_purchase_complete",
  "unmei_upgrade_complete",
  "birth_form_view",
  "birth_form_submit",
  "birth_form_skip",
  "unmei_nav_badge_shown",
  "unmei_nav_badge_clicked",
  "hoshiyomi_page_viewed",
  "hoshiyomi_paywall_opened",
  "hoshiyomi_message_sent",
  "hoshiyomi_response_completed",
  "hoshiyomi_response_failed",
  "paywall_viewed",
  "paywall_plan_viewed",
  "paywall_scroll_clicked",
  "purchase_cta_clicked",
  "checkout_session_created",
  "purchase_completed",
] as const;

const UNMEI_EVENT_NAMES = new Set([
  "unmei_lp_view",
  "unmei_purchase_start",
  "unmei_reading_view",
  "unmei_checkout_step_view",
  "unmei_purchase_complete_embedded",
  "unmei_purchase_complete",
  "unmei_upgrade_complete",
  "unmei_nav_badge_shown",
  "unmei_nav_badge_clicked",
]);

const ALICE_EVENT_NAMES = new Set([
  "hoshiyomi_page_viewed",
  "hoshiyomi_paywall_opened",
  "hoshiyomi_message_sent",
  "hoshiyomi_response_completed",
  "hoshiyomi_response_failed",
]);

const columns = [
  "created_at",
  "date_jst",
  "hour_jst",
  "event_ref",
  "event_name",
  "journey",
  "session_ref",
  "owner_ref",
  "payment_ref",
  "locale",
  "product",
  "page",
  "surface",
  "source",
  "return_to",
  "ui",
  "access_state",
  "payment_method",
  "plan",
  "placement",
  "variant",
] as const;

type ProductEventFact = {
  id: string;
  event_name: string;
  session_id: string | null;
  owner_token: string | null;
  locale: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function parseCursorTimestamp(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return Number.isFinite(Date.parse(trimmed)) ? trimmed : null;
}

function jstParts(iso: string): { date: string; hour: number } {
  const shifted = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
  };
}

function metadataText(
  metadata: Record<string, unknown> | null,
  key: string,
): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value.slice(0, 100) : "";
}

function productJourney(fact: ProductEventFact): "unmei" | "alice" | null {
  if (UNMEI_EVENT_NAMES.has(fact.event_name)) return "unmei";
  if (ALICE_EVENT_NAMES.has(fact.event_name)) return "alice";

  const metadata = fact.metadata;
  const product = metadataText(metadata, "product");
  const page = metadataText(metadata, "page");
  const surface = metadataText(metadata, "surface");
  const returnTo = metadataText(metadata, "return_to");
  const source = metadataText(metadata, "source");

  if (
    product === "unmei" ||
    product === "unmei_upgrade" ||
    page === "unmei" ||
    surface === "unmei" ||
    returnTo === "unmei" ||
    [
      "unmei_page",
      "unmei_hero",
      "unmei_birth_chat",
      "nav_locked_unmei",
    ].includes(source)
  ) {
    return "unmei";
  }

  if (
    page === "hoshiyomi" ||
    surface === "hoshiyomi" ||
    returnTo === "hoshiyomi" ||
    ["hoshiyomi_first_send", "nav_locked_hoshiyomi"].includes(source)
  ) {
    return "alice";
  }

  // 出生フォームは運命導線以外でも使うため、metadata で紐付く行だけを採用する。
  if (
    fact.event_name.startsWith("birth_form_") &&
    (page === "unmei" || surface === "unmei" || source.includes("unmei"))
  ) {
    return "unmei";
  }
  return null;
}

export async function GET(request: NextRequest) {
  const access = authorizeSheetsMetricsRequest(request);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: metricsPrivateHeaders },
    );
  }

  const afterParam = request.nextUrl.searchParams.get("after");
  const after = parseCursorTimestamp(afterParam);
  if (!afterParam || !after) {
    return NextResponse.json(
      { error: "after must be a valid ISO timestamp" },
      { status: 400, headers: metricsPrivateHeaders },
    );
  }

  const afterIdParam = request.nextUrl.searchParams.get("after_id");
  const afterId = afterIdParam?.trim() || null;
  if (afterId && !UUID_PATTERN.test(afterId)) {
    return NextResponse.json(
      { error: "after_id must be a valid UUID" },
      { status: 400, headers: metricsPrivateHeaders },
    );
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const baseQuery = () =>
    supabaseAdmin
      .from("events")
      .select(
        "id, event_name, session_id, owner_token, locale, metadata, created_at",
      )
      .in("event_name", [...PRODUCT_EVENT_NAMES]);

  let facts: ProductEventFact[] = [];
  let queryError: { code?: string; message?: string } | null = null;

  if (afterId) {
    const tieResult = await baseQuery()
      .eq("created_at", after)
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(limit + 1);
    queryError = tieResult.error;
    facts = (tieResult.data ?? []) as ProductEventFact[];

    if (!queryError && facts.length <= limit) {
      const laterResult = await baseQuery()
        .gt("created_at", after)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit + 1 - facts.length);
      queryError = laterResult.error;
      facts.push(...((laterResult.data ?? []) as ProductEventFact[]));
    }
  } else {
    const result = await baseQuery()
      .gt("created_at", after)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit + 1);
    queryError = result.error;
    facts = (result.data ?? []) as ProductEventFact[];
  }

  if (queryError) {
    console.error("[metrics-product-events] incremental query failed", {
      code: queryError.code,
      message: queryError.message,
    });
    return NextResponse.json(
      { error: "Unable to fetch product metrics" },
      { status: 500, headers: metricsPrivateHeaders },
    );
  }

  const page = facts.slice(0, limit);
  const rows = page.flatMap((fact) => {
    const journey = productJourney(fact);
    if (!journey) return [];
    const metadata = fact.metadata;
    const jst = jstParts(fact.created_at);
    return [
      {
        created_at: fact.created_at,
        date_jst: jst.date,
        hour_jst: jst.hour,
        event_ref: metricsExportReference(fact.id, access.exportSecret),
        event_name: fact.event_name,
        journey,
        session_ref: metricsExportReference(
          fact.session_id,
          access.exportSecret,
        ),
        owner_ref: metricsExportReference(
          fact.owner_token,
          access.exportSecret,
        ),
        payment_ref: metricsExportReference(
          metadataText(metadata, "stripe_session_id"),
          access.exportSecret,
        ),
        locale: fact.locale ?? metadataText(metadata, "locale"),
        product: metadataText(metadata, "product"),
        page: metadataText(metadata, "page"),
        surface: metadataText(metadata, "surface"),
        source: metadataText(metadata, "source"),
        return_to: metadataText(metadata, "return_to"),
        ui: metadataText(metadata, "ui"),
        access_state: metadataText(metadata, "access_state"),
        payment_method: metadataText(metadata, "payment_method"),
        plan: metadataText(metadata, "plan"),
        placement: metadataText(metadata, "placement"),
        variant: metadataText(metadata, "variant"),
      },
    ];
  });

  const last = page.at(-1);
  const nextCursor =
    last?.created_at && last.id ? { at: last.created_at, id: last.id } : null;

  return NextResponse.json(
    { columns, rows, nextCursor, hasMore: facts.length > limit },
    { headers: metricsPrivateHeaders },
  );
}
