// Capability-token scoped status. No browser/CDN/shared response cache.
import { NextRequest, NextResponse } from "next/server";
import { EMPTY_FULL_ACCESS_STATUS } from "@/lib/full-access-status";
import { getFullAccessStatusByOwnerToken } from "@/lib/full-access-status-server";

export const runtime = "nodejs";
const noStore = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("owner_token")?.trim();
  if (!token) return NextResponse.json(EMPTY_FULL_ACCESS_STATUS, noStore);
  try {
    return NextResponse.json(await getFullAccessStatusByOwnerToken(token), noStore);
  } catch {
    // DB障害を「未購入」の成功応答にしてクライアントへ保存しない。
    console.error("[full-access-status] lookup failed");
    return NextResponse.json({ error: "Access status temporarily unavailable" }, { ...noStore, status: 503 });
  }
}
