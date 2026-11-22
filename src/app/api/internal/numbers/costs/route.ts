// 社内向け数値画面の「広告費を入れる」の保存先。許可リストにある人だけが読み書きできる。
import { NextResponse, type NextRequest } from "next/server";

import { isValidNumbersDay } from "@/lib/internal-numbers";
import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 30;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

const MEDIUMS = ["x", "tiktok", "meta", "other"] as const;
const LOCALES = ["ja", "ko", "en", "id"] as const;
// エクスポートは 1 か月分 (24 時間 × 31 日) までを想定。それより多い行は受け付けない。
const MAX_UPLOAD_ROWS = 24 * 62;
const MAX_AMOUNT = 100_000_000;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
const notFound = () => json({ error: "not_found" }, 404);
const invalid = (reason: string) => json({ error: "invalid", reason }, 400);
const failed = (label: string, error: { code?: string; message?: string }) => {
  console.error(`[internal-numbers] ${label} failed`, {
    code: error.code,
    message: error.message,
  });
  return json({ error: "save_failed" }, 503);
};

const isAmount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= MAX_AMOUNT;
const isCount = (value: unknown): value is number =>
  value === undefined ||
  (typeof value === "number" && Number.isInteger(value) && value >= 0);
const isTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

async function authorize(request: NextRequest): Promise<boolean> {
  return isInternalDashboardViewer(await getSession(request));
}

/** 入力画面に出す、今の登録内容。 */
export async function GET(request: NextRequest) {
  if (!(await authorize(request))) return notFound();

  const since = new Date(Date.now() + 9 * 3600e3 - 21 * 86400e3)
    .toISOString()
    .slice(0, 10);
  const [accounts, plan, daily, hourly] = await Promise.all([
    supabaseAdmin
      .from("ad_accounts")
      .select("code, name, medium, timezone, locale")
      .order("code"),
    supabaseAdmin
      .from("ad_plan_hourly")
      .select("effective_from, medium, locale, hour, amount_jpy")
      .eq("locale", "ja")
      .order("effective_from", { ascending: false })
      .order("hour")
      .limit(24 * 4 * 6),
    supabaseAdmin
      .from("ad_spend_daily")
      .select("day, medium, locale, spend_jpy, updated_at")
      .gte("day", since)
      .order("day", { ascending: false }),
    supabaseAdmin
      .from("ad_spend_hourly")
      .select("day, hour, account, spend_jpy")
      .gte("day", since)
      .order("day", { ascending: false })
      .limit(24 * 22 * 12),
  ]);
  const error = accounts.error ?? plan.error ?? daily.error ?? hourly.error;
  if (error) {
    console.error("[internal-numbers] costs read failed", {
      code: error.code,
      message: error.message,
    });
    return json({ error: "costs_unavailable" }, 503);
  }

  // 時間別の実績は、日 × アカウントごとに「何時間分あるか」と合計だけを返す。
  const coverage = new Map<
    string,
    { day: string; account: string; hours: number; spend: number }
  >();
  for (const row of hourly.data ?? []) {
    const key = `${row.day} ${row.account}`;
    const entry = coverage.get(key) ?? {
      day: row.day,
      account: row.account,
      hours: 0,
      spend: 0,
    };
    entry.hours += 1;
    entry.spend += Number(row.spend_jpy);
    coverage.set(key, entry);
  }

  return json({
    accounts: accounts.data,
    plan: plan.data,
    daily: daily.data,
    coverage: [...coverage.values()],
  });
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) return notFound();
  // ほかのサイトから、ログイン中のブラウザを使って書き込ませないための確認。
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) {
    return json({ error: "forbidden" }, 403);
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return invalid("json");
  }

  if (body.action === "account") {
    const { code, name, medium, timezone, locale } = body;
    if (typeof code !== "string" || !/^[A-Z]{1,6}$/.test(code))
      return invalid("code");
    if (typeof name !== "string" || !name.trim() || name.length > 60)
      return invalid("name");
    if (!MEDIUMS.includes(medium as (typeof MEDIUMS)[number]))
      return invalid("medium");
    if (!isTimeZone(timezone)) return invalid("timezone");
    if (!LOCALES.includes(locale as (typeof LOCALES)[number]))
      return invalid("locale");
    const { error } = await supabaseAdmin.from("ad_accounts").upsert({
      code,
      name: name.trim(),
      medium,
      timezone,
      locale,
      updated_at: new Date().toISOString(),
    });
    return error ? failed("account save", error) : json({ ok: true });
  }

  if (body.action === "upload") {
    const { account, rows } = body;
    if (typeof account !== "string" || !/^[A-Z]{1,6}$/.test(account))
      return invalid("account");
    if (
      !Array.isArray(rows) ||
      rows.length === 0 ||
      rows.length > MAX_UPLOAD_ROWS
    ) {
      return invalid("rows");
    }
    const clean = [];
    for (const row of rows as Record<string, unknown>[]) {
      if (
        typeof row?.day !== "string" ||
        !isValidNumbersDay(row.day) ||
        typeof row.hour !== "number" ||
        !Number.isInteger(row.hour) ||
        row.hour < 0 ||
        row.hour > 23 ||
        !isAmount(row.spend) ||
        !isCount(row.impressions) ||
        !isCount(row.clicks) ||
        !isCount(row.leads) ||
        !isCount(row.purchases)
      ) {
        return invalid("row");
      }
      clean.push({
        day: row.day,
        hour: row.hour,
        spend: row.spend,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        leads: row.leads ?? 0,
        purchases: row.purchases ?? 0,
      });
    }
    const { data, error } = await supabaseAdmin.rpc("ad_spend_replace", {
      p_account: account,
      p_rows: clean,
    });
    return error ? failed("upload", error) : json({ ok: true, saved: data });
  }

  if (body.action === "daily") {
    const { day, medium, spend } = body;
    if (typeof day !== "string" || !isValidNumbersDay(day))
      return invalid("day");
    if (!MEDIUMS.includes(medium as (typeof MEDIUMS)[number]))
      return invalid("medium");
    // 金額を空にして保存したら、その日の手入力を取り消す。
    if (spend === null) {
      const { error } = await supabaseAdmin
        .from("ad_spend_daily")
        .delete()
        .eq("day", day)
        .eq("medium", medium)
        .eq("locale", "ja");
      return error ? failed("daily delete", error) : json({ ok: true });
    }
    if (!isAmount(spend)) return invalid("spend");
    const { error } = await supabaseAdmin.from("ad_spend_daily").upsert({
      day,
      medium,
      locale: "ja",
      spend_jpy: spend,
      updated_at: new Date().toISOString(),
    });
    return error ? failed("daily save", error) : json({ ok: true });
  }

  if (body.action === "plan") {
    const { effective_from: effectiveFrom, medium, hours } = body;
    if (
      typeof effectiveFrom !== "string" ||
      !isValidNumbersDay(effectiveFrom)
    ) {
      return invalid("effective_from");
    }
    if (!MEDIUMS.includes(medium as (typeof MEDIUMS)[number]))
      return invalid("medium");
    if (
      !Array.isArray(hours) ||
      hours.length !== 24 ||
      !hours.every(isAmount)
    ) {
      return invalid("hours");
    }
    const { error } = await supabaseAdmin.from("ad_plan_hourly").upsert(
      (hours as number[]).map((amount, hour) => ({
        effective_from: effectiveFrom,
        medium,
        locale: "ja",
        hour,
        amount_jpy: amount,
        updated_at: new Date().toISOString(),
      })),
    );
    return error ? failed("plan save", error) : json({ ok: true });
  }

  return invalid("action");
}
