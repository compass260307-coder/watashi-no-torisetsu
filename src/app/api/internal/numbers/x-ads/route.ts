// 社内向け数値画面: X Ads API からの広告費の取り込みを、許可リストの人が確かめる入口。
//   GET  : 取るだけで保存しない (アカウントの一覧・記号・通貨・期間の合計を返す)
//   POST : 取って保存する (毎時の定期実行と同じ処理を、いま 1 回)
import { NextResponse, type NextRequest } from "next/server";

import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { getSession } from "@/lib/session";
import { syncXAdsSpend } from "@/lib/x-ads-spend";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

function daysParam(request: NextRequest): number {
  const value = Number(request.nextUrl.searchParams.get("days") ?? "3");
  return Number.isInteger(value) && value >= 1 && value <= 7 ? value : 3;
}

export async function GET(request: NextRequest) {
  if (!(await isInternalDashboardViewer(await getSession(request)))) {
    return json({ error: "not_found" }, 404);
  }
  return json(await syncXAdsSpend({ days: daysParam(request), dryRun: true }));
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
  return json(await syncXAdsSpend({ days: daysParam(request) }));
}
