import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { syncHyperAdSpend } from "@/lib/hyper-ad-spend";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization") || "";
  const hash = (s: string) => createHash("sha256").update(s).digest();
  if (!secret || !timingSafeEqual(hash(actual), hash(`Bearer ${secret}`))) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await syncHyperAdSpend();
    return NextResponse.json(result, { status: "failed" in result && result.failed ? 502 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Ad spend sync failed; stored values retained" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
