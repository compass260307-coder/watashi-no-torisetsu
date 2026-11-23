import "server-only";

// X Ads API から、直近の時間別の広告費を取って ad_spend_hourly に入れる。
// 広告費 (billed_charge_local_micro) は 3 日ほど見込みの値で、あとから少し動くので、
// 毎回「直近 N 日の 0 時から、いまの時間帯の手前まで」を取り直して上書きする。
// アカウント記号は、xlsx の取り込みと同じくキャンペーン名から決める。
import { supabaseAdmin } from "./supabase-server";
import {
  X_ADS_PLACEMENTS,
  XAdsApiError,
  fetchXAdsCampaignsHourly,
  listXAdsAccounts,
  listXAdsActiveCampaigns,
  listXAdsCampaigns,
  xAdsCredentials,
  type XAdsPlacement,
} from "./x-ads-api";
import { accountCodeFromCampaignNames } from "./x-ads-export";

const HOUR_MS = 3_600_000;
const JST_OFFSET_MS = 9 * HOUR_MS;

interface SpendRow {
  day: string;
  hour: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
}

export interface XAdsSyncAccountReport {
  id: string;
  name: string;
  timezone: string;
  /** キャンペーン名から決めたアカウント記号。読み取れなければ null。 */
  code: string | null;
  currency: string | null;
  campaigns: number;
  /** 期間中に配信のあったキャンペーンの数。 */
  activeCampaigns: number;
  /** 取った期間の広告費の合計 (円)。 */
  spend: number;
  /** 保存しなかった理由。保存したら null。 */
  skipped: string | null;
}

export interface XAdsSyncReport {
  ok: boolean;
  dryRun: boolean;
  window: { from: string; to: string };
  accounts: XAdsSyncAccountReport[];
  /** 記号ごとに保存した行数。 */
  saved: Record<string, number>;
  errors: string[];
}

/** UTC の時刻 → JST の日付と時。 */
function jstParts(utcMs: number): { day: string; hour: number } {
  const date = new Date(utcMs + JST_OFFSET_MS);
  return {
    day: date.toISOString().slice(0, 10),
    hour: date.getUTCHours(),
  };
}

/**
 * 取り直す期間。JST で days 日前の 0 時から、いまの時間帯の手前まで (いまの時間帯は
 * まだ途中で、配信計画からの推定のままにしておく)。
 */
export function xAdsSyncWindow(
  days: number,
  now = Date.now(),
): { from: number; to: number } {
  const to = Math.floor(now / HOUR_MS) * HOUR_MS;
  const todayStartJst =
    Math.floor((now + JST_OFFSET_MS) / (24 * HOUR_MS)) * 24 * HOUR_MS -
    JST_OFFSET_MS;
  return { from: todayStartJst - (days - 1) * 24 * HOUR_MS, to };
}

export async function syncXAdsSpend({
  days = 3,
  dryRun = false,
}: { days?: number; dryRun?: boolean } = {}): Promise<XAdsSyncReport> {
  const window = xAdsSyncWindow(Math.min(7, Math.max(1, days)));
  const report: XAdsSyncReport = {
    ok: false,
    dryRun,
    window: {
      from: new Date(window.from).toISOString(),
      to: new Date(window.to).toISOString(),
    },
    accounts: [],
    saved: {},
    errors: [],
  };
  const credentials = xAdsCredentials();
  if (!credentials) {
    report.errors.push("missing_credentials");
    return report;
  }
  if (window.to <= window.from) {
    report.ok = true;
    return report;
  }

  const { data: known, error: knownError } = await supabaseAdmin
    .from("ad_accounts")
    .select("code")
    .eq("medium", "x");
  if (knownError) {
    report.errors.push(`ad_accounts: ${knownError.code}`);
    return report;
  }
  const knownCodes = new Set((known ?? []).map((row) => row.code as string));

  let accounts;
  try {
    accounts = await listXAdsAccounts(credentials);
  } catch (error) {
    report.errors.push(describe(error));
    return report;
  }

  const hours = Math.round((window.to - window.from) / HOUR_MS);
  // 記号ごとに足し合わせる (同じ記号のアカウントが 2 つあっても 1 つにまとめる)。
  const byCode = new Map<string, SpendRow[]>();
  // API は「2026-11-21T15:00:00Z」の形 (正時、ミリ秒なし) を受け付ける。
  const start = new Date(window.from).toISOString().replace(".000Z", "Z");
  const end = new Date(window.to).toISOString().replace(".000Z", "Z");

  for (const account of accounts) {
    const entry: XAdsSyncAccountReport = {
      id: account.id,
      name: account.name,
      timezone: account.timezone,
      code: null,
      currency: null,
      campaigns: 0,
      activeCampaigns: 0,
      spend: 0,
      skipped: null,
    };
    report.accounts.push(entry);
    try {
      const campaigns = await listXAdsCampaigns(account.id, credentials);
      entry.campaigns = campaigns.length;
      entry.code = accountCodeFromCampaignNames(campaigns.map((c) => c.name));
      const currencies = new Set(
        campaigns.map((c) => c.currency).filter(Boolean) as string[],
      );
      entry.currency = currencies.size === 1 ? [...currencies][0] : null;

      const spendMicro = new Array<number>(hours).fill(0);
      const impressions = new Array<number>(hours).fill(0);
      const clicks = new Array<number>(hours).fill(0);
      // 期間中に配信のあったキャンペーンと、その配信面だけを問い合わせる。
      const active = await listXAdsActiveCampaigns(
        account.id,
        start,
        end,
        credentials,
      );
      entry.activeCampaigns = active.length;
      const placements = X_ADS_PLACEMENTS.filter((placement) =>
        active.some(
          (item) => !item.placements || item.placements.includes(placement),
        ),
      );
      for (const placement of placements) {
        const ids = active
          .filter(
            (item) => !item.placements || item.placements.includes(placement),
          )
          .map((item) => item.entity_id);
        try {
          const series = await fetchXAdsCampaignsHourly(
            account.id,
            ids,
            start,
            end,
            placement as XAdsPlacement,
            credentials,
          );
          for (let i = 0; i < hours; i += 1) {
            spendMicro[i] += series.spendMicro[i] ?? 0;
            impressions[i] += series.impressions[i] ?? 0;
            clicks[i] += series.clicks[i] ?? 0;
          }
        } catch (error) {
          // X Audience Platform に出していないアカウントでは、この配信面だけ断られる
          // ことがある。X 本体の分が取れていれば続ける。
          if (placement === "ALL_ON_TWITTER") throw error;
          report.errors.push(`${account.id} ${placement}: ${describe(error)}`);
        }
      }

      const rows: SpendRow[] = spendMicro.map((micro, i) => ({
        ...jstParts(window.from + i * HOUR_MS),
        spend: Math.round(micro / 10_000) / 100,
        impressions: impressions[i],
        clicks: clicks[i],
        leads: 0,
        purchases: 0,
      }));
      entry.spend = Math.round(rows.reduce((sum, row) => sum + row.spend, 0));

      if (!entry.code) entry.skipped = "code_not_found";
      else if (!knownCodes.has(entry.code)) entry.skipped = "code_not_registered";
      else if (entry.currency !== "JPY") entry.skipped = "currency_not_jpy";
      if (entry.skipped || !entry.code) continue;

      const merged = byCode.get(entry.code);
      if (!merged) {
        byCode.set(entry.code, rows);
      } else {
        rows.forEach((row, i) => {
          merged[i].spend = Math.round((merged[i].spend + row.spend) * 100) / 100;
          merged[i].impressions += row.impressions;
          merged[i].clicks += row.clicks;
        });
      }
    } catch (error) {
      entry.skipped = "fetch_failed";
      report.errors.push(`${account.id}: ${describe(error)}`);
    }
  }

  // 保存する記号の広告費がすべて 0 円なら保存しない。読み取りの不具合で実績 0 円を
  // 書くと、配信計画の推定が消えて利益が大きく出てしまうため。
  const totalToSave = [...byCode.values()]
    .flat()
    .reduce((sum, row) => sum + row.spend, 0);
  if (byCode.size > 0 && totalToSave <= 0) {
    report.errors.push("all_zero_not_saved");
    return report;
  }

  if (!dryRun) {
    for (const [code, rows] of byCode) {
      const { data, error } = await supabaseAdmin.rpc("ad_spend_replace", {
        p_account: code,
        p_rows: rows,
      });
      if (error) report.errors.push(`save ${code}: ${error.code}`);
      else report.saved[code] = Number(data ?? 0);
    }
  }
  report.ok = report.accounts.some((a) => !a.skipped) || accounts.length === 0;
  return report;
}

function describe(error: unknown): string {
  if (error instanceof XAdsApiError) {
    return `${error.status} ${error.detail}`.slice(0, 300);
  }
  return error instanceof Error ? error.message.slice(0, 300) : "unknown";
}
