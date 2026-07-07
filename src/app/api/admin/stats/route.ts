import { computeStats } from "@/lib/admin-stats";
import { NextRequest, NextResponse } from "next/server";

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
