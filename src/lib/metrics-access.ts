import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const metricsPrivateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
} as const;

type MetricsAccessResult =
  | { ok: true; exportSecret: string }
  | { ok: false; error: string; status: 401 | 500 };

function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * 計測APIは URL に秘密情報を含めず、Authorization: Bearer だけを受け付ける。
 * URL はアクセスログ・ブラウザ履歴・共有画面に残りやすいため、旧 ?key= は意図的に非対応。
 */
export function authorizeMetricsRequest(request: Request): MetricsAccessResult {
  const expected = process.env.METRICS_KEY?.trim();
  if (!expected) {
    return {
      ok: false,
      error: "METRICS_KEY is not configured",
      status: 500,
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const provided = match?.[1]?.trim();
  if (!provided || !secretsMatch(provided, expected)) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  return { ok: true, exportSecret: expected };
}

/**
 * スプレッドシート上で同一人物・同一セッションを集計できる一方、
 * 元のDB IDやセッショントークンは復元できない安定した参照IDに変換する。
 */
export function metricsExportReference(
  value: unknown,
  exportSecret: string,
): string {
  if (typeof value !== "string" || value.length === 0) return "";

  return `ref_${createHmac("sha256", exportSecret)
    .update(`metrics-export-v1:${value}`)
    .digest("hex")
    .slice(0, 24)}`;
}

