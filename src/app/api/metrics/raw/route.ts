// 生データ転記用エンドポイント。Supabase の events / users の行をそのままスプレッドシートへ
// 落とすために使う (集計はスプシ側のピボット/関数で行う想定)。
//
// 認証: /api/metrics と同じ ?key=<METRICS_KEY>。Supabase の service key はサーバに留め、
//        スプシには置かない。
// パラメータ:
//   ?table=events | users   (既定 events)
//   ?days=<1..365>          直近何日分か (既定 90)。created_at で絞る
//   ?format=csv             CSV (既定 JSON)
//
// 集計しやすいよう date_jst (日本時間 YYYY-MM-DD) の列を1つだけ足している。
// それ以外は Supabase の行をそのまま (metadata は JSON 文字列化)。

import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
function jstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

// Supabase は1回のselectで既定1000行までなので、range でページングして全件取る。
// 暴走防止に上限 (MAX_ROWS) を設ける。超えたら古い行が切れる (days を絞って対応)。
const PAGE = 1000;
const MAX_ROWS = 50000;

async function fetchAll(
  table: string,
  columns: string,
  sinceIso: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const metricsKey = process.env.METRICS_KEY;
  if (!metricsKey) {
    return NextResponse.json(
      { error: "METRICS_KEY is not configured" },
      { status: 500 },
    );
  }
  if (request.nextUrl.searchParams.get("key") !== metricsKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const table =
    request.nextUrl.searchParams.get("table") === "users" ? "users" : "events";
  const daysRaw = parseInt(
    request.nextUrl.searchParams.get("days") ?? "90",
    10,
  );
  const days = Math.min(Math.max(Number.isFinite(daysRaw) ? daysRaw : 90, 1), 365);
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  // テーブルごとに列順を固定 (スプシのヘッダー順を安定させる)。
  let columnOrder: string[];
  let rows: Record<string, unknown>[];

  if (table === "events") {
    columnOrder = [
      "created_at",
      "date_jst",
      "event_name",
      "session_id",
      "invite_code",
      "owner_token",
      "metadata",
    ];
    const raw = await fetchAll(
      "events",
      "created_at, event_name, session_id, invite_code, owner_token, metadata",
      sinceIso,
    );
    rows = raw.map((r) => ({
      created_at: r.created_at,
      date_jst: jstDate(r.created_at as string),
      event_name: r.event_name ?? "",
      session_id: r.session_id ?? "",
      invite_code: r.invite_code ?? "",
      owner_token: r.owner_token ?? "",
      metadata: r.metadata ? JSON.stringify(r.metadata) : "",
    }));
  } else {
    columnOrder = [
      "created_at",
      "date_jst",
      "id",
      "type_id",
      "campaign",
      "generation",
      "invite_code",
      "source_user_id",
    ];
    const raw = await fetchAll(
      "users",
      "created_at, id, type_id, campaign, generation, invite_code, source_user_id",
      sinceIso,
    );
    rows = raw.map((r) => ({
      created_at: r.created_at,
      date_jst: jstDate(r.created_at as string),
      id: r.id ?? "",
      type_id: r.type_id ?? "",
      campaign: r.campaign ?? "",
      generation: r.generation ?? "",
      invite_code: r.invite_code ?? "",
      source_user_id: r.source_user_id ?? "",
    }));
  }

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      columnOrder.join(","),
      ...rows.map((row) => columnOrder.map((c) => esc(row[c])).join(",")),
    ];
    return new NextResponse("﻿" + lines.join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  return NextResponse.json({ columns: columnOrder, rows });
}
