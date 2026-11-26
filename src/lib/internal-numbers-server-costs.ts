import "server-only";

import type { NumbersServerCostsDaily } from "./internal-numbers";
import { supabaseAdmin } from "./supabase-server";

/** 月の合計に占める割合がこれより小さいプロジェクトは、「そのほか」にまとめる。 */
const MINOR_SHARE = 0.01;
const OTHERS = "そのほか";
/** プロジェクトに割り振られない料金 (プランの定額など) の、画面での名前。 */
const UNATTRIBUTED_LABEL = "プランの定額など";

/**
 * 取り込んで保存してあるサーバー費の実額 (Vercel の請求額、米ドル) を、日 × プロジェクトで返す。
 * 月の推移の「サーバー費」の表に使う。読めなかったときは null (画面は表の代わりに知らせを出す)。
 *
 * 1 か月分は「日数 × プロジェクト数」行で、1 回で受け取れる行数に収まる。
 */
export async function readServerCostsDaily(
  from: string,
  to: string,
): Promise<NumbersServerCostsDaily | null> {
  const { data, error } = await supabaseAdmin
    .from("server_cost_daily")
    .select("day, project, billed_usd")
    .eq("provider", "vercel")
    .gte("day", from)
    .lte("day", to)
    .order("day")
    .order("project")
    .limit(1000);
  if (error) {
    console.error("[internal-numbers] server costs read failed", {
      code: error.code,
      message: error.message,
    });
    return null;
  }

  const totals = new Map<string, number>();
  for (const row of data) {
    totals.set(
      row.project,
      (totals.get(row.project) ?? 0) + Number(row.billed_usd),
    );
  }
  const monthTotal = [...totals.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  // 金額の小さいプロジェクト (同じチームのほかのサイトなど) は、1 列にまとめる。
  const major = new Set(
    [...totals.entries()]
      .filter(
        ([, total]) => monthTotal > 0 && total / monthTotal >= MINOR_SHARE,
      )
      .map(([project]) => project),
  );
  const columnOf = (project: string) => (major.has(project) ? project : OTHERS);

  const columnTotals = new Map<string, number>();
  const byDay = new Map<string, Record<string, number>>();
  for (const row of data) {
    const column = columnOf(row.project);
    const amount = Number(row.billed_usd);
    columnTotals.set(column, (columnTotals.get(column) ?? 0) + amount);
    const day = byDay.get(row.day) ?? {};
    day[column] = (day[column] ?? 0) + amount;
    byDay.set(row.day, day);
  }

  return {
    currency: "USD",
    // 月の合計が大きい順。「そのほか」は最後。
    projects: [...columnTotals.entries()]
      .sort(
        (a, b) =>
          Number(a[0] === OTHERS) - Number(b[0] === OTHERS) ||
          b[1] - a[1] ||
          a[0].localeCompare(b[0]),
      )
      .map(([key, total]) => ({
        key,
        name: key === "(unattributed)" ? UNATTRIBUTED_LABEL : key,
        total,
      })),
    days: [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, cost]) => ({
        day,
        total: Object.values(cost).reduce((sum, value) => sum + value, 0),
        cost,
      })),
  };
}
