// 社内向け数値画面のデータ。画面を開いたときと「更新」を押したときにだけ呼ばれ、
// DB の中で数えた結果を 1 回の往復で受け取る (関数は米国、DB は東京にあるため、
// 往復の回数がそのまま待ち時間になる)。
import { NextResponse, type NextRequest } from "next/server";

import {
  isValidNumbersDay,
  todayInJst,
  type NumbersPayload,
} from "@/lib/internal-numbers";
import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 30;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

/**
 * 広告費つきの関数 (第3段の SQL) を呼ぶ。まだ DB に入っていない環境では、広告費なしの
 * 関数で代える (SQL より先に画面が出ても、広告費の欄が出ないだけで動く)。
 */
async function callWithCosts(name: string, args: Record<string, unknown>) {
  const withCosts = await supabaseAdmin.rpc(`${name}_with_costs`, args);
  // PGRST202: その名前・引数の関数が見つからない。
  if (withCosts.error?.code !== "PGRST202") return withCosts;
  return supabaseAdmin.rpc(name, args);
}

export async function GET(request: NextRequest) {
  const user = await getSession(request);
  if (!(await isInternalDashboardViewer(user))) {
    // ページの存在を知らせないため、未ログインと権限なしを区別しない。
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: PRIVATE_HEADERS },
    );
  }

  // fill=YYYY-MM-DD: 月の推移が、まだ控えの無い終わった日を 1 日分だけ数えさせる。
  // イベント (ファネル) の集計は通さない。月の推移では使わないうえ、イベントの多い
  // 古い日は 1 時間分を読むだけで制限時間を超え、block= では数え終わらなかった
  // (2026-11-23 本番で、11/18 以前の日がすべて時間切れ)。控えのイベントは読むたびに
  // 集計表から付け直すので、ここで通さなくても控えは古くならない。
  const fillParam = request.nextUrl.searchParams.get("fill");
  if (fillParam !== null) {
    if (!isValidNumbersDay(fillParam) || fillParam >= todayInJst()) {
      return NextResponse.json(
        { error: "invalid_day" },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }
    const dayEnd = new Date(
      new Date(`${fillParam}T00:00:00+09:00`).getTime() + 86400e3,
    );
    const { data, error } = await supabaseAdmin.rpc("internal_numbers_block", {
      p_day: fillParam,
      p_cut: dayEnd.toISOString(),
      p_now: new Date().toISOString(),
      p_locale: "ja",
      p_today: todayInJst(),
      p_deadline: null,
    });
    if (error || !data) {
      console.error("[internal-numbers] fill day query failed", {
        code: error?.code,
        message: error?.message,
      });
      return NextResponse.json(
        { error: "numbers_unavailable" },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
    return NextResponse.json({ block: data }, { headers: PRIVATE_HEADERS });
  }

  // block=YYYY-MM-DD: 比べる相手として選んだ、終わった日の 1 日分だけを返す。
  const blockParam = request.nextUrl.searchParams.get("block");
  if (blockParam !== null) {
    if (!isValidNumbersDay(blockParam) || blockParam >= todayInJst()) {
      return NextResponse.json(
        { error: "invalid_day" },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }
    const { data, error } = await callWithCosts(
      "internal_numbers_compare_day",
      { p_day: blockParam, p_locale: "ja" },
    );
    if (error || !data) {
      console.error("[internal-numbers] compare day query failed", {
        code: error?.code,
        message: error?.message,
      });
      return NextResponse.json(
        { error: "numbers_unavailable" },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
    return NextResponse.json(data, { headers: PRIVATE_HEADERS });
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

  const { data, error } = await callWithCosts("internal_numbers_dashboard", {
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

  return NextResponse.json(data as NumbersPayload, {
    headers: PRIVATE_HEADERS,
  });
}
