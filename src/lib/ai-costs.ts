import "server-only";

// AI費の実額を、利用の記録 (ai_usage_events) から出して server_cost_daily に入れる。
// 1 回の呼び出しごとに残してあるトークン数に、Anthropic の単価を掛けた金額 (米ドル) を、
// 日本時間の日 × 機能で足す。提供元は 'anthropic'、project の列に機能の名前を入れる。
// 請求額そのものを取り込むわけではない (請求の正本は Claude Console)。
import { estimateAnthropicCostUsd } from "./ai-usage.mjs";
import { supabaseAdmin } from "./supabase-server";

const DAY_MS = 86_400_000;
const JST_OFFSET_MS = 9 * 3_600_000;
const PAGE = 1000;
/** 読む行数の上限 (1 回の実行を制限時間内に終えるため)。超えたら保存しない。 */
const MAX_ROWS = 200_000;
/** 1 回に取り込める日数の上限。 */
export const AI_COST_MAX_DAYS = 31;

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const jstDay = (ms: number) =>
  new Date(ms + JST_OFFSET_MS).toISOString().slice(0, 10);
/** 日本時間のその日の 0 時 (UTC の時刻)。 */
const jstDayStart = (day: string) =>
  Date.parse(`${day}T00:00:00Z`) - JST_OFFSET_MS;

export interface AiCostWindow {
  /** 取り込む最初の日と最後の日 (日本時間、両端を含む)。 */
  fromDay: string;
  toDay: string;
}

/** きのう (日本時間) までの直近 days 日。今日は途中なので入れない。 */
export function aiCostWindow(days: number, now = Date.now()): AiCostWindow {
  const yesterday = jstDayStart(jstDay(now)) - DAY_MS;
  return {
    fromDay: jstDay(yesterday - (days - 1) * DAY_MS),
    toDay: jstDay(yesterday),
  };
}

/** さかのぼって取り込む期間 (YYYY-MM-DD、日本時間の日)。形がおかしければ理由を返す。 */
export function aiCostBackfillWindow(
  from: string,
  to: string,
  now = Date.now(),
): AiCostWindow | { error: string } {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(from) || !pattern.test(to))
    return { error: "invalid_date" };
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    new Date(start).toISOString().slice(0, 10) !== from ||
    new Date(end).toISOString().slice(0, 10) !== to
  ) {
    return { error: "invalid_date" };
  }
  if (end < start) return { error: "to_before_from" };
  // 終わった日だけ (今日は途中なので保存しない)。
  if (to >= jstDay(now)) return { error: "not_finished" };
  if ((end - start) / DAY_MS + 1 > AI_COST_MAX_DAYS)
    return { error: "too_long" };
  return { fromDay: from, toDay: to };
}

export interface AiCostReport {
  ok: boolean;
  dryRun: boolean;
  provider: "anthropic";
  window: AiCostWindow;
  /** 日ごとの合計 (米ドル)。 */
  days: { day: string; cost: number; calls: number }[];
  /** 機能ごとの合計 (米ドル)。金額の大きい順。 */
  features: { feature: string; cost: number; calls: number }[];
  total: { cost: number; rows: number };
  /** 単価が分からず金額に入れられなかった呼び出し (モデルごとの件数)。 */
  unpriced: { model: string; calls: number }[];
  /** 保存した行数。保存していなければ null。 */
  saved: number | null;
  errors: string[];
}

interface UsageRow {
  id: string;
  created_at: string;
  feature: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_input_tokens: number | null;
  cache_write_input_tokens: number | null;
  estimated_cost_usd: number | string | null;
}

/**
 * AI の利用の記録から、日本時間の日 × 機能の金額を出して保存する。
 * dryRun なら数えるだけで保存しない。
 */
export async function syncAiCosts(options: {
  days?: number;
  dryRun?: boolean;
  range?: AiCostWindow;
}): Promise<AiCostReport> {
  const dryRun = options.dryRun ?? false;
  const window = options.range ?? aiCostWindow(options.days ?? 3);
  const report: AiCostReport = {
    ok: false,
    dryRun,
    provider: "anthropic",
    window,
    days: [],
    features: [],
    total: { cost: 0, rows: 0 },
    unpriced: [],
    saved: null,
    errors: [],
  };

  const since = new Date(jstDayStart(window.fromDay)).toISOString();
  const until = new Date(jstDayStart(window.toDay) + DAY_MS).toISOString();
  // 日 → 機能 → 金額と件数。
  const cells = new Map<string, { cost: number; calls: number }>();
  const unpriced = new Map<string, number>();
  for (let offset = 0; ; offset += PAGE) {
    if (offset >= MAX_ROWS) {
      report.errors.push("too_many_rows_not_saved");
      return report;
    }
    const { data, error } = await supabaseAdmin
      .from("ai_usage_events")
      .select(
        "id, created_at, feature, model, input_tokens, output_tokens, cache_read_input_tokens, cache_write_input_tokens, estimated_cost_usd",
      )
      // Anthropic に直接払う分だけ。Vercel 経由の分 (画像) は Vercel の料金に入る。
      .eq("provider", "anthropic")
      .gte("created_at", since)
      .lt("created_at", until)
      .order("created_at")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) {
      // 途中まで読めた分で上書きしない。
      report.errors.push(`read: ${error.code}`);
      return report;
    }
    for (const row of data as UsageRow[]) {
      report.total.rows += 1;
      // 失敗した呼び出しなど、トークンの記録が無い行は課金されていない。
      if (row.input_tokens === null && row.output_tokens === null) continue;
      // 金額は、いまの単価表で計算し直す (記録したときの概算より、直した単価を優先する)。
      const cost =
        estimateAnthropicCostUsd(row.model, {
          inputTokens: row.input_tokens ?? 0,
          outputTokens: row.output_tokens ?? 0,
          cacheReadInputTokens: row.cache_read_input_tokens,
          cacheWriteInputTokens: row.cache_write_input_tokens,
        }) ??
        (row.estimated_cost_usd === null
          ? null
          : Number(row.estimated_cost_usd));
      if (cost === null || !Number.isFinite(cost)) {
        unpriced.set(row.model, (unpriced.get(row.model) ?? 0) + 1);
        continue;
      }
      const key = `${jstDay(Date.parse(row.created_at))}\n${row.feature}`;
      const cell = cells.get(key) ?? { cost: 0, calls: 0 };
      cell.cost += cost;
      cell.calls += 1;
      cells.set(key, cell);
    }
    if (data.length < PAGE) break;
  }

  const rows = [...cells.entries()].map(([key, cell]) => {
    const [day, feature] = key.split("\n");
    return { day, feature, cost: round6(cell.cost), calls: cell.calls };
  });
  const byDay = new Map<string, { day: string; cost: number; calls: number }>();
  const byFeature = new Map<
    string,
    { feature: string; cost: number; calls: number }
  >();
  for (const row of rows) {
    const day = byDay.get(row.day) ?? { day: row.day, cost: 0, calls: 0 };
    day.cost += row.cost;
    day.calls += row.calls;
    byDay.set(row.day, day);
    const feature = byFeature.get(row.feature) ?? {
      feature: row.feature,
      cost: 0,
      calls: 0,
    };
    feature.cost += row.cost;
    feature.calls += row.calls;
    byFeature.set(row.feature, feature);
    report.total.cost += row.cost;
  }
  report.days = [...byDay.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((day) => ({ ...day, cost: round6(day.cost) }));
  report.features = [...byFeature.values()]
    .sort((a, b) => b.cost - a.cost)
    .map((feature) => ({ ...feature, cost: round6(feature.cost) }));
  report.total.cost = round6(report.total.cost);
  report.unpriced = [...unpriced.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([model, calls]) => ({ model, calls }));
  // 単価表に無いモデルがあると、その分だけ少なく出る。保存はするが、気づけるよう残す。
  if (report.unpriced.length > 0) {
    report.errors.push(
      `unpriced_models: ${report.unpriced.map((entry) => entry.model).join(",")}`,
    );
  }

  // 1 件も無ければ保存しない。読み取りの不具合で、入っている金額を消さないため。
  if (rows.length === 0) {
    report.errors.push("no_usage_not_saved");
    return report;
  }

  if (!dryRun) {
    const { data, error } = await supabaseAdmin.rpc("server_cost_replace", {
      p_provider: "anthropic",
      p_from: window.fromDay,
      p_to: window.toDay,
      p_rows: rows.map((row) => ({
        day: row.day,
        project: row.feature,
        effective: row.cost,
        billed: row.cost,
        charges: row.calls,
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
