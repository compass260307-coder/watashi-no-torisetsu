// 社内向け数値画面の「日次の推移」。1 か月分の、日ごとの数字を返す。
// 終わった日の控えを読むだけで、ここでは何も数え直さない。許可リストにある人だけが読める。
import { NextResponse, type NextRequest } from "next/server";

import { NUMBERS_EARLIEST_DAY, todayInJst } from "@/lib/internal-numbers";
import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { readAdAccountsDaily } from "@/lib/internal-numbers-ad-accounts";
import { readServerCostsDaily } from "@/lib/internal-numbers-server-costs";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 30;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

/** "2026-11" → その月の最初の日と最後の日。形が違えば null。 */
function monthRange(month: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  if (index < 0 || index > 11) return null;
  const last = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isInternalDashboardViewer(await getSession(request)))) {
    return json({ error: "not_found" }, 404);
  }
  const today = todayInJst();
  const range = monthRange(
    request.nextUrl.searchParams.get("month") ?? today.slice(0, 7),
  );
  if (!range) return json({ error: "invalid", reason: "month" }, 400);
  // 先の日と、集計を始める前の日は返さない。
  const from =
    range.from < NUMBERS_EARLIEST_DAY ? NUMBERS_EARLIEST_DAY : range.from;
  const to = range.to > today ? today : range.to;
  if (to < from) return json({ days: [], settings: null, today });

  // アカウント別の広告費とサーバー費の実額は、日ごとの数字と同時に読む
  // (読めなくても、ほかの数字は出す)。
  const [{ data, error }, adAccounts, serverCosts] = await Promise.all([
    supabaseAdmin.rpc("internal_numbers_daily", {
      p_from: from,
      p_to: to,
      p_locale: "ja",
    }),
    readAdAccountsDaily(from, to, "ja").catch((cause: unknown) => {
      console.error("[internal-numbers] ad accounts failed", {
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return null;
    }),
    readServerCostsDaily(from, to).catch((cause: unknown) => {
      console.error("[internal-numbers] server costs failed", {
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return null;
    }),
  ]);
  if (error) {
    console.error("[internal-numbers] daily failed", {
      code: error.code,
      message: error.message,
    });
    // PGRST202: 関数がまだ入っていない (SQL を流す前)。
    return json(
      {
        error:
          error.code === "PGRST202"
            ? "daily_not_installed"
            : "daily_unavailable",
      },
      503,
    );
  }
  // その月に使ったクーポン (手入力)。表がまだ無い・読めないときは null (画面は入力欄を出さない)。
  const coupons = await supabaseAdmin
    .from("ad_coupons_monthly")
    .select("amount_jpy")
    .eq("month", range.from)
    .eq("locale", "ja");
  if (coupons.error) {
    console.error("[internal-numbers] coupons read failed", {
      code: coupons.error.code,
      message: coupons.error.message,
    });
  }
  const coupon = coupons.error
    ? null
    : {
        amount:
          coupons.data.length > 0
            ? coupons.data.reduce((sum, row) => sum + Number(row.amount_jpy), 0)
            : null,
      };
  return json({
    ...(data as Record<string, unknown>),
    today,
    coupon,
    ad_accounts: adAccounts,
    server_costs: serverCosts,
  });
}
