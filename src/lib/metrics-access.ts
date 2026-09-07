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
 * Google Sheets 同期は専用キーを優先する。旧metrics API用のキーも互換用に
 * 受け付けるが、参照IDのHMACは常に専用キーを使い、行の結合を安定させる。
 */
export function authorizeSheetsMetricsRequest(
  request: Request,
): MetricsAccessResult {
  const sheetsExpected = process.env.SHEETS_METRICS_KEY?.trim();
  const metricsExpected = process.env.METRICS_KEY?.trim();
  const exportSecret = sheetsExpected || metricsExpected;
  if (!exportSecret) {
    return {
      ok: false,
      error: "SHEETS_METRICS_KEY or METRICS_KEY is not configured",
      status: 500,
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const provided = match?.[1]?.trim();
  const authorized =
    Boolean(
      provided && sheetsExpected && secretsMatch(provided, sheetsExpected),
    ) ||
    Boolean(
      provided && metricsExpected && secretsMatch(provided, metricsExpected),
    );

  if (!authorized) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  return { ok: true, exportSecret };
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
