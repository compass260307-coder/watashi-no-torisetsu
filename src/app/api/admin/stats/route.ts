import { computeStats } from "@/lib/admin-stats";
import { NextRequest, NextResponse } from "next/server";

// 集計は events 全件のページング + 質問別 count 50本を投げるため時間がかかる。
// 既定タイムアウトで切られて全ゼロ/エラーにならないよう余裕を持たせる。
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const stats = await computeStats(from, to);
  return NextResponse.json(stats);
}
