import { getCachedStats } from "@/lib/metrics-stats-cache";
import { NextRequest, NextResponse } from "next/server";

// 全期間の集計は成長中の events を読むため、DB負荷を制限したうえで実行時間を確保する。
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const stats = await getCachedStats(from, to);
  return NextResponse.json(stats);
}
