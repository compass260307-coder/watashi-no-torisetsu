// 社内向け数値画面: サーバー費の実額 (Vercel の料金) の取り込みを、許可リストの人が確かめる入口。
//   GET  : 取るだけで保存しない (日ごと・プロジェクトごとの合計と、応答の形を返す)
//   POST : 取って保存する (1 日 1 回の定期実行と同じ処理を、いま 1 回)
//   どちらも ?days=N (1〜31、既定 10) か、?from=YYYY-MM-DD&to=YYYY-MM-DD (UTC の日、31 日まで)
import { NextResponse, type NextRequest } from "next/server";

import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import {
  SERVER_COST_MAX_DAYS,
  serverCostBackfillWindow,
  syncVercelCosts,
  type ServerCostWindow,
} from "@/lib/server-costs";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

function rangeParam(
  request: NextRequest,
): ServerCostWindow | { error: string } | null {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (from === null && to === null) return null;
  return serverCostBackfillWindow(from ?? "", to ?? from ?? "");
}

function daysParam(request: NextRequest): number {
  const value = Number(request.nextUrl.searchParams.get("days") ?? "10");
  return Number.isInteger(value) && value >= 1 && value <= SERVER_COST_MAX_DAYS
    ? value
    : 10;
}

export async function GET(request: NextRequest) {
  if (!(await isInternalDashboardViewer(await getSession(request)))) {
    return json({ error: "not_found" }, 404);
  }
  const range = rangeParam(request);
  if (range && "error" in range) return json(range, 400);
  return json(
    await syncVercelCosts({
      days: daysParam(request),
      dryRun: true,
      range: range ?? undefined,
    }),
  );
}

export async function POST(request: NextRequest) {
  if (!(await isInternalDashboardViewer(await getSession(request)))) {
    return json({ error: "not_found" }, 404);
  }
  // ほかのサイトから、ログイン中のブラウザを使って書き込ませないための確認。
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) {
    return json({ error: "forbidden" }, 403);
  }
  const range = rangeParam(request);
  if (range && "error" in range) return json(range, 400);
  return json(
    await syncVercelCosts({
      days: daysParam(request),
      range: range ?? undefined,
    }),
  );
}
