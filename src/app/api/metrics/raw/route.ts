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
import { classifySixteenType, sixteenTypes } from "@/lib/sixteen-types";
import { classifyThirtyTwoType, thirtyTwoEssence } from "@/lib/thirty-two-types";
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import { NextRequest, NextResponse } from "next/server";

// scores からサイト表示の「性格タイプ」= essence (称号。例 采配者 / 将軍 / 寄添者) を算出。
// /me ヒーローが「あなたの性格タイプ:」として大きく見せている値。キャラ名(どっしりクマ等)
// ではなくこの称号が識別名。サイトと同じフラグ分岐 (32有効→32称号 / 無効→16称号) で一致させる。
function typeNameFromScores(scores: unknown): string {
  try {
    const s = (scores ?? {}) as Record<string, number>;
    if (isThirtyTwoEnabled()) {
      return thirtyTwoEssence(classifyThirtyTwoType(s)) ?? "";
    }
    return sixteenTypes[classifySixteenType(s)]?.essence ?? "";
  } catch {
    return "";
  }
}

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
    // metadata (JSON) は event_name ごとにキーが違うので、よく使うキーを個別列に展開して
    // ピボットしやすくする。元の JSON も metadata 列に残す。
    columnOrder = [
      "created_at",
      "date_jst",
      "event_name",
      "session_id",
      "invite_code",
      "owner_token",
      "meta_type_id",
      "meta_source",
      "meta_channel",
      "meta_kind",
      "meta_friend_count",
      "meta_question_id",
      "metadata",
    ];
    const raw = await fetchAll(
      "events",
      "created_at, event_name, session_id, invite_code, owner_token, metadata",
      sinceIso,
    );
    rows = raw.map((r) => {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      const s = (v: unknown) => (v === undefined || v === null ? "" : v);
      return {
        created_at: r.created_at,
        date_jst: jstDate(r.created_at as string),
        event_name: r.event_name ?? "",
        session_id: r.session_id ?? "",
        invite_code: r.invite_code ?? "",
        owner_token: r.owner_token ?? "",
        // 自己タイプ(typeId) と 友達が見たタイプ(perceivedTypeId) を1列に集約
        meta_type_id: s(m.typeId ?? m.perceivedTypeId),
        meta_source: s(m.source),
        meta_channel: s(m.channel),
        meta_kind: s(m.kind),
        meta_friend_count: s(m.friendCount),
        meta_question_id: s(m.questionId),
        metadata: r.metadata ? JSON.stringify(r.metadata) : "",
      };
    });
  } else {
    // 流入元は新フィールド acquisition_* を主に出す (旧 campaign は空になりがち)。
    // acq_campaign は新フィールド優先、無ければ旧 campaign にフォールバックして一本化する。
    columnOrder = [
      "created_at",
      "date_jst",
      "id",
      "display_name",
      "type_name",
      "acq_source",
      "acq_campaign",
      "generation",
      "source_user_id",
      "plan",
    ];
    const raw = await fetchAll(
      "users",
      "created_at, id, display_name, scores, acquisition_source, acquisition_campaign, campaign, generation, source_user_id, plan",
      sinceIso,
    );
    rows = raw.map((r) => ({
      created_at: r.created_at,
      date_jst: jstDate(r.created_at as string),
      id: r.id ?? "",
      display_name: r.display_name ?? "",
      type_name: typeNameFromScores(r.scores),
      acq_source: r.acquisition_source ?? "",
      // 新フィールド優先・無ければ旧 campaign にフォールバック (流入元を1列に統合)
      acq_campaign: r.acquisition_campaign ?? r.campaign ?? "",
      generation: r.generation ?? "",
      source_user_id: r.source_user_id ?? "",
      plan: r.plan ?? "",
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
