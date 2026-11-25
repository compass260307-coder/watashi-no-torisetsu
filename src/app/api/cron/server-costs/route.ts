// Vercel の料金 (サーバー費の実額) を、直近 10 日分取り直して保存する (Vercel Cron、1 日 1 回)。
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { syncVercelCosts } from "@/lib/server-costs";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

function hasValidCronAuthorization(
  authorization: string | null,
  cronSecret: string,
): boolean {
  if (!authorization) return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    !hasValidCronAuthorization(request.headers.get("authorization"), cronSecret)
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const report = await syncVercelCosts({ days: 10 });
  if (report.errors.length > 0) {
    console.error("[cron/server-costs] errors", report.errors);
  }
  // 応答には金額を出さない (ログに残るため)。保存の件数と状態だけ。
  return NextResponse.json(
    {
      ok: report.ok,
      window: report.window,
      saved: report.saved,
      rows: report.total.rows,
      errors: report.errors.length,
    },
    { status: report.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } },
  );
}
