import "server-only";

import {
  SERVER_COST_USD_JPY,
  type NumbersAiCostsDaily,
  type NumbersServerCostsDaily,
} from "./internal-numbers";
import { supabaseAdmin } from "./supabase-server";

/** Claude Console の費用を保存するときの提供元の名前 (src/lib/ai-costs.ts と同じ)。 */
const AI_CONSOLE_PROVIDER = "anthropic_console";

/** 月の合計に占める割合がこれより小さいプロジェクトは、「そのほか」にまとめる。 */
const MINOR_SHARE = 0.01;
const OTHERS = "そのほか";
/** プロジェクトに割り振られない料金 (プランの定額など) の、画面での名前。 */
const UNATTRIBUTED_LABEL = "プランの定額など";
/**
 * Vercel の 1 日 (課金期間) は日本時間の 17 時に始まる。日本時間の 1 日は、
 * 前の課金期間の後ろ 17 時間と、その日に始まる課金期間の前 7 時間でできている。
 * (夏時間の間は 16 時始まりで 1 時間ずれるが、分け方は変えない。)
 */
const SHARE_FROM_PREVIOUS = 17 / 24;
const SHARE_FROM_SAME = 7 / 24;

/** "2026-11-01" を n 日ずらす。 */
function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * 取り込んで保存してあるサーバー費の実額 (Vercel の請求額) を、日本時間の日 × プロジェクトの
 * 円で返す。月の推移の「日別実績」のサーバー費と、「サーバー費（プロジェクト別）」の表に使う。
 * 読めなかったときは null (画面は表の代わりに知らせを出す)。
 *
 * 請求額は米ドルで、1 日の区切りが日本時間の 17 時なので、決まった為替で円に直し、
 * 時間の比で日本時間の日に分け直す。前後 2 つの課金期間がそろった日だけを返す。
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
    // 月の最初の日には、前の日に始まった課金期間の分も要る。
    .gte("day", shiftDay(from, -1))
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

  // 課金期間の開始日 → プロジェクト → 円。
  const billed = new Map<string, Map<string, number>>();
  for (const row of data) {
    const projects = billed.get(row.day) ?? new Map<string, number>();
    projects.set(
      row.project,
      (projects.get(row.project) ?? 0) +
        Number(row.billed_usd) * SERVER_COST_USD_JPY,
    );
    billed.set(row.day, projects);
  }

  // 日本時間の日 → プロジェクト → 円。前後の課金期間がそろった日だけ。
  const jst = new Map<string, Map<string, number>>();
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    const previous = billed.get(shiftDay(day, -1));
    const same = billed.get(day);
    if (!previous || !same) continue;
    const projects = new Map<string, number>();
    for (const [project, amount] of previous) {
      projects.set(project, amount * SHARE_FROM_PREVIOUS);
    }
    for (const [project, amount] of same) {
      projects.set(
        project,
        (projects.get(project) ?? 0) + amount * SHARE_FROM_SAME,
      );
    }
    jst.set(day, projects);
  }

  const totals = new Map<string, number>();
  for (const projects of jst.values()) {
    for (const [project, amount] of projects) {
      totals.set(project, (totals.get(project) ?? 0) + amount);
    }
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
  const days: NumbersServerCostsDaily["days"] = [];
  for (const [day, projects] of jst) {
    const cost: Record<string, number> = {};
    let total = 0;
    for (const [project, amount] of projects) {
      const column = columnOf(project);
      cost[column] = (cost[column] ?? 0) + amount;
      columnTotals.set(column, (columnTotals.get(column) ?? 0) + amount);
      total += amount;
    }
    days.push({ day, total, cost });
  }

  return {
    currency: "JPY",
    usd_jpy: SERVER_COST_USD_JPY,
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
    days,
  };
}

/** AI費の機能の、画面での名前。ここに無い機能は、記録の名前のまま出す。 */
const AI_FEATURE_LABELS: Record<string, string> = {
  unmei_reading: "運命の設計図",
  unmei_reading_repair: "運命の設計図（直し）",
  hoshiyomi_chat: "星読みチャット",
  result_upgrade_copy: "鑑定書の文章",
  result_upgrade_reaction: "相づち",
  line_alice_chat: "LINEのAlice",
  line_daily_fortune: "LINEの毎日の占い",
  line_theme_fortune: "LINEのテーマ占い",
};

/**
 * 保存してある AI費 (利用の記録 × 単価、米ドル) を、日本時間の日 × 機能の円で返す。
 * 月の推移の「日別実績」の AI費と、「AI費（機能別）」の表に使う。読めなかったときは null。
 * 日は保存したときから日本時間なので、分け直しはしない。
 */
export async function readAiCostsDaily(
  from: string,
  to: string,
): Promise<NumbersAiCostsDaily | null> {
  const { data, error } = await supabaseAdmin
    .from("server_cost_daily")
    .select("day, provider, project, billed_usd")
    .in("provider", ["anthropic", AI_CONSOLE_PROVIDER])
    .gte("day", from)
    .lte("day", to)
    .order("day")
    .order("project")
    .limit(1000);
  if (error) {
    console.error("[internal-numbers] ai costs read failed", {
      code: error.code,
      message: error.message,
    });
    return null;
  }
  const totals = new Map<string, number>();
  const byDay = new Map<string, Record<string, number>>();
  // Claude Console の費用 (実額)。日ごとの合計だけ使う。
  const consoleDays = new Map<string, number>();
  for (const row of data) {
    const amount = Number(row.billed_usd) * SERVER_COST_USD_JPY;
    if (row.provider === AI_CONSOLE_PROVIDER) {
      consoleDays.set(row.day, (consoleDays.get(row.day) ?? 0) + amount);
      continue;
    }
    totals.set(row.project, (totals.get(row.project) ?? 0) + amount);
    const day = byDay.get(row.day) ?? {};
    day[row.project] = (day[row.project] ?? 0) + amount;
    byDay.set(row.day, day);
  }
  return {
    currency: "JPY",
    usd_jpy: SERVER_COST_USD_JPY,
    // 月の合計が大きい順。
    features: [...totals.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, total]) => ({
        key,
        name: AI_FEATURE_LABELS[key] ?? key,
        total,
      })),
    days: [...byDay.entries()].map(([day, cost]) => ({
      day,
      total: Object.values(cost).reduce((sum, value) => sum + value, 0),
      cost,
    })),
    console_days: [...consoleDays.entries()].map(([day, total]) => ({
      day,
      total,
    })),
  };
}
