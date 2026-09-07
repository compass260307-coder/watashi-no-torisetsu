// Google Sheets 向けの確定診断差分エンドポイント。
//
// 大量の events や全 users を再集計せず、差分同期に必要な行だけを返す。
// users.diagnosis_completed_at の複合カーソル以降だけを返すため、
// 15分間隔で呼んでもDB読み取り量は新規診断件数に比例する。
//
// GET /api/metrics/diagnoses?after=<ISO>&after_id=<UUID>&limit=<1..999>
// Authorization: Bearer <SHEETS_METRICS_KEY> (既存 METRICS_KEY も互換用に可)

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
  "completed_at",
  "date_jst",
  "hour_jst",
  "diagnosis_ref",
  "type_id",
  "locale",
  "acq_source",
  "acq_campaign",
] as const;

type DiagnosisFact = {
  id: string;
  diagnosis_completed_at: string | null;
  type_id: string | null;
  acquisition_locale: string | null;
  acquisition_source: string | null;
  acquisition_campaign: string | null;
  campaign: string | null;
};

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function parseCursorTimestamp(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Date#toISOString() は PostgreSQL が返すマイクロ秒をミリ秒に丸めるため、
  // 検証後も元の値を使って複合カーソルの境界を正確に保つ。
  return Number.isFinite(Date.parse(trimmed)) ? trimmed : null;
}

function jstParts(iso: string): { date: string; hour: number } {
  const shifted = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
  };
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
    .from("users")
    .select(
      "id, diagnosis_completed_at, type_id, acquisition_locale, acquisition_source, acquisition_campaign, campaign",
    )
    .not("diagnosis_completed_at", "is", null)
    .order("diagnosis_completed_at", { ascending: true })
    .order("id", { ascending: true })
    // 1行余分に取得し、次ページの有無だけを判定する。
    .limit(limit + 1);

  if (afterId) {
    // 完了時刻が同じ行があっても取りこぼさないseek pagination。
    // after / afterId は上で正規化・検証済みなので PostgREST 式へ安全に挿入できる。
    query = query.or(
      `diagnosis_completed_at.gt.${after},and(diagnosis_completed_at.eq.${after},id.gt.${afterId})`,
    );
  } else {
    query = query.gt("diagnosis_completed_at", after);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[metrics-diagnoses] incremental query failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Unable to fetch diagnosis metrics" },
      { status: 500, headers: metricsPrivateHeaders },
    );
  }

  const facts = (data ?? []) as DiagnosisFact[];
  const page = facts.slice(0, limit);
  const rows = page.flatMap((fact) => {
    const completedAt = fact.diagnosis_completed_at;
    if (!completedAt) return [];
    const jst = jstParts(completedAt);
    return [
      {
        completed_at: completedAt,
        date_jst: jst.date,
        hour_jst: jst.hour,
        diagnosis_ref: metricsExportReference(fact.id, access.exportSecret),
        type_id: fact.type_id ?? "",
        locale: fact.acquisition_locale ?? "",
        acq_source: fact.acquisition_source ?? "",
        acq_campaign: fact.acquisition_campaign ?? fact.campaign ?? "",
      },
    ];
  });

  const last = page.at(-1);
  const nextCursor =
    last?.diagnosis_completed_at && last.id
      ? { at: last.diagnosis_completed_at, id: last.id }
      : null;

  return NextResponse.json(
    {
      columns,
      rows,
      nextCursor,
      hasMore: facts.length > limit,
    },
    { headers: metricsPrivateHeaders },
  );
}
