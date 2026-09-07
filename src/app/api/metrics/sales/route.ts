// Google Sheets 向けの決済差分エンドポイント。
//
// 返金で既存決済が更新されるため、updated_at + id をカーソルにする。
// Stripe ID や個人情報は出さず、シート上で結合できる参照IDだけを返す。
//
// GET /api/metrics/sales?after=<ISO>&after_id=<UUID>&limit=<1..999>

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

const columns = [
  "updated_at",
  "paid_at",
  "date_jst",
  "hour_jst",
  "payment_ref",
  "user_ref",
  "product",
  "payment_kind",
  "currency",
  "gross_jpy",
  "refunded_jpy",
  "net_jpy",
  "status",
  "refunded_at",
  "source",
  "paywall_version",
  "placement",
  "return_to",
  "locale",
  "upgrade_from",
] as const;

type PaymentFact = {
  id: string;
  user_id: string;
  stripe_session_id: string;
  amount_jpy: number;
  amount_refunded_minor: number | null;
  currency: string | null;
  status: string;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  payment_kind: string | null;
  metadata: Record<string, unknown> | null;
};

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function parseCursorTimestamp(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // updated_at のマイクロ秒を丸めると同一境界を再取得し得るため、
  // 日付として検証した後もDBから返したカーソル文字列をそのまま使う。
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
  return typeof value === "string" ? value : "";
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
    .from("payment_history")
    .select(
      "id, user_id, stripe_session_id, amount_jpy, amount_refunded_minor, currency, status, paid_at, refunded_at, created_at, updated_at, payment_kind, metadata",
    )
    .in("status", ["completed", "refunded"])
    .not("stripe_session_id", "like", "cs_test_%")
    .not("updated_at", "is", null)
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
    console.error("[metrics-sales] incremental query failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to fetch sales metrics" },
      { status: 500, headers: metricsPrivateHeaders },
    );
  }

  const facts = (data ?? []) as PaymentFact[];
  const page = facts.slice(0, limit);
  const rows = page.flatMap((fact) => {
    const updatedAt = fact.updated_at;
    if (!updatedAt) return [];
    const paidAt = fact.paid_at ?? fact.created_at ?? updatedAt;
    const jst = jstParts(paidAt);
    const grossJpy = Number.isFinite(fact.amount_jpy) ? fact.amount_jpy : 0;
    const refundedJpy = Number.isFinite(fact.amount_refunded_minor)
      ? Math.max(fact.amount_refunded_minor ?? 0, 0)
      : 0;
    return [
      {
        updated_at: updatedAt,
        paid_at: paidAt,
        date_jst: jst.date,
        hour_jst: jst.hour,
        payment_ref: metricsExportReference(fact.id, access.exportSecret),
        user_ref: metricsExportReference(fact.user_id, access.exportSecret),
        product:
          metadataText(fact.metadata, "product") || fact.payment_kind || "",
        payment_kind: fact.payment_kind ?? "",
        currency: fact.currency ?? "jpy",
        gross_jpy: grossJpy,
        refunded_jpy: refundedJpy,
        net_jpy: Math.max(grossJpy - refundedJpy, 0),
        status: fact.status,
        refunded_at: fact.refunded_at ?? "",
        source: metadataText(fact.metadata, "source"),
        paywall_version: metadataText(fact.metadata, "paywall_version"),
        placement: metadataText(fact.metadata, "placement"),
        return_to: metadataText(fact.metadata, "return_to"),
        locale: metadataText(fact.metadata, "locale"),
        upgrade_from: metadataText(fact.metadata, "upgrade_from"),
      },
    ];
  });

  const last = page.at(-1);
  const nextCursor =
    last?.updated_at && last.id ? { at: last.updated_at, id: last.id } : null;

  return NextResponse.json(
    { columns, rows, nextCursor, hasMore: facts.length > limit },
    { headers: metricsPrivateHeaders },
  );
}
