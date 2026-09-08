// Google Sheets 向けの LINE フォローイベント差分エンドポイント。
// line_follow だけを返し、生の LINE userId は HMAC 参照IDに変換する。
//
// GET /api/metrics/line-follow-events?after=<ISO>&after_id=<UUID>&limit=<1..999>

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
  "created_at",
  "date_jst",
  "hour_jst",
  "event_ref",
  "event_name",
  "line_user_ref",
  "relink",
] as const;

type LineFollowFact = {
  id: string;
  event_name: "line_follow";
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
  return typeof value === "string" ? value : "";
}

function metadataBoolean(
  metadata: Record<string, unknown> | null,
  key: string,
): boolean | "" {
  const value = metadata?.[key];
  return typeof value === "boolean" ? value : "";
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
      .select("id, event_name, metadata, created_at")
      .eq("event_name", "line_follow");

  let facts: LineFollowFact[] = [];
  let queryError: { code?: string; message?: string } | null = null;

  if (afterId) {
    const tieResult = await baseQuery()
      .eq("created_at", after)
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(limit + 1);
    queryError = tieResult.error;
    facts = (tieResult.data ?? []) as LineFollowFact[];

    if (!queryError && facts.length <= limit) {
      const laterResult = await baseQuery()
        .gt("created_at", after)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit + 1 - facts.length);
      queryError = laterResult.error;
      facts.push(...((laterResult.data ?? []) as LineFollowFact[]));
    }
  } else {
    const result = await baseQuery()
      .gt("created_at", after)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit + 1);
    queryError = result.error;
    facts = (result.data ?? []) as LineFollowFact[];
  }

  if (queryError) {
    console.error("[metrics-line-follow-events] incremental query failed", {
      code: queryError.code,
      message: queryError.message,
    });
    return NextResponse.json(
      { error: "Unable to fetch LINE follow metrics" },
      { status: 500, headers: metricsPrivateHeaders },
    );
  }

  const page = facts.slice(0, limit);
  const rows = page.map((fact) => {
    const jst = jstParts(fact.created_at);
    return {
      created_at: fact.created_at,
      date_jst: jst.date,
      hour_jst: jst.hour,
      event_ref: metricsExportReference(fact.id, access.exportSecret),
      event_name: fact.event_name,
      line_user_ref: metricsExportReference(
        metadataText(fact.metadata, "line_user_id"),
        access.exportSecret,
      ),
      relink: metadataBoolean(fact.metadata, "relink"),
    };
  });

  const last = page.at(-1);
  const nextCursor =
    last?.created_at && last.id ? { at: last.created_at, id: last.id } : null;

  return NextResponse.json(
    { columns, rows, nextCursor, hasMore: facts.length > limit },
    { headers: metricsPrivateHeaders },
  );
}
