import "server-only";

// X Ads API (https://ads-api.x.com) の読み取りだけを行う。認証は OAuth 1.0a
// (アプリのコンシューマーキー + 広告アカウントを見られる人のアクセストークン)。
// 鍵は Vercel の環境変数にだけ置き、ログや応答には出さない。
import { oauthHeader, type XAdsCredentials } from "./x-ads-oauth";

const API_BASE = "https://ads-api.x.com/12";

/** 環境変数から鍵を読む。1 つでも欠けていれば null。 */
export function xAdsCredentials(): XAdsCredentials | null {
  const consumerKey = process.env.X_ADS_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.X_ADS_CONSUMER_SECRET?.trim();
  const accessToken = process.env.X_ADS_ACCESS_TOKEN?.trim();
  const accessTokenSecret = process.env.X_ADS_ACCESS_TOKEN_SECRET?.trim();
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return null;
  }
  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
}

export class XAdsApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly detail: string;
  constructor(status: number, path: string, detail: string) {
    super(`X Ads API ${status} ${path}: ${detail}`);
    this.status = status;
    this.path = path;
    this.detail = detail;
  }
}

export async function xAdsGet<T>(
  path: string,
  query: Record<string, string>,
  credentials: XAdsCredentials,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const search = new URLSearchParams(query).toString();
  const response = await fetch(search ? `${url}?${search}` : url, {
    headers: { Authorization: oauthHeader(url, query, credentials) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    // 応答の本文はエラーの種類だけを残す (鍵は含まれない)。
    const body = await response.text().catch(() => "");
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as {
        errors?: { code?: string; message?: string }[];
      };
      if (parsed.errors?.length) {
        detail = parsed.errors
          .map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim())
          .join("; ");
      }
    } catch {
      // 本文が JSON でなければ、そのまま (先頭だけ) 使う。
    }
    throw new XAdsApiError(response.status, path, detail);
  }
  return (await response.json()) as T;
}

export interface XAdsAccount {
  id: string;
  name: string;
  timezone: string;
  approval_status?: string;
  deleted?: boolean;
}

/** このアクセストークンで見られる広告アカウントの一覧。 */
export async function listXAdsAccounts(
  credentials: XAdsCredentials,
): Promise<XAdsAccount[]> {
  const accounts: XAdsAccount[] = [];
  let cursor: string | null = null;
  do {
    const page: { data: XAdsAccount[]; next_cursor?: string | null } =
      await xAdsGet(
        "/accounts",
        { count: "1000", ...(cursor ? { cursor } : {}) },
        credentials,
      );
    accounts.push(...page.data);
    cursor = page.next_cursor ?? null;
  } while (cursor);
  return accounts.filter((account) => !account.deleted);
}

export interface XAdsCampaign {
  id: string;
  name: string;
  currency?: string;
  deleted?: boolean;
}

/** アカウントのキャンペーン (消したものも含む。過去の広告費の持ち主を判別するため)。 */
export async function listXAdsCampaigns(
  accountId: string,
  credentials: XAdsCredentials,
): Promise<XAdsCampaign[]> {
  const campaigns: XAdsCampaign[] = [];
  let cursor: string | null = null;
  do {
    const page: { data: XAdsCampaign[]; next_cursor?: string | null } =
      await xAdsGet(
        `/accounts/${encodeURIComponent(accountId)}/campaigns`,
        {
          count: "1000",
          with_deleted: "true",
          ...(cursor ? { cursor } : {}),
        },
        credentials,
      );
    campaigns.push(...page.data);
    cursor = page.next_cursor ?? null;
  } while (cursor);
  return campaigns;
}

/** 配信面。X と X Audience Platform の両方に出る広告は、配信面ごとに別に問い合わせる。 */
export const X_ADS_PLACEMENTS = ["ALL_ON_TWITTER", "PUBLISHER_NETWORK"] as const;
export type XAdsPlacement = (typeof X_ADS_PLACEMENTS)[number];

export interface XAdsActiveEntity {
  entity_id: string;
  placements?: string[];
}

/**
 * 期間中に配信のあったキャンペーン。統計はこの分だけ問い合わせる (アカウントには数百の
 * キャンペーンがあり、全部を問い合わせると利用回数の上限に近づくため)。
 */
export async function listXAdsActiveCampaigns(
  accountId: string,
  start: string,
  end: string,
  credentials: XAdsCredentials,
): Promise<XAdsActiveEntity[]> {
  const body: { data?: XAdsActiveEntity[] } = await xAdsGet(
    `/stats/accounts/${encodeURIComponent(accountId)}/active_entities`,
    { entity: "CAMPAIGN", start_time: start, end_time: end },
    credentials,
  );
  return body.data ?? [];
}

export interface XAdsHourlyMetrics {
  /** 1 時間ごとの値。先頭が start の時間帯。 */
  spendMicro: number[];
  impressions: number[];
  clicks: number[];
}

type MetricSeries = (number | null)[] | null | undefined;

/** 1 回の統計の問い合わせに入れられるキャンペーンの数。 */
export const X_ADS_MAX_ENTITY_IDS = 20;

/**
 * キャンペーンの、時間別の広告費・表示回数・クリック数の合計 (同期の統計)。
 * アカウント全体 (entity=ACCOUNT) では広告費が返ってこないため、キャンペーン単位で
 * 取って足す (2026-11-24 本番の応答で確認)。start・end は正時、期間は 7 日まで。
 */
export async function fetchXAdsCampaignsHourly(
  accountId: string,
  campaignIds: string[],
  start: string,
  end: string,
  placement: XAdsPlacement,
  credentials: XAdsCredentials,
): Promise<XAdsHourlyMetrics> {
  const length = Math.round((Date.parse(end) - Date.parse(start)) / 3_600_000);
  const total: XAdsHourlyMetrics = {
    spendMicro: new Array<number>(length).fill(0),
    impressions: new Array<number>(length).fill(0),
    clicks: new Array<number>(length).fill(0),
  };
  for (let i = 0; i < campaignIds.length; i += X_ADS_MAX_ENTITY_IDS) {
    const ids = campaignIds.slice(i, i + X_ADS_MAX_ENTITY_IDS);
    const body: {
      data?: {
        id_data?: {
          metrics?: {
            billed_charge_local_micro?: MetricSeries;
            impressions?: MetricSeries;
            clicks?: MetricSeries;
          };
        }[];
      }[];
    } = await xAdsGet(
      `/stats/accounts/${encodeURIComponent(accountId)}`,
      {
        entity: "CAMPAIGN",
        entity_ids: ids.join(","),
        start_time: start,
        end_time: end,
        granularity: "HOUR",
        metric_groups: "BILLING,ENGAGEMENT",
        placement,
      },
      credentials,
    );
    for (const entity of body.data ?? []) {
      for (const segment of entity.id_data ?? []) {
        const metrics = segment.metrics ?? {};
        for (let h = 0; h < length; h += 1) {
          total.spendMicro[h] += Number(metrics.billed_charge_local_micro?.[h] ?? 0) || 0;
          total.impressions[h] += Number(metrics.impressions?.[h] ?? 0) || 0;
          total.clicks[h] += Number(metrics.clicks?.[h] ?? 0) || 0;
        }
      }
    }
  }
  return total;
}
