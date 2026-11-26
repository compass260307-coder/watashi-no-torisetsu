import "server-only";

// Claude Console の費用 (Usage and Cost Analytics API、ベータ) を読む。
//   GET https://api.anthropic.com/v1/organizations/analytics/cost
// 組織の Admin API キー (sk-ant-admin01-...) が要る。個人のアカウントでは使えない。
// 金額は「割引後・クレジット適用前」の米ドルで、1 時間ごと × モデルで受け取る
// (日本時間の 1 日に足し直すため。1 日単位だと UTC の日で区切られる)。

const ENDPOINT = "https://api.anthropic.com/v1/organizations/analytics/cost";
const MAX_PAGES = 40;

export class AnthropicCostError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`anthropic cost ${status}`);
  }
}

/** 鍵 (環境変数 ANTHROPIC_ADMIN_KEY)。無ければ null (取り込まない)。 */
export function anthropicAdminKey(): string | null {
  const key = process.env.ANTHROPIC_ADMIN_KEY?.trim();
  return key ? key : null;
}

export interface AnthropicCostHour {
  /** その 1 時間の始まり (UTC の時刻、ミリ秒)。 */
  startMs: number;
  /** モデル名。モデルに割り振られない費用 (コード実行など) は "(other)"。 */
  model: string;
  usd: number;
}

export interface AnthropicCost {
  hours: AnthropicCostHour[];
  /** ここまでの利用が入っている (これより後は、まだ入っていないか途中)。無ければ null。 */
  refreshedAtMs: number | null;
  rows: number;
  /** 読めなかった行の数。 */
  invalid: number;
  currencies: string[];
}

/** startMs 以上 endMs 未満 (31 日まで) の費用を、1 時間 × モデルで読む。 */
export async function fetchAnthropicCost(
  adminKey: string,
  startMs: number,
  endMs: number,
): Promise<AnthropicCost> {
  const result: AnthropicCost = {
    hours: [],
    refreshedAtMs: null,
    rows: 0,
    invalid: 0,
    currencies: [],
  };
  const currencies = new Set<string>();
  let page: string | null = null;
  for (let count = 0; ; count += 1) {
    if (count >= MAX_PAGES) throw new AnthropicCostError(0, "too_many_pages");
    const url = new URL(ENDPOINT);
    url.searchParams.set("starting_at", new Date(startMs).toISOString());
    url.searchParams.set("ending_at", new Date(endMs).toISOString());
    url.searchParams.set("time_bucket_width", "1h");
    url.searchParams.append("group_by[]", "model");
    url.searchParams.set("order_by", "time");
    url.searchParams.set("order", "asc");
    url.searchParams.set("limit", "1000");
    if (page) url.searchParams.set("page", page);
    const response = await fetch(url, {
      headers: {
        "x-api-key": adminKey,
        "anthropic-version": "2026-10-21",
        "anthropic-beta": "analytics-usage-cost-2026-08-24",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      // 応答の本文に鍵は入らないが、長い文はログに残さない。
      const text = await response.text().catch(() => "");
      throw new AnthropicCostError(response.status, text.slice(0, 200));
    }
    const body = (await response.json()) as {
      data?: unknown;
      has_more?: boolean;
      next_page?: string | null;
      data_refreshed_at?: string | null;
    };
    if (!Array.isArray(body.data)) {
      throw new AnthropicCostError(response.status, "unexpected_shape");
    }
    if (body.data_refreshed_at) {
      const refreshed = Date.parse(body.data_refreshed_at);
      if (Number.isFinite(refreshed)) result.refreshedAtMs = refreshed;
    }
    for (const item of body.data as {
      starting_at?: string;
      group?: { model?: string | null };
      cost?: { amount?: string; currency?: string };
    }[]) {
      result.rows += 1;
      const start = Date.parse(item?.starting_at ?? "");
      // amount は「セント」の小数の文字列 ("41280.000000" は 412.80 ドル)。
      const cents = Number(item?.cost?.amount);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(cents) ||
        item?.cost?.amount == null
      ) {
        result.invalid += 1;
        continue;
      }
      currencies.add(String(item.cost?.currency ?? "USD"));
      result.hours.push({
        startMs: start,
        model: item.group?.model || "(other)",
        usd: cents / 100,
      });
    }
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  result.currencies = [...currencies];
  return result;
}
