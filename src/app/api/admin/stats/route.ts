import { timingSafeEqual } from "node:crypto";
import { getCachedStats } from "@/lib/metrics-stats-cache";
import { NextRequest, NextResponse } from "next/server";

// 全期間の集計は成長中の events を読むため、DB負荷を制限したうえで実行時間を確保する。
export const maxDuration = 300;

const noStoreHeaders = { "Cache-Control": "private, no-store" } as const;

function hasValidAdminKey(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function isValidRange(from: string | null, to: string | null): boolean {
  if (from && !Number.isFinite(Date.parse(from))) return false;
  if (to && !Number.isFinite(Date.parse(to))) return false;
  return !from || !to || Date.parse(from) <= Date.parse(to);
}

export async function GET(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || !hasValidAdminKey(key, adminKey)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!isValidRange(from, to)) {
    return NextResponse.json(
      { error: "Invalid range" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const localeParam = request.nextUrl.searchParams.get("locale");
  if (localeParam && localeParam !== "ja" && localeParam !== "ko") {
    return NextResponse.json(
      { error: "Invalid locale" },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const locale = localeParam === "ja" || localeParam === "ko"
    ? localeParam
    : undefined;
  // fresh=1 は管理画面の「更新」ボタン。キャッシュを飛ばして最新を再計算する。
  const forceFresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    const stats = await getCachedStats(from, to, { forceFresh, locale });
    return NextResponse.json(stats, { headers: noStoreHeaders });
  } catch (error) {
    console.error("[api/admin/stats] aggregation failed", error);
    return NextResponse.json(
      { error: "Aggregation failed" },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
