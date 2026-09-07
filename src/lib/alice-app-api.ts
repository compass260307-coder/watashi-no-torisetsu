import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-server";

type AppErrorOptions = {
  status: number;
  code: string;
  message: string;
  retryable?: boolean;
  requestId?: string;
};

export function appRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && /^[A-Za-z0-9._-]{8,100}$/.test(incoming)
    ? incoming
    : randomUUID();
}

export function appError(options: AppErrorOptions) {
  return NextResponse.json(
    {
      code: options.code,
      message: options.message,
      retryable: options.retryable ?? options.status >= 500,
      request_id: options.requestId ?? randomUUID(),
    },
    {
      status: options.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function requireAppAccountId(
  request: Request,
): Promise<{ ok: true; accountId: string } | { ok: false; response: NextResponse }> {
  const requestId = appRequestId(request);
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: appError({
        status: 401,
        code: "unauthorized",
        message: "ログインが必要です。",
        requestId,
      }),
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(match[1]);
  if (error || !data.user) {
    return {
      ok: false,
      response: appError({
        status: 401,
        code: "invalid_access_token",
        message: "ログインの有効期限が切れました。もう一度ログインしてください。",
        requestId,
      }),
    };
  }

  return { ok: true, accountId: data.user.id };
}

export function normalizeTransferCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{8}$/.test(normalized) ? normalized : null;
}

export function hashAliceTransferSecret(
  kind: "code" | "claim-ticket",
  value: string,
): string {
  const secret =
    process.env.ALICE_TRANSFER_CODE_SECRET ??
    process.env.RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Alice transfer secret is not configured");
  return createHmac("sha256", secret)
    .update(`${kind}\0${value}`)
    .digest("hex");
}

export function normalizeAppLocale(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(normalized)
    ? normalized.slice(0, 35)
    : "ja-JP";
}

export function normalizeTimezone(value: unknown): string {
  if (typeof value !== "string") return "Asia/Tokyo";
  const normalized = value.trim();
  return /^[A-Za-z0-9_+\/-]{1,100}$/.test(normalized)
    ? normalized
    : "Asia/Tokyo";
}
