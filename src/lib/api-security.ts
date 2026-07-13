import "server-only";

import { createHmac } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase-server";

export type JsonObject = Record<string, unknown>;

export type JsonBodyResult =
  | { ok: true; value: JsonObject }
  | { ok: false; status: 400 | 413; error: string };

export type RateLimitResult = {
  allowed: boolean;
  remaining: number | null;
  retryAfterSeconds: number | null;
  enforced: boolean;
};

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  /** 省略時は接続元IP。招待コード単位など、IPを跨いで制限したい場合に指定する。 */
  identifier?: string;
};

let warnedRateLimitUnavailable = false;

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * JSON本文を上限付きで読む。
 * Content-Length が無いリクエストもストリームを途中で止め、巨大本文をメモリへ載せない。
 */
export async function readJsonObject(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      return { ok: false, status: 413, error: "Request body is too large" };
    }
  }

  if (!request.body) {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "Request body is too large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!isPlainObject(parsed)) {
      return { ok: false, status: 400, error: "JSON body must be an object" };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }
}

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded.slice(0, 128);

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);

  // ローカル開発などIPヘッダーが無い場合だけUAを補助識別子にする。
  return `unknown:${(request.headers.get("user-agent") ?? "unknown").slice(0, 256)}`;
}

function hmac(value: string): string {
  // 新しい環境変数を必須化せず安全に移行できるよう、既存のサーバー秘密鍵をfallbackに使う。
  // いずれもクライアントへ公開されず、DBにはHMAC値だけが保存される。
  const secret =
    process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Rate-limit secret is not configured");
  }
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Supabase RPCを使った、複数インスタンス間で共有される固定窓レート制限。 */
export async function consumeRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const rawIdentifier = options.identifier ?? clientAddress(request);
  const identifierHash = hmac(`${options.scope}\0${rawIdentifier}`);

  const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", {
    p_scope: options.scope,
    p_identifier_hash: identifierHash,
    p_window_seconds: options.windowSeconds,
    p_limit: options.limit,
  });

  if (error) {
    // DB migration適用前のデプロイを壊さない。警告はインスタンスごとに1度だけに抑える。
    if (!warnedRateLimitUnavailable) {
      warnedRateLimitUnavailable = true;
      console.error(
        "[api-security] rate limiting is unavailable; apply 2026-07-13-api-abuse-protection.sql:",
        error.message,
      );
    }
    return {
      allowed: true,
      remaining: null,
      retryAfterSeconds: null,
      enforced: false,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row?.allowed === true,
    remaining:
      typeof row?.remaining === "number" ? Math.max(0, row.remaining) : null,
    retryAfterSeconds:
      typeof row?.retry_after_seconds === "number"
        ? Math.max(1, row.retry_after_seconds)
        : null,
    enforced: true,
  };
}

/** 同じ接続元・同じ本文の短時間二重送信を、IPを保存せず判定する。 */
export function createSubmissionFingerprint(
  request: Request,
  scope: string,
  normalizedPayload: string,
  bucketSeconds = 300,
): string {
  const bucket = Math.floor(Date.now() / 1000 / bucketSeconds);
  return hmac(
    `${scope}\0${clientAddress(request)}\0${bucket}\0${normalizedPayload}`,
  );
}

export function isSafeOpaqueToken(
  value: unknown,
  minLength = 8,
  maxLength = 128,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minLength &&
    value.length <= maxLength &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function normalizeOptionalText(
  value: unknown,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function sanitizeFlatMetadata(
  value: unknown,
  maxEntries = 20,
): Record<string, string | number | boolean | null> | null {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) return null;

  const entries = Object.entries(value);
  if (entries.length > maxEntries) return null;

  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of entries) {
    if (!/^[A-Za-z0-9_.-]{1,50}$/.test(key)) return null;
    if (item === null || typeof item === "boolean") {
      sanitized[key] = item;
    } else if (typeof item === "number" && Number.isFinite(item)) {
      sanitized[key] = item;
    } else if (typeof item === "string" && item.length <= 200) {
      sanitized[key] = item;
    } else {
      return null;
    }
  }
  return sanitized;
}
