// 分析用データ転記エンドポイント。Supabase の events / users から集計に必要な列だけを
// スプレッドシートへ落とす (集計はスプシ側のピボット/関数で行う想定)。
//
// 認証: /api/metrics と同じ Authorization: Bearer <METRICS_KEY>。
// 個人情報: 名前・招待コード・閲覧トークン・任意 metadata は返さない。
//           集計に必要なIDは復元できない安定した参照IDへ置換する。
// パラメータ:
//   ?table=events | users | friend_perceptions   (既定 events)
//   ?days=<1..365>          直近何日分か (既定 90)。created_at で絞る
//   ?format=csv             CSV (既定 JSON)
//
// 集計しやすいよう date_jst (日本時間 YYYY-MM-DD) の列を1つだけ足している。
// それ以外のデータは返さない。

import {
  authorizeMetricsRequest,
  metricsExportReference,
  metricsPrivateHeaders,
} from "@/lib/metrics-access";
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

// metadata からは分析に必要な単純値だけを、短い文字列として取り出す。
// 配列・オブジェクト・長文など、意図しない個人情報をスプシへ運ばない。
function analyticsValue(value: unknown): string | number | boolean {
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 100);
  return "";
}

// Supabase は1回のselectで既定1000行までなので、range でページングして全件取る。
// 暴走防止に上限 (MAX_ROWS) を設ける。超えたら古い行が切れる (days を絞って対応)。
const PAGE = 1000;
const MAX_ROWS = 50000;

// 各ユーザーの友達評価人数 (= friend_perceptions の件数) を集計する。
// 「友達診断が完了した (3人いけた) 人」= friend_count >= 3 で絞れるように users_raw に載せる。
// 期間フィルタなし (ユーザーの累計評価数)。
async function friendCountByUser(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("friend_perceptions")
      .select("target_user_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as { target_user_id: string | null }[]) {
      const t = r.target_user_id;
      if (t) map.set(t, (map.get(t) ?? 0) + 1);
    }
    if (data.length < PAGE) break;
  }
  return map;
}

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
  const access = authorizeMetricsRequest(request);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: metricsPrivateHeaders },
    );
  }

  const tableParam = request.nextUrl.searchParams.get("table");
  const table =
    tableParam === "users"
      ? "users"
      : tableParam === "friend_perceptions"
        ? "friend_perceptions"
        : "events";
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
    // metadata は安全な分析項目だけ個別列に展開し、元の JSON は返さない。
    columnOrder = [
      "created_at",
      "date_jst",
      "event_name",
      "session_ref",
      "meta_type_id",
      "meta_source",
      "meta_channel",
      "meta_kind",
      "meta_friend_count",
      "meta_question_id",
    ];
    const raw = await fetchAll(
      "events",
      "created_at, event_name, session_id, metadata",
      sinceIso,
    );
    rows = raw.map((r) => {
      const m = (r.metadata ?? {}) as Record<string, unknown>;
      return {
        created_at: r.created_at,
        date_jst: jstDate(r.created_at as string),
        event_name: r.event_name ?? "",
        session_ref: metricsExportReference(
          r.session_id,
          access.exportSecret,
        ),
        // 自己タイプ(typeId) と 友達が見たタイプ(perceivedTypeId) を1列に集約
        meta_type_id: analyticsValue(m.typeId ?? m.perceivedTypeId),
        meta_source: analyticsValue(m.source),
        meta_channel: analyticsValue(m.channel),
        meta_kind: analyticsValue(m.kind),
        meta_friend_count: analyticsValue(m.friendCount),
        meta_question_id: analyticsValue(m.questionId),
      };
    });
  } else if (table === "users") {
    // 流入元は新フィールド acquisition_* を主に出す (旧 campaign は空になりがち)。
    // acq_campaign は新フィールド優先、無ければ旧 campaign にフォールバックして一本化する。
    columnOrder = [
      "created_at",
      "date_jst",
      "user_ref",
      // D列は旧 display_name の代わりに非個人情報の plan を置き、
      // type_name(E) / friend_count(F) / acq_source(G) の既存列位置を保つ。
      "plan",
      "type_name",
      "friend_count",
      "acq_source",
      "acq_campaign",
      "generation",
      "source_user_ref",
    ];
    const [raw, friendCounts] = await Promise.all([
      fetchAll(
        "users",
        "created_at, id, scores, acquisition_source, acquisition_campaign, campaign, generation, source_user_id, plan",
        sinceIso,
      ),
      friendCountByUser(),
    ]);
    rows = raw.map((r) => ({
      created_at: r.created_at,
      date_jst: jstDate(r.created_at as string),
      user_ref: metricsExportReference(r.id, access.exportSecret),
      plan: r.plan ?? "",
      type_name: typeNameFromScores(r.scores),
      // 友達に評価された人数。3 以上 = 友達診断が完成した人。
      friend_count: friendCounts.get(r.id as string) ?? 0,
      acq_source: r.acquisition_source ?? "",
      // 新フィールド優先・無ければ旧 campaign にフォールバック (流入元を1列に統合)
      acq_campaign: r.acquisition_campaign ?? r.campaign ?? "",
      generation: r.generation ?? "",
      source_user_ref: metricsExportReference(
        r.source_user_id,
        access.exportSecret,
      ),
    }));
  } else {
    // friend_perceptions = 友達診断(他己評価)の結果。名前は出力しない。
    // 称号は perceived_scores ({E,A,O,C,N}) から users と同じ算出でサイト表示に一致させる。
    columnOrder = [
      "created_at",
      "date_jst",
      "target_user_ref",
      "perceived_type_name",
    ];
    const raw = await fetchAll(
      "friend_perceptions",
      "created_at, target_user_id, perceived_scores",
      sinceIso,
    );
    rows = raw.map((r) => ({
      created_at: r.created_at,
      date_jst: jstDate(r.created_at as string),
      // users_raw の user_ref と同じ変換なので、匿名のまま突合できる。
      target_user_ref: metricsExportReference(
        r.target_user_id,
        access.exportSecret,
      ),
      perceived_type_name: typeNameFromScores(r.perceived_scores),
    }));
  }

  if (request.nextUrl.searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      columnOrder.join(","),
      ...rows.map((row) => columnOrder.map((c) => esc(row[c])).join(",")),
    ];
    return new NextResponse("﻿" + lines.join("\n"), {
      headers: {
        ...metricsPrivateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  return NextResponse.json(
    { columns: columnOrder, rows },
    { headers: metricsPrivateHeaders },
  );
}
