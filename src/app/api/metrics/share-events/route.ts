// Google Sheets 向けのシェア・友達招待ファネル差分エンドポイント。
// 高頻度な回答イベントは除外し、シェア率の計算に必要な種類だけを返す。
// 生のトークンやコードはHMAC参照IDに変換する。
//
// GET /api/metrics/share-events?after=<ISO>&after_id=<UUID>&limit=<1..999>

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

const SHARE_EVENT_NAMES = [
  "diagnosis_completed",
  "share_ui_shown",
  "share_clicked",
  "share_landing_viewed",
  "share_to_diagnosis_clicked",
  "friend_invite_clicked",
  "friend_landing_viewed",
  "friend_answer_started",
  "friend_answer_completed",
  "friend_to_diagnosis_clicked",
] as const;

const columns = [
  "created_at",
  "date_jst",
  "hour_jst",
  "event_ref",
  "event_name",
  "session_ref",
  "owner_ref",
  "invite_ref",
  "locale",
  "kind",
  "source",
  "channel",
  "type_id",
  "funnel_version",
] as const;

type ShareEventFact = {
  id: string;
  event_name: string;
  session_id: string | null;
  owner_token: string | null;
  invite_code: string | null;
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
  const timestamp = Date.parse(trimmed);
  // Date#toISOString() は PostgreSQL が返すマイクロ秒をミリ秒に丸めるため、
  // 検証後も元の値を使ってカーソルの取りこぼし・再取得を防ぐ。
  return Number.isFinite(timestamp) ? trimmed : null;
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
  const baseQuery = () =>
    supabaseAdmin
      .from("events")
      .select(
        "id, event_name, session_id, owner_token, invite_code, locale, metadata, created_at",
      )
      .in("event_name", [...SHARE_EVENT_NAMES]);

  let facts: ShareEventFact[] = [];
  let queryError: { code?: string; message?: string } | null = null;

  if (afterId) {
    // PostgREST の OR キーセットは、events が多いとソート前の走査で
    // statement_timeout になる。同一時刻のタイブレークと、それより後を
    // 別クエリにして、(created_at, id) 順を保ったまま高速に取得する。
    const tieResult = await baseQuery()
      .eq("created_at", after)
      .gt("id", afterId)
      .order("id", { ascending: true })
      .limit(limit + 1);

    queryError = tieResult.error;
    facts = (tieResult.data ?? []) as ShareEventFact[];

    if (!queryError && facts.length <= limit) {
      const laterResult = await baseQuery()
        .gt("created_at", after)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit + 1 - facts.length);
      queryError = laterResult.error;
      facts.push(...((laterResult.data ?? []) as ShareEventFact[]));
    }
  } else {
    const result = await baseQuery()
      .gt("created_at", after)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit + 1);
    queryError = result.error;
    facts = (result.data ?? []) as ShareEventFact[];
  }

  if (queryError) {
    console.error("[metrics-share-events] incremental query failed", {
      code: queryError.code,
      message: queryError.message,
    });
    return NextResponse.json(
      { error: "Unable to fetch share metrics" },
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
      session_ref: metricsExportReference(fact.session_id, access.exportSecret),
      owner_ref: metricsExportReference(fact.owner_token, access.exportSecret),
      invite_ref: metricsExportReference(fact.invite_code, access.exportSecret),
      locale: fact.locale ?? metadataText(fact.metadata, "locale"),
      kind: metadataText(fact.metadata, "kind"),
      source: metadataText(fact.metadata, "source"),
      channel: metadataText(fact.metadata, "channel"),
      type_id:
        metadataText(fact.metadata, "typeId") ||
        metadataText(fact.metadata, "perceivedTypeId"),
      funnel_version: metadataText(fact.metadata, "funnelVersion"),
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
