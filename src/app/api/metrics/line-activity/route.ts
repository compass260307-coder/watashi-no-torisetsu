// Google Sheets 向けの LINE アクティブ日別集計エンドポイント。
//
// Aliceへのトーク送信（line_chat_messages の role='user'）を JST 日別に集計し、
// その日にメッセージを送った人数と送信数だけを返す。本文・個人を特定する値は出さない。
// 生イベントをシートに溜めるとセル上限に当たるため、日別集計だけを返す。
//
// GET /api/metrics/line-activity?from=YYYY-MM-DD&to=YYYY-MM-DD （最大62日）

import {
  authorizeSheetsMetricsRequest,
  metricsPrivateHeaders,
} from "@/lib/metrics-access";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;
const MAX_DAYS = 62;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const columns = ["date_jst", "active_users", "messages"] as const;

type MessageFact = { id: string; line_user_id: string; created_at: string };

function parseJstDate(value: string | null): number | null {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const utcMidnight = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(utcMidnight) ? utcMidnight - JST_OFFSET_MS : null;
}

function jstDate(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export async function GET(request: NextRequest) {
  const access = authorizeSheetsMetricsRequest(request);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status, headers: metricsPrivateHeaders },
    );
  }

  const from = parseJstDate(request.nextUrl.searchParams.get("from"));
  const to = parseJstDate(request.nextUrl.searchParams.get("to"));
  if (from === null || to === null || to < from) {
    return NextResponse.json(
      { error: "from/to must be YYYY-MM-DD and from <= to" },
      { status: 400, headers: metricsPrivateHeaders },
    );
  }
  if ((to - from) / DAY_MS + 1 > MAX_DAYS) {
    return NextResponse.json(
      { error: `range must be ${MAX_DAYS} days or less` },
      { status: 400, headers: metricsPrivateHeaders },
    );
  }

  const startIso = new Date(from).toISOString();
  const endIso = new Date(to + DAY_MS).toISOString();
  const users = new Map<string, Set<string>>();
  const messages = new Map<string, number>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabaseAdmin
      .from("line_chat_messages")
      .select("id, line_user_id, created_at")
      .eq("role", "user")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (error) {
      console.error("[metrics-line-activity] query failed", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Unable to fetch LINE activity metrics" },
        { status: 500, headers: metricsPrivateHeaders },
      );
    }

    const facts = (data ?? []) as MessageFact[];
    for (const fact of facts) {
      const day = jstDate(fact.created_at);
      if (!users.has(day)) users.set(day, new Set());
      users.get(day)!.add(fact.line_user_id);
      messages.set(day, (messages.get(day) ?? 0) + 1);
    }

    if (facts.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) {
      return NextResponse.json(
        { error: "range too large; narrow from/to" },
        { status: 413, headers: metricsPrivateHeaders },
      );
    }
  }

  const rows: { date_jst: string; active_users: number; messages: number }[] =
    [];
  for (let day = from; day <= to; day += DAY_MS) {
    const date = jstDate(new Date(day).toISOString());
    rows.push({
      date_jst: date,
      active_users: users.get(date)?.size ?? 0,
      messages: messages.get(date) ?? 0,
    });
  }

  return NextResponse.json({ columns, rows }, { headers: metricsPrivateHeaders });
}
