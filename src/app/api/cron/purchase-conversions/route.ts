import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { processDueServerPurchaseConversions } from "@/lib/server-purchase-conversions";

export const runtime = "nodejs";
export const maxDuration = 150;
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
  const authorization = request.headers.get("authorization");
  if (!cronSecret || !hasValidCronAuthorization(authorization, cronSecret)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await processDueServerPurchaseConversions(25);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[cron/purchase-conversions] worker failed", error);
    return NextResponse.json(
      { error: "Worker failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
