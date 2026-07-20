// natal_readings の生成状態判定 (single source of truth)。
// 状態は natal_readings.model + reading(jsonb) に持つ:
//   model='pending'                 … プレースホルダ(未生成)
//   model='generating'              … 生成中(並行ロック)。reading={status:'generating',attempts}
//   model='failed'                  … 失敗。reading={status:'failed',attempts,error}
//   model=<実モデル> + reading.sections … 生成完了(有効)
//   ※ generateWorker.mjs 側にも同じ規律をインライン実装(要一致)。

// 自動再生成の上限 (generateWorker.MAX_GEN_ATTEMPTS と一致させること)。
export const MAX_GEN_ATTEMPTS = 3;

type ReadingRow = { model?: string | null; reading?: unknown } | null | undefined;

// 有効な鑑定(生成完了)か。pending/generating/failed/not-implemented はすべて false。
export function isReadingReady(row: ReadingRow): boolean {
  if (!row) return false;
  const model = row.model;
  if (
    !model ||
    model === "pending" ||
    model === "generating" ||
    model === "failed" ||
    model === "local-placeholder"
  ) {
    return false;
  }
  const r = row.reading as
    | { sections?: unknown; generated_from?: unknown }
    | null
    | undefined;
  if (!r || typeof r !== "object") return false;
  if ((r as { generated_from?: unknown }).generated_from === "not-implemented") {
    return false;
  }
  const sections = (r as { sections?: unknown }).sections;
  return Array.isArray(sections) && sections.length > 0;
}

export type GenState = "ready" | "generating" | "failed" | "pending";

// 生成状態を返す。failed は自動再生成の上限に達したときのみ(それ未満は pending 扱い=再試行余地あり)。
export function readingGenState(row: ReadingRow): { state: GenState; attempts: number } {
  if (isReadingReady(row)) return { state: "ready", attempts: 0 };
  const r =
    row && (row.reading as { attempts?: unknown; status?: unknown } | null | undefined);
  const attempts = (r && Number((r as { attempts?: unknown }).attempts)) || 0;
  const model = row?.model;
  if (model === "generating") return { state: "generating", attempts };
  if (model === "failed") {
    // 上限到達で初めて 'failed'(手動リトライ待ち)。未達なら pending(自動再試行の余地)。
    return { state: attempts >= MAX_GEN_ATTEMPTS ? "failed" : "pending", attempts };
  }
  return { state: "pending", attempts };
}
