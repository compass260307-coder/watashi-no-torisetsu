import "server-only";

// サーバー費の実額を取り込んで server_cost_daily に入れる。いまは Vercel の料金だけ。
// 料金はあとから少し動くので、毎回「直近 N 日 (UTC)」を取り直して上書きする。
import { supabaseAdmin } from "./supabase-server";
import {
  VercelBillingError,
  fetchVercelCharges,
  vercelBillingConfig,
  type VercelCharges,
} from "./vercel-billing";

const DAY_MS = 86_400_000;
/** 1 回に取り込める日数の上限 (1 日あたり千行ほどの応答を、制限時間内に読み切るため)。 */
export const SERVER_COST_MAX_DAYS = 31;

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface ServerCostWindow {
  /** 取り込む最初の日と最後の日 (UTC、両端を含む)。 */
  fromDay: string;
  toDay: string;
}

/** 今日 (UTC) までの直近 days 日。 */
export function serverCostWindow(
  days: number,
  now = Date.now(),
): ServerCostWindow {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  return {
    fromDay: utcDay(today - (days - 1) * DAY_MS),
    toDay: utcDay(today),
  };
}

/** さかのぼって取り込む期間 (YYYY-MM-DD、UTC の日)。形がおかしければ理由を返す。 */
export function serverCostBackfillWindow(
  from: string,
  to: string,
  now = Date.now(),
): ServerCostWindow | { error: string } {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(from) || !pattern.test(to))
    return { error: "invalid_date" };
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    utcDay(start) !== from ||
    utcDay(end) !== to
  ) {
    return { error: "invalid_date" };
  }
  if (end < start) return { error: "to_before_from" };
  if (end > now) return { error: "future" };
  if ((end - start) / DAY_MS + 1 > SERVER_COST_MAX_DAYS)
    return { error: "too_long" };
  return { fromDay: from, toDay: to };
}

export interface ServerCostReport {
  ok: boolean;
  dryRun: boolean;
  provider: "vercel";
  window: ServerCostWindow;
  /** 日ごとの合計 (米ドル)。 */
  days: { day: string; effective: number; billed: number; charges: number }[];
  /** プロジェクトごとの合計 (米ドル)。金額の大きい順。 */
  projects: { project: string; effective: number; billed: number }[];
  total: { effective: number; billed: number; rows: number; invalid: number };
  shape: VercelCharges["shape"] | null;
  /** 保存した行数。保存していなければ null。 */
  saved: number | null;
  errors: string[];
}

function describe(error: unknown): string {
  if (error instanceof VercelBillingError) {
    return `${error.status} ${error.detail}`.slice(0, 300);
  }
  return error instanceof Error ? error.message.slice(0, 300) : "unknown";
}

/**
 * Vercel の料金を取って、日 × プロジェクトの合計を保存する。
 * dryRun なら取るだけで保存しない (入口の応答の形と金額を確かめるため)。
 */
export async function syncVercelCosts(options: {
  days?: number;
  dryRun?: boolean;
  range?: ServerCostWindow;
}): Promise<ServerCostReport> {
  const dryRun = options.dryRun ?? false;
  const window = options.range ?? serverCostWindow(options.days ?? 10);
  const report: ServerCostReport = {
    ok: false,
    dryRun,
    provider: "vercel",
    window,
    days: [],
    projects: [],
    total: { effective: 0, billed: 0, rows: 0, invalid: 0 },
    shape: null,
    saved: null,
    errors: [],
  };

  const config = vercelBillingConfig();
  if (!config) {
    report.errors.push("missing_credentials");
    return report;
  }

  let charges: VercelCharges;
  try {
    charges = await fetchVercelCharges(
      config,
      new Date(`${window.fromDay}T00:00:00Z`),
      // 終わりは含まないので、最後の日の翌日の 0 時 (UTC)。
      new Date(Date.parse(`${window.toDay}T00:00:00Z`) + DAY_MS),
    );
  } catch (error) {
    report.errors.push(`fetch: ${describe(error)}`);
    return report;
  }

  // 期間の外の日が混ざっていたら捨てる (保存する範囲と、入れ替える範囲をそろえる)。
  const cells = charges.cells.filter(
    (cell) => cell.day >= window.fromDay && cell.day <= window.toDay,
  );
  const byDay = new Map<string, ServerCostReport["days"][number]>();
  const byProject = new Map<string, ServerCostReport["projects"][number]>();
  for (const cell of cells) {
    const day = byDay.get(cell.day) ?? {
      day: cell.day,
      effective: 0,
      billed: 0,
      charges: 0,
    };
    day.effective += cell.effective;
    day.billed += cell.billed;
    day.charges += cell.charges;
    byDay.set(cell.day, day);
    const project = byProject.get(cell.project) ?? {
      project: cell.project,
      effective: 0,
      billed: 0,
    };
    project.effective += cell.effective;
    project.billed += cell.billed;
    byProject.set(cell.project, project);
    report.total.effective += cell.effective;
    report.total.billed += cell.billed;
  }
  report.days = [...byDay.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((day) => ({
      ...day,
      effective: round6(day.effective),
      billed: round6(day.billed),
    }));
  report.projects = [...byProject.values()]
    .sort((a, b) => b.effective - a.effective)
    .map((project) => ({
      ...project,
      effective: round6(project.effective),
      billed: round6(project.billed),
    }));
  report.total = {
    effective: round6(report.total.effective),
    billed: round6(report.total.billed),
    rows: charges.rows,
    invalid: charges.invalid,
  };
  report.shape = charges.shape;

  // 米ドル以外が混ざっていたら保存しない (金額をそのまま足せないため)。
  const otherCurrency = charges.shape.currencies.filter((c) => c !== "USD");
  if (otherCurrency.length > 0) {
    report.errors.push(`currency_not_usd: ${otherCurrency.join(",")}`);
    return report;
  }
  // 読めない行があったら保存しない。応答が途中で切れていると、少ない金額で上書きしてしまうため。
  if (charges.invalid > 0) {
    report.errors.push(`invalid_rows_not_saved: ${charges.invalid}`);
    return report;
  }
  // 1 件も読めなかったら保存しない。読み取りの不具合で、入っている実額を消さないため。
  if (cells.length === 0) {
    report.errors.push("no_charges_not_saved");
    return report;
  }

  if (!dryRun) {
    const { data, error } = await supabaseAdmin.rpc("server_cost_replace", {
      p_provider: "vercel",
      p_from: window.fromDay,
      p_to: window.toDay,
      p_rows: cells.map((cell) => ({
        day: cell.day,
        project: cell.project,
        effective: round6(cell.effective),
        billed: round6(cell.billed),
        charges: cell.charges,
      })),
    });
    if (error) {
      report.errors.push(`save: ${error.code}`);
      return report;
    }
    report.saved = Number(data ?? 0);
  }
  report.ok = true;
  return report;
}
