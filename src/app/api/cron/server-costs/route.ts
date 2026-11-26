// Vercel の料金 (サーバー費の実額) を直近 10 日分、AI費 (利用の記録 × 単価) を直近 3 日分、
// 取り直して保存する (Vercel Cron、1 日 1 回)。
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { syncAiCosts } from "@/lib/ai-costs";
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
  // 片方が失敗しても、もう片方は保存する。
  const [report, ai] = await Promise.all([
    syncVercelCosts({ days: 10 }),
    syncAiCosts({ days: 3 }).catch((cause: unknown) => ({
      ok: false,
      window: null,
      saved: null,
      total: { rows: 0 },
      errors: [
        cause instanceof Error ? cause.message.slice(0, 300) : "unknown",
      ],
    })),
  ]);
  if (report.errors.length > 0) {
    console.error("[cron/server-costs] errors", report.errors);
  }
  if (ai.errors.length > 0) {
    console.error("[cron/server-costs] ai errors", ai.errors);
  }
  // 応答には金額を出さない (ログに残るため)。保存の件数と状態だけ。
  return NextResponse.json(
    {
      ok: report.ok && ai.ok,
      window: report.window,
      saved: report.saved,
      rows: report.total.rows,
      errors: report.errors.length,
      ai: {
        ok: ai.ok,
        window: ai.window,
        saved: ai.saved,
        rows: ai.total.rows,
        errors: ai.errors.length,
      },
    },
    {
      status: report.ok && ai.ok ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
