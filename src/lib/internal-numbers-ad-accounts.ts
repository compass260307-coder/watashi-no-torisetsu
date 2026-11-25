import "server-only";

import type { NumbersAdAccountsDaily } from "./internal-numbers";
import { supabaseAdmin } from "./supabase-server";

// 1 回の読み出しで受け取る行数。API 側の上限がこれより小さいときは、返ってきた行数に合わせる。
const PAGE_SIZE = 1000;

interface HourlyRow {
  day: string;
  hour: number;
  account: string;
  spend_jpy: number | string;
}

/**
 * X の広告費の実績 (時間別) を、アカウント × 日で足す。月の推移の「アカウント別」の表に使う。
 *
 * 配信計画からの推定と、日別の手入力 (アカウントを持たない) は入らない。数値画面と同じく、
 * その言語版のアカウントだけを足す。読めなかったときは null (画面は表の代わりに知らせを出す)。
 */
export async function readAdAccountsDaily(
  from: string,
  to: string,
  locale: string,
): Promise<NumbersAdAccountsDaily | null> {
  const accounts = await supabaseAdmin
    .from("ad_accounts")
    .select("code, name")
    .eq("medium", "x")
    .eq("locale", locale);
  if (accounts.error) {
    console.error("[internal-numbers] ad accounts read failed", {
      code: accounts.error.code,
      message: accounts.error.message,
    });
    return null;
  }
  const names = new Map(accounts.data.map((row) => [row.code, row.name]));
  if (names.size === 0) return { accounts: [], days: [] };

  // 1 か月分は「24 時間 × 日数 × アカウント数」行あり、1 回では受け取りきれない。
  // 最初の 1 回で全体の行数を聞き、残りを同時に読む。並びは主キーの順で固定する。
  const page = (offset: number, size: number, count: boolean) =>
    supabaseAdmin
      .from("ad_spend_hourly")
      .select("day, hour, account, spend_jpy", count ? { count: "exact" } : {})
      .gte("day", from)
      .lte("day", to)
      .in("account", [...names.keys()])
      .order("day")
      .order("hour")
      .order("account")
      .range(offset, offset + size - 1);

  const first = await page(0, PAGE_SIZE, true);
  if (first.error) {
    console.error("[internal-numbers] ad spend read failed", {
      code: first.error.code,
      message: first.error.message,
    });
    return null;
  }
  const rows: HourlyRow[] = [...first.data];
  const total = first.count ?? rows.length;
  const size = rows.length;
  if (size > 0 && size < total) {
    const offsets: number[] = [];
    for (let offset = size; offset < total; offset += size) offsets.push(offset);
    const rest = await Promise.all(
      offsets.map((offset) => page(offset, size, false)),
    );
    for (const result of rest) {
      if (result.error) {
        console.error("[internal-numbers] ad spend read failed", {
          code: result.error.code,
          message: result.error.message,
        });
        return null;
      }
      rows.push(...result.data);
    }
  }

  // 読んでいる途中で取り込みが走ると、同じ時間帯が 2 つのページに入ることがある。
  // 日 × 時間帯 × アカウントで 1 行にしてから足す。
  const cells = new Map<string, HourlyRow>();
  for (const row of rows) cells.set(`${row.day} ${row.hour} ${row.account}`, row);

  const byDay = new Map<string, Record<string, number>>();
  const byAccount = new Map<string, number>();
  for (const row of cells.values()) {
    const spend = Number(row.spend_jpy);
    const day = byDay.get(row.day) ?? {};
    day[row.account] = (day[row.account] ?? 0) + spend;
    byDay.set(row.day, day);
    byAccount.set(row.account, (byAccount.get(row.account) ?? 0) + spend);
  }

  return {
    // 月の合計が大きいアカウントを左に。
    accounts: [...byAccount.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code, sum]) => ({
        code,
        name: names.get(code) ?? code,
        total: sum,
      })),
    days: [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, spend]) => ({
        day,
        total: Object.values(spend).reduce((sum, value) => sum + value, 0),
        spend,
      })),
  };
}
