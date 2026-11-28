import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";

// 接続元の国 (Cloudflare Workers 用)。request-country.ts の Cloudflare 版。
// ヘッダーは使わない: アダプターは Cloudflare が国を判定できたときだけ
// x-vercel-ip-country を上書きするため、判定できなかったリクエストでは利用者が
// 送ったヘッダーがそのまま残る。価格の出し分けに使う値なので、実行環境が持つ
// リクエスト情報 (cf.country) だけを信用する。

export function hasPlatformRequestCountry(): boolean {
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function platformRequestCountry(_request: NextRequest): string | null {
  const country = getCloudflareContext().cf?.country;
  return typeof country === "string" && country ? country.toUpperCase() : null;
}
