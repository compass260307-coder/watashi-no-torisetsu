import "server-only";

// Vercel の料金の入口 (GET /v1/billing/charges) を読むだけ。応答は 1 行 1 件の JSON
// (JSONL、FOCUS v1.3) で、1 日単位・米ドル。期間が長いと数万行になるので、受け取りながら
// 日 × プロジェクトで足し、行そのものは持たない。
// 鍵は Vercel の環境変数にだけ置き、ログや応答には出さない。

// 手元の確認では、作り物の入口に向けられる。本番では必ず Vercel の入口を使う
// (鍵をほかの宛先へ送らないため)。
const API_BASE =
  (process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_BILLING_API_BASE?.trim()) ||
  "https://api.vercel.com";

/** プロジェクトに割り振られない料金 (プランの定額など) の名前。 */
export const VERCEL_UNATTRIBUTED = "(unattributed)";

export interface VercelBillingConfig {
  token: string;
  /** チームの ID (team_ で始まる) か、チームの slug。 */
  team: string;
}

/** 環境変数から鍵とチームを読む。どちらかが欠けていれば null。 */
export function vercelBillingConfig(): VercelBillingConfig | null {
  const token = process.env.VERCEL_BILLING_TOKEN?.trim();
  const team = process.env.VERCEL_BILLING_TEAM_ID?.trim();
  return token && team ? { token, team } : null;
}

export class VercelBillingError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(status: number, detail: string) {
    super(`Vercel billing ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

/** 日 × プロジェクトの合計 (米ドル)。 */
export interface VercelCostCell {
  /** 課金期間の開始日 (UTC)。 */
  day: string;
  project: string;
  /** 割引後・クレジット適用前。 */
  effective: number;
  /** 請求額。 */
  billed: number;
  /** 足し合わせた料金の行数。 */
  charges: number;
}

export interface VercelCharges {
  cells: VercelCostCell[];
  /** 読んだ行数。 */
  rows: number;
  /** 読めなかった行数 (JSON として壊れている、日付や金額が無い)。 */
  invalid: number;
  /** 応答の形を確かめるための控え。金額は入れない。 */
  shape: {
    currencies: string[];
    categories: string[];
    tagKeys: string[];
    /** 課金期間の開始の時刻 (UTC の "HH:MM")。日の区切りがどこかを見る。 */
    periodStartTimes: string[];
    /** 課金期間の長さ (時間)。1 日単位なら 24。 */
    periodHours: number[];
  };
}

interface ChargeRecord {
  BilledCost?: unknown;
  EffectiveCost?: unknown;
  BillingCurrency?: unknown;
  ChargeCategory?: unknown;
  ChargePeriodStart?: unknown;
  ChargePeriodEnd?: unknown;
  Tags?: unknown;
}

/** 料金に付いているプロジェクト名。名前が無ければ ID、どちらも無ければ「割り振りなし」。 */
function projectOf(tags: unknown): string {
  if (!tags || typeof tags !== "object") return VERCEL_UNATTRIBUTED;
  const entries = Object.entries(tags as Record<string, unknown>);
  const pick = (pattern: RegExp) => {
    const hit = entries.find(
      ([key, value]) =>
        pattern.test(key) && typeof value === "string" && value.trim() !== "",
    );
    return hit ? (hit[1] as string).trim().slice(0, 120) : null;
  };
  return (
    pick(/^project[_-]?name$/i) ??
    pick(/^project[_-]?id$/i) ??
    VERCEL_UNATTRIBUTED
  );
}

const amount = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

/**
 * from (含む) 〜 to (含まない) の料金を読み、日 × プロジェクトで足して返す。
 * 料金が 1 件も無い期間は、入口が 404 を返す。そのときは空で返す。
 */
export async function fetchVercelCharges(
  config: VercelBillingConfig,
  from: Date,
  to: Date,
): Promise<VercelCharges> {
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  query.set(config.team.startsWith("team_") ? "teamId" : "slug", config.team);
  const response = await fetch(`${API_BASE}/v1/billing/charges?${query}`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Accept-Encoding": "gzip",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(100_000),
  });

  const cells = new Map<string, VercelCostCell>();
  const currencies = new Set<string>();
  const categories = new Set<string>();
  const tagKeys = new Set<string>();
  const periodStartTimes = new Set<string>();
  const periodHours = new Set<number>();
  let rows = 0;
  let invalid = 0;
  const result = (): VercelCharges => ({
    cells: [...cells.values()].sort(
      (a, b) =>
        a.day.localeCompare(b.day) || a.project.localeCompare(b.project),
    ),
    rows,
    invalid,
    shape: {
      currencies: [...currencies].sort(),
      categories: [...categories].sort(),
      tagKeys: [...tagKeys].sort(),
      periodStartTimes: [...periodStartTimes].sort(),
      periodHours: [...periodHours].sort((a, b) => a - b),
    },
  });

  if (response.status === 404) return result();
  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new VercelBillingError(response.status, detail);
  }

  const take = (line: string) => {
    const text = line.trim();
    if (!text) return;
    rows += 1;
    let record: ChargeRecord;
    try {
      record = JSON.parse(text) as ChargeRecord;
    } catch {
      invalid += 1;
      return;
    }
    const start =
      typeof record.ChargePeriodStart === "string"
        ? new Date(record.ChargePeriodStart)
        : null;
    const effective = amount(record.EffectiveCost);
    const billed = amount(record.BilledCost);
    if (
      !start ||
      Number.isNaN(start.getTime()) ||
      effective === null ||
      billed === null
    ) {
      invalid += 1;
      return;
    }
    const iso = start.toISOString();
    periodStartTimes.add(iso.slice(11, 16));
    if (typeof record.ChargePeriodEnd === "string") {
      const end = new Date(record.ChargePeriodEnd);
      if (!Number.isNaN(end.getTime())) {
        periodHours.add(
          Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) /
            100,
        );
      }
    }
    if (typeof record.BillingCurrency === "string") {
      currencies.add(record.BillingCurrency);
    }
    if (typeof record.ChargeCategory === "string") {
      categories.add(record.ChargeCategory);
    }
    if (record.Tags && typeof record.Tags === "object") {
      for (const key of Object.keys(record.Tags)) tagKeys.add(key);
    }
    const day = iso.slice(0, 10);
    const project = projectOf(record.Tags);
    const key = `${day} ${project}`;
    const cell = cells.get(key) ?? {
      day,
      project,
      effective: 0,
      billed: 0,
      charges: 0,
    };
    cell.effective += effective;
    cell.billed += billed;
    cell.charges += 1;
    cells.set(key, cell);
  };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    rest += decoder.decode(value, { stream: true });
    let index = rest.indexOf("\n");
    while (index >= 0) {
      take(rest.slice(0, index));
      rest = rest.slice(index + 1);
      index = rest.indexOf("\n");
    }
  }
  take(rest + decoder.decode());
  return result();
}
