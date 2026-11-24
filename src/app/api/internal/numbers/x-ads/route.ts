// 社内向け数値画面: X Ads API からの広告費の取り込みを、許可リストの人が確かめる入口。
//   GET  : 取るだけで保存しない (アカウントの一覧・記号・通貨・期間の合計を返す)
//   POST : 取って保存する (毎時の定期実行と同じ処理を、いま 1 回)
//   どちらも ?from=YYYY-MM-DD&to=YYYY-MM-DD で、終わった日を 7 日までさかのぼって取れる
import { NextResponse, type NextRequest } from "next/server";

import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { getSession } from "@/lib/session";
import { listXAdsAccounts, xAdsCredentials, xAdsGet } from "@/lib/x-ads-api";
import {
  syncXAdsSpend,
  xAdsBackfillWindow,
  xAdsSyncWindow,
} from "@/lib/x-ads-spend";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

/**
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD: さかのぼって取り込む期間 (終わった日、7 日まで)。
 * 無ければ null (直近 days 日)。形がおかしければ理由。
 */
function rangeParam(
  request: NextRequest,
): { from: number; to: number } | { error: string } | null {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (from === null && to === null) return null;
  return xAdsBackfillWindow(from ?? "", to ?? from ?? "");
}

function daysParam(request: NextRequest): number {
  const value = Number(request.nextUrl.searchParams.get("days") ?? "3");
  return Number.isInteger(value) && value >= 1 && value <= 7 ? value : 3;
}

/**
 * 鍵の「形」だけを返す (値は返さない)。認証が通らないときに、入れ間違い
 * (トークンとシークレットの取り違え、前後の欠け・空白) を見分けるため。
 */
function credentialShape() {
  const shape = (name: string) => {
    const raw = process.env[name] ?? "";
    return {
      length: raw.trim().length,
      hasOuterSpace: raw !== raw.trim(),
      hasInnerSpace: /\s/.test(raw.trim()),
    };
  };
  const token = (process.env.X_ADS_ACCESS_TOKEN ?? "").trim();
  return {
    consumerKey: shape("X_ADS_CONSUMER_KEY"),
    consumerSecret: shape("X_ADS_CONSUMER_SECRET"),
    accessToken: {
      ...shape("X_ADS_ACCESS_TOKEN"),
      // アクセストークンは「数字-英数字」の形 (先頭の数字はユーザー ID)。
      looksLikeAccessToken: /^\d+-[A-Za-z0-9]+$/.test(token),
    },
    accessTokenSecret: shape("X_ADS_ACCESS_TOKEN_SECRET"),
  };
}

export async function GET(request: NextRequest) {
  if (!(await isInternalDashboardViewer(await getSession(request)))) {
    return json({ error: "not_found" }, 404);
  }
  // debug=<広告アカウントID>: そのアカウントの統計の応答を、加工せずに返す
  // (広告費の読み取り方を確かめるため)。直近 24 時間、アカウント全体と、
  // 配信中のキャンペーン (最大 5 つ) の 2 通り。
  const debug = request.nextUrl.searchParams.get("debug");
  if (debug !== null) {
    const credentials = xAdsCredentials();
    if (!credentials || !/^[a-z0-9]{1,20}$/.test(debug)) {
      return json({ error: "invalid" }, 400);
    }
    const window = xAdsSyncWindow(1);
    const start = new Date(window.to - 24 * 3_600_000)
      .toISOString()
      .replace(".000Z", "Z");
    const end = new Date(window.to).toISOString().replace(".000Z", "Z");
    const safe = async (fn: () => Promise<unknown>) => {
      try {
        return await fn();
      } catch (error) {
        return { error: error instanceof Error ? error.message : "unknown" };
      }
    };
    const campaigns = (await safe(() =>
      xAdsGet(
        `/accounts/${debug}/campaigns`,
        { count: "200", sort_by: "updated_at-desc" },
        credentials,
      ),
    )) as { data?: { id: string; name: string; entity_status?: string }[] };
    const active = (campaigns.data ?? [])
      .filter((c) => c.entity_status === "ACTIVE")
      .slice(0, 5);
    const stats = (entity: string, ids: string) =>
      safe(() =>
        xAdsGet(
          `/stats/accounts/${debug}`,
          {
            entity,
            entity_ids: ids,
            start_time: start,
            end_time: end,
            granularity: "HOUR",
            metric_groups: "BILLING,ENGAGEMENT",
            placement: "ALL_ON_TWITTER",
          },
          credentials,
        ),
      );
    return json({
      start,
      end,
      campaigns: active.map((c) => ({ id: c.id, name: c.name })),
      account: await stats("ACCOUNT", debug),
      campaign: active.length
        ? await stats("CAMPAIGN", active.map((c) => c.id).join(","))
        : null,
    });
  }

  // funding=1: 各アカウントの支払い方法 (funding instruments) を返す。クーポンの類が API で
  // 見えるかを確かめるため (2026-11-24)。読むだけ。カード番号などが混ざりうる文字の項目
  // (description・name など) は値を返さず、項目名だけを返す。
  if (request.nextUrl.searchParams.get("funding") !== null) {
    const credentials = xAdsCredentials();
    if (!credentials) return json({ error: "missing_credentials" }, 400);
    const SAFE_KEYS = new Set([
      "id",
      "type",
      "currency",
      "entity_status",
      "deleted",
      "cancelled",
      "able_to_fund",
      "paused",
      "start_time",
      "end_time",
      "created_at",
      "updated_at",
      "credit_limit_local_micro",
      "credit_remaining_local_micro",
      "funded_amount_local_micro",
      "reasons_not_able_to_fund",
    ]);
    const accounts = await listXAdsAccounts(credentials);
    const result = [];
    for (const account of accounts) {
      try {
        const body = await xAdsGet<{ data?: Record<string, unknown>[] }>(
          `/accounts/${encodeURIComponent(account.id)}/funding_instruments`,
          { with_deleted: "true", count: "200" },
          credentials,
        );
        result.push({
          account: account.name,
          id: account.id,
          instruments: (body.data ?? []).map((item) => {
            const safe: Record<string, unknown> = {};
            const other: string[] = [];
            for (const [key, value] of Object.entries(item)) {
              if (SAFE_KEYS.has(key)) safe[key] = value;
              else other.push(`${key}:${value === null ? "null" : typeof value}`);
            }
            return { ...safe, other_keys: other };
          }),
        });
      } catch (error) {
        result.push({
          account: account.name,
          id: account.id,
          error: error instanceof Error ? error.message.slice(0, 200) : "unknown",
        });
      }
    }
    return json({ funding: result });
  }

  const range = rangeParam(request);
  if (range && "error" in range) return json(range, 400);
  const report = await syncXAdsSpend({
    days: daysParam(request),
    dryRun: true,
    range: range ?? undefined,
  });
  return json({ ...report, credentials: credentialShape() });
}

export async function POST(request: NextRequest) {
  if (!(await isInternalDashboardViewer(await getSession(request)))) {
    return json({ error: "not_found" }, 404);
  }
  // ほかのサイトから、ログイン中のブラウザを使って書き込ませないための確認。
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) {
    return json({ error: "forbidden" }, 403);
  }
  const range = rangeParam(request);
  if (range && "error" in range) return json(range, 400);
  return json(
    await syncXAdsSpend({ days: daysParam(request), range: range ?? undefined }),
  );
}
