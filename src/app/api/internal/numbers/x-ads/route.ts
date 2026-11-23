// 社内向け数値画面: X Ads API からの広告費の取り込みを、許可リストの人が確かめる入口。
//   GET  : 取るだけで保存しない (アカウントの一覧・記号・通貨・期間の合計を返す)
//   POST : 取って保存する (毎時の定期実行と同じ処理を、いま 1 回)
import { NextResponse, type NextRequest } from "next/server";

import { isInternalDashboardViewer } from "@/lib/internal-numbers-access";
import { getSession } from "@/lib/session";
import { syncXAdsSpend } from "@/lib/x-ads-spend";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

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
  const report = await syncXAdsSpend({
    days: daysParam(request),
    dryRun: true,
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
  return json(await syncXAdsSpend({ days: daysParam(request) }));
}
