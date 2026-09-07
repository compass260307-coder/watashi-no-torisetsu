import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  appError,
  appRequestId,
  hashAliceTransferSecret,
  normalizeTransferCode,
} from "@/lib/alice-app-api";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const CLAIM_TICKET_TTL_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const requestId = appRequestId(request);
  const rateLimit = await consumeRateLimit(request, {
    scope: "alice-transfer-validate-ip",
    limit: 12,
    windowSeconds: 10 * 60,
  });
  if (!rateLimit.allowed) {
    return appError({
      status: 429,
      code: "rate_limited",
      message: "確認回数が多すぎます。少し時間を空けてください。",
      retryable: true,
      requestId,
    });
  }

  const parsed = await readJsonObject(request, 2 * 1024);
  if (!parsed.ok) {
    return appError({
      status: parsed.status,
      code: "invalid_request",
      message: "引き継ぎコードを確認してください。",
      requestId,
    });
  }

  const code = normalizeTransferCode(parsed.value.code);
  if (!code) return invalidCode(requestId);

  const codeHash = hashAliceTransferSecret("code", code);
  const nowIso = new Date().toISOString();
  const { data: transferCode, error: lookupError } = await supabaseAdmin
    .from("app_transfer_codes")
    .select("id, expires_at, consumed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (lookupError) {
    console.error("[alice/transfer/validate] lookup failed", {
      requestId,
      message: lookupError.message,
    });
    return appError({
      status: 503,
      code: "transfer_temporarily_unavailable",
      message: "現在コードを確認できません。少し時間を空けてください。",
      retryable: true,
      requestId,
    });
  }
  if (
    !transferCode ||
    transferCode.consumed_at ||
    transferCode.expires_at <= nowIso
  ) {
    return invalidCode(requestId);
  }

  const claimTicket = randomBytes(32).toString("base64url");
  const claimTicketHash = hashAliceTransferSecret("claim-ticket", claimTicket);
  const claimTicketExpiresAt = new Date(Date.now() + CLAIM_TICKET_TTL_MS).toISOString();
  const { data: claimed, error: updateError } = await supabaseAdmin
    .from("app_transfer_codes")
    .update({
      claim_ticket_hash: claimTicketHash,
      claim_ticket_expires_at: claimTicketExpiresAt,
    })
    .eq("id", transferCode.id)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("id")
    .maybeSingle();

  if (updateError || !claimed) {
    if (updateError) {
      console.error("[alice/transfer/validate] claim update failed", {
        requestId,
        message: updateError.message,
      });
    }
    return invalidCode(requestId);
  }

  return NextResponse.json(
    { claim_ticket: claimTicket, expires_at: claimTicketExpiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function invalidCode(requestId: string) {
  return appError({
    status: 400,
    code: "invalid_transfer_code",
    message: "コードが違うか、有効期限が切れています。",
    requestId,
  });
}
