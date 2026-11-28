import "server-only";

import type { NextRequest } from "next/server";

// 接続元の国。配信基盤が付ける、利用者が書き換えられない情報だけを使う。
// このファイルは Vercel 用。Cloudflare 向けビルド (DEPLOY_TARGET=cloudflare) では
// next.config.ts の resolveAlias により request-country.cloudflare.ts に差し替わる。

/** 配信基盤が接続元の国を付けてくれる環境かどうか。 */
export function hasPlatformRequestCountry(): boolean {
  return process.env.VERCEL === "1";
}

/** 配信基盤が判定した接続元の国 (ISO 3166-1 の2文字)。分からないときは null。 */
export function platformRequestCountry(request: NextRequest): string | null {
  return request.headers.get("x-vercel-ip-country");
}
