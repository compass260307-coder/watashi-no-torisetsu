// 社内向け数値画面のデータ。画面を開いたときと「更新」を押したときにだけ呼ばれ、
// DB の中で数えた結果を 1 回の往復で受け取る (関数は米国、DB は東京にあるため、
// 往復の回数がそのまま待ち時間になる)。
import { NextResponse, type NextRequest } from "next/server";

import { isValidNumbersDay, type NumbersPayload } from "@/lib/internal-numbers";
import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 30;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export async function GET(request: NextRequest) {
  const user = await getSession(request);
  if (!(await isInternalDashboardViewer(user))) {
    // ページの存在を知らせないため、未ログインと権限なしを区別しない。
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: PRIVATE_HEADERS },
    );
  }

  const dayParam = request.nextUrl.searchParams.get("day");
  const compareParam = request.nextUrl.searchParams.get("compare");
  if (
    (dayParam !== null && !isValidNumbersDay(dayParam)) ||
    (compareParam !== null && !isValidNumbersDay(compareParam))
  ) {
    return NextResponse.json(
      { error: "invalid_day" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const { data, error } = await supabaseAdmin.rpc("internal_numbers_dashboard", {
    p_day: dayParam,
    p_compare_day: compareParam,
    p_locale: "ja",
  });

  if (error || !data) {
    console.error("[internal-numbers] dashboard query failed", {
      code: error?.code,
      message: error?.message,
    });
    return NextResponse.json(
      { error: "numbers_unavailable" },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }

  return NextResponse.json(data as NumbersPayload, { headers: PRIVATE_HEADERS });
}
