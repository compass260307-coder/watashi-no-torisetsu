import { NextResponse } from "next/server";
import { getLineResultUpgradeSession } from "@/lib/line-result-upgrade";
export async function GET() {
  const session = await getLineResultUpgradeSession();
  return NextResponse.json({ ownerToken: session?.owner_token ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
