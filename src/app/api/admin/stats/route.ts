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
  // fresh=1 は管理画面の「更新」ボタン。キャッシュを飛ばして最新を再計算する。
  const forceFresh = request.nextUrl.searchParams.get("fresh") === "1";

  const stats = await getCachedStats(from, to, { forceFresh });
  return NextResponse.json(stats);
}
