import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

type Account = { advertiserId: string; country: "jp" | "kr" | "us"; source: string; tokenEnv: string };
type AdRow = { ad_id: string; date: string; hour: number; ad_name: string; spend_jpy: number; impressions: number; clicks: number };
type ObjectData = Record<string, unknown>;

function object(value: unknown): ObjectData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_RESPONSE");
  return value as ObjectData;
}

function amount(value: unknown, integer = false): number {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+(\.\d+)?$/.test(String(value))) throw new Error("INVALID_METRIC");
  const n = Number(value);
  if (!Number.isSafeInteger(Math.trunc(n)) || n < 0 || (integer && !Number.isInteger(n))) throw new Error("INVALID_METRIC");
  return n;
}

function accountsFromEnv(): Account[] {
  const raw: unknown = JSON.parse(process.env.HYPER_TIKTOK_AD_ACCOUNTS || "[]");
  if (!Array.isArray(raw) || raw.length > 5) throw new Error("INVALID_CONFIG");
  const ids = new Set<string>();
  return raw.map(value => {
    const row = object(value);
    const { advertiserId, country } = row;
    const source = row.source ?? "tiktok";
    const tokenEnv = row.tokenEnv ?? "TIKTOK_MARKETING_ACCESS_TOKEN";
    if (typeof advertiserId !== "string" || !/^\d{1,30}$/.test(advertiserId) || ids.has(advertiserId) ||
      !["jp", "kr", "us"].includes(String(country)) || typeof source !== "string" || source.length < 1 || source.length > 100 ||
      typeof tokenEnv !== "string" || !/^TIKTOK_MARKETING_ACCESS_TOKEN(?:_[A-Z0-9_]+)?$/.test(tokenEnv)) throw new Error("INVALID_CONFIG");
    ids.add(advertiserId);
    return { advertiserId, country: country as Account["country"], source, tokenEnv };
  });
}

async function tiktokGet(path: string, query: Record<string, string>, token: string, deadline: number): Promise<ObjectData> {
  if (Date.now() > deadline) throw new Error("TIME_BUDGET");
  const url = new URL("https://business-api.tiktok.com/open_api/v1.3/" + path);
  url.search = new URLSearchParams(query).toString();
  const response = await fetch(url, { headers: { "Access-Token": token }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("PROVIDER_HTTP");
  const body = object(await response.json());
  if (body.code !== 0) throw new Error("PROVIDER_ERROR");
  return object(body.data);
}

function localParts(at: number, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

// Convert advertiser-local hours to actual JST hours. Ambiguous DST fall-back
// buckets cannot be resolved from this API's offset-free string: fail closed.
export function advertiserHourToJst(value: string, timeZone: string): { date: string; hour: number } {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:00:00$/.test(value)) throw new Error("INVALID_HOUR");
  const guess = Date.parse(value.replace(" ", "T") + "Z");
  if (!Number.isFinite(guess)) throw new Error("INVALID_HOUR");
  const candidates = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const probe = guess + hours * 3600000;
    const offset = Date.parse(localParts(probe, timeZone).replace(" ", "T") + "Z") - probe;
    const at = guess - offset;
    if (localParts(at, timeZone) === value) candidates.add(at);
  }
  if (candidates.size !== 1) throw new Error("AMBIGUOUS_TIMEZONE");
  if ([...candidates][0] % 3600000 !== 0) throw new Error("UNALIGNED_TIMEZONE");
  const jst = new Date([...candidates][0] + 9 * 3600000);
  return { date: jst.toISOString().slice(0, 10), hour: jst.getUTCHours() };
}

export async function fetchTikTokAdRows(account: Account, start: string, end: string, fx: Record<string, number>, deadline: number): Promise<AdRow[]> {
  const token = process.env[account.tokenEnv]?.trim();
  if (!token) throw new Error("TOKEN_MISSING");
  const info = await tiktokGet("advertiser/info/", { advertiser_ids: JSON.stringify([account.advertiserId]), fields: JSON.stringify(["advertiser_id", "currency", "timezone"]) }, token, deadline);
  if (!Array.isArray(info.list) || info.list.length !== 1) throw new Error("ACCOUNT_MISMATCH");
  const advertiser = object(info.list[0]);
  if (String(advertiser.advertiser_id) !== account.advertiserId || typeof advertiser.timezone !== "string" || typeof advertiser.currency !== "string") throw new Error("ACCOUNT_MISMATCH");
  const currency = advertiser.currency.toLowerCase();
  const rate = currency === "jpy" ? 1 : fx[currency];
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("FX_MISSING");
  const timeZone = advertiser.timezone;
  const startLocal = localParts(Date.parse(start + "T00:00:00+09:00"), timeZone).slice(0, 10);
  const endLocal = localParts(Date.parse(end + "T23:59:59+09:00"), timeZone).slice(0, 10);
  const rows: AdRow[] = [], seen = new Set<string>();
  let expectedTotal: number | null = null, expectedCount: number | null = null;
  for (let page = 1; page <= 100; page++) {
    const data = await tiktokGet("report/integrated/get/", {
      advertiser_id: account.advertiserId, report_type: "BASIC", data_level: "AUCTION_AD",
      dimensions: JSON.stringify(["ad_id", "stat_time_hour"]), metrics: JSON.stringify(["ad_name", "spend", "impressions", "clicks"]),
      start_date: startLocal, end_date: endLocal, page: String(page), page_size: "1000",
    }, token, deadline);
    const pagination = object(data.page_info);
    const totalPage = amount(pagination.total_page, true);
    const totalCount = pagination.total_number === undefined ? null : amount(pagination.total_number, true);
    // Incomplete/repeated/changing pages must not replace valid stored data.
    if (!Array.isArray(data.list) || data.list.length > 1000 || totalPage > 100 ||
      (pagination.page !== undefined && Number(pagination.page) !== page) ||
      (expectedCount !== null && totalCount !== expectedCount) ||
      (expectedTotal !== null && totalPage !== expectedTotal) || (totalPage < page && !(page === 1 && totalPage === 0 && !data.list.length))) throw new Error("INCOMPLETE_REPORT");
    expectedTotal = totalPage;
    expectedCount = totalCount;
    for (const item of data.list) {
      const row = object(item), dims = object(row.dimensions), metrics = object(row.metrics);
      if (typeof dims.ad_id !== "string" || !/^\d{1,30}$/.test(dims.ad_id) || typeof dims.stat_time_hour !== "string" || typeof metrics.ad_name !== "string" || !metrics.ad_name || metrics.ad_name.length > 1000) throw new Error("INVALID_AD");
      const key = JSON.stringify([dims.ad_id, dims.stat_time_hour]);
      if (seen.has(key)) throw new Error("DUPLICATE_REPORT");
      seen.add(key);
      const jst = advertiserHourToJst(dims.stat_time_hour, timeZone);
      if (jst.date < start || jst.date > end) continue;
      // Reporting spend is in major account currency, including USD (not cents).
      rows.push({ ad_id: dims.ad_id, ...jst, ad_name: metrics.ad_name, spend_jpy: Math.round(amount(metrics.spend) * rate * 100) / 100, impressions: amount(metrics.impressions, true), clicks: amount(metrics.clicks, true) });
    }
    if (page >= totalPage) {
      if (expectedCount !== null && seen.size !== expectedCount) throw new Error("INCOMPLETE_REPORT");
      return rows;
    }
    if (!data.list.length) throw new Error("INCOMPLETE_REPORT");
  }
  throw new Error("REPORT_TOO_LARGE");
}

export async function syncHyperAdSpend(now = new Date()) {
  // Disabled by default, including Preview. No API requests or DB mutations.
  if (process.env.HYPER_AD_SPEND_ENABLED !== "1" || process.env.VERCEL_ENV !== "production") return { skipped: true };
  const accounts = accountsFromEnv();
  if (!accounts.length) throw new Error("ACCOUNTS_MISSING");
  const fx: Record<string, number> = JSON.parse(process.env.HYPER_REPORT_FX_JPY_PER_UNIT || "{}");
  const lease = randomUUID();
  const claim = await supabaseAdmin.rpc("hyper_ad_spend_claim", { p_lease: lease, p_accounts: accounts.map(a => ({ account_id: a.advertiserId, country: a.country, source: a.source })) });
  if (claim.error) throw new Error("CLAIM_FAILED");
  if (claim.data !== true) return { skipped: true, busy: true };
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  const start = new Date(Date.parse(today + "T00:00:00Z") - 2 * 86400000).toISOString().slice(0, 10);
  const deadline = Date.now() + 210000;
  let succeeded = 0, failed = 0;
  try {
    for (const account of accounts) {
      try {
        const rows = await fetchTikTokAdRows(account, start, today, fx, deadline);
        const stored = await supabaseAdmin.rpc("hyper_ad_spend_replace", { p_lease: lease, p_account: account.advertiserId, p_start: start, p_end: today, p_rows: rows });
        if (stored.error) throw new Error("STORE_FAILED");
        succeeded++;
      } catch {
        failed++;
        const recorded = await supabaseAdmin.rpc("hyper_ad_spend_failed", { p_lease: lease, p_account: account.advertiserId });
        if (recorded.error) throw new Error("STATUS_FAILED");
      }
    }
  } finally {
    const released = await supabaseAdmin.rpc("hyper_ad_spend_release", { p_lease: lease });
    if (released.error) throw new Error("RELEASE_FAILED");
  }
  return { succeeded, failed };
}
