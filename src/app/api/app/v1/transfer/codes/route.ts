import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  appError,
  appRequestId,
  hashAliceTransferSecret,
} from "@/lib/alice-app-api";
import { consumeRateLimit } from "@/lib/api-security";
import { checkOrigin } from "@/lib/origin-check";
import { isUndiagnosedPlaceholderUser } from "@/lib/placeholder-user";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const requestId = appRequestId(request);
  const origin = checkOrigin(request);
  if (!origin.ok) {
    return appError({
      status: 403,
      code: "forbidden_origin",
      message: "この画面からはコードを発行できません。",
      requestId,
    });
  }

  const session = await getSession(request);
  if (!session) {
    return appError({
      status: 401,
      code: "web_login_required",
      message: "診断結果のページにログインしてください。",
      requestId,
    });
  }

  const { data: diagnosis, error: diagnosisError } = await supabaseAdmin
    .from("users")
    .select("scores, diagnosis_completed_at")
    .eq("id", session.id)
    .maybeSingle();
  if (diagnosisError || !diagnosis) {
    return appError({
      status: 503,
      code: "diagnosis_lookup_failed",
      message: "診断結果を確認できませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }
  if (isUndiagnosedPlaceholderUser(diagnosis)) {
    return appError({
      status: 409,
      code: "diagnosis_required",
      message: "先にWeb診断を完了してください。",
      requestId,
    });
  }

  const rateLimit = await consumeRateLimit(request, {
    scope: "alice-transfer-code-issue-user",
    identifier: session.id,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return appError({
      status: 429,
      code: "rate_limited",
      message: "発行回数が多すぎます。しばらくしてからお試しください。",
      retryable: true,
      requestId,
    });
  }

  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("app_transfer_codes")
    .update({ expires_at: nowIso })
    .eq("source_user_id", session.id)
    .is("consumed_at", null)
    .gt("expires_at", nowIso);

  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = createCode();
    const { error } = await supabaseAdmin.from("app_transfer_codes").insert({
      code_hash: hashAliceTransferSecret("code", code),
      source_user_id: session.id,
      expires_at: expiresAt,
    });

    if (!error) {
      return NextResponse.json(
        { code: `${code.slice(0, 4)}-${code.slice(4)}`, expires_at: expiresAt },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error.code !== "23505") {
      console.error("[alice/transfer/codes] insert failed", {
        requestId,
        message: error.message,
      });
      break;
    }
  }

  return appError({
    status: 503,
    code: "code_issue_failed",
    message: "コードを発行できませんでした。もう一度お試しください。",
    retryable: true,
    requestId,
  });
}

function createCode() {
  let value = "";
  for (let index = 0; index < 8; index += 1) {
    value += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return value;
}
