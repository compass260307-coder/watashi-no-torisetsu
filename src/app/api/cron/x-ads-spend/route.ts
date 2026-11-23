// X Ads API から直近 3 日の時間別の広告費を取り直して保存する (Vercel Cron、毎時)。
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { syncXAdsSpend } from "@/lib/x-ads-spend";

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
  const report = await syncXAdsSpend({ days: 3 });
  if (report.errors.length > 0) {
    console.error("[cron/x-ads-spend] errors", report.errors);
  }
  // 応答には金額を出さない (ログに残るため)。保存の件数と状態だけ。
  return NextResponse.json(
    {
      ok: report.ok,
      saved: report.saved,
      skipped: report.accounts
        .filter((a) => a.skipped)
        .map((a) => ({ id: a.id, code: a.code, reason: a.skipped })),
      errors: report.errors.length,
    },
    { status: report.ok ? 200 : 500, headers: { "Cache-Control": "no-store" } },
  );
}
