import { computeStats } from "@/lib/admin-stats";
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

  // 管理画面の「更新」は現在のDB状態を確認する操作なので、24時間キャッシュを
  // 共有する /api/metrics とは分けて毎回再集計する。
  const stats = await computeStats(from, to);
  return NextResponse.json(stats);
}
