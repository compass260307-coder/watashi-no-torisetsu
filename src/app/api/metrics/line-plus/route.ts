// Google Sheets 向けの Alice Plus（LINE）購入・契約状態の差分エンドポイント。
//
// Alice Plus は payment_history とは別系統の line_plus_subscriptions に保存される。
// 解約・期間更新で既存行が更新されるため、sales と同じく updated_at + id をカーソルにし、
// シート側は plus_ref で上書き（upsert）する。Stripe ID や生の LINE userId は出さない。
//
// GET /api/metrics/line-plus?after=<ISO>&after_id=<UUID>&limit=<1..999>

import {
  authorizeSheetsMetricsRequest,
  metricsExportReference,
  metricsPrivateHeaders,
} from "@/lib/metrics-access";
import { isLinePlusPlanId, LINE_PLUS_PLANS } from "@/lib/line-plus-products";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 999;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const columns = [
  "updated_at",
  "purchased_at",
  "date_jst",
  "hour_jst",
  "plus_ref",
  "user_ref",
  "line_user_ref",
  "plan_key",
  "purchase_kind",
  "price_jpy",
  "status",
  "current_period_end",
  "cancel_at_period_end",
] as const;

type LinePlusFact = {
  id: string;
  user_id: string;
  line_user_id: string;
  plan_key: string | null;
  status: string;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
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

function purchaseKind(planKey: string): string {
  if (isLinePlusPlanId(planKey)) return LINE_PLUS_PLANS[planKey].purchaseKind;
  return planKey === "lifetime" ? "lifetime" : "";
}

function priceJpy(planKey: string): number | "" {
  return isLinePlusPlanId(planKey) ? LINE_PLUS_PLANS[planKey].priceYen : "";
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
  let query = supabaseAdmin
    .from("line_plus_subscriptions")
    .select(
      "id, user_id, line_user_id, plan_key, status, purchased_at, created_at, updated_at, current_period_end, cancel_at_period_end",
    )
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (afterId) {
    query = query.or(
      `updated_at.gt.${after},and(updated_at.eq.${after},id.gt.${afterId})`,
    );
  } else {
    query = query.gt("updated_at", after);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[metrics-line-plus] incremental query failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to fetch Alice Plus metrics" },
      { status: 500, headers: metricsPrivateHeaders },
    );
  }

  const facts = (data ?? []) as LinePlusFact[];
  const page = facts.slice(0, limit);
  const rows = page.map((fact) => {
    // サブスクは purchased_at を持たないため、契約作成時刻を購入時刻とみなす。
    const purchasedAt = fact.purchased_at ?? fact.created_at;
    const jst = jstParts(purchasedAt);
    const planKey = fact.plan_key ?? "";
    return {
      updated_at: fact.updated_at,
      purchased_at: purchasedAt,
      date_jst: jst.date,
      hour_jst: jst.hour,
      plus_ref: metricsExportReference(fact.id, access.exportSecret),
      user_ref: metricsExportReference(fact.user_id, access.exportSecret),
      line_user_ref: metricsExportReference(
        fact.line_user_id,
        access.exportSecret,
      ),
      plan_key: planKey,
      purchase_kind: purchaseKind(planKey),
      price_jpy: priceJpy(planKey),
      status: fact.status,
      current_period_end: fact.current_period_end ?? "",
      cancel_at_period_end: fact.cancel_at_period_end === true,
    };
  });

  const last = page.at(-1);
  const nextCursor =
    last?.updated_at && last.id ? { at: last.updated_at, id: last.id } : null;

  return NextResponse.json(
    { columns, rows, nextCursor, hasMore: facts.length > limit },
    { headers: metricsPrivateHeaders },
  );
}
