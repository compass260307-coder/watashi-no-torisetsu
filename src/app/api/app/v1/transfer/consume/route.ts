import { NextRequest, NextResponse } from "next/server";

import {
  appError,
  appRequestId,
  hashAliceTransferSecret,
  normalizeAppLocale,
  normalizeTimezone,
  requireAppAccountId,
} from "@/lib/alice-app-api";
import { readJsonObject } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = appRequestId(request);
  const auth = await requireAppAccountId(request);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonObject(request, 4 * 1024);
  if (!parsed.ok) {
    return appError({
      status: parsed.status,
      code: "invalid_request",
      message: "引き継ぎ情報を確認できませんでした。",
      requestId,
    });
  }

  const claimTicket = parsed.value.claim_ticket;
  if (
    typeof claimTicket !== "string" ||
    claimTicket.length < 32 ||
    claimTicket.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(claimTicket)
  ) {
    return invalidTicket(requestId);
  }

  const guide = parsed.value.guide === "harry" ? "harry" : "alice";
  const locale = normalizeAppLocale(request.headers.get("x-locale"));
  const timezone = normalizeTimezone(parsed.value.timezone);
  const ticketHash = hashAliceTransferSecret("claim-ticket", claimTicket);

  const { data, error } = await supabaseAdmin.rpc("consume_alice_transfer", {
    p_claim_ticket_hash: ticketHash,
    p_account_id: auth.accountId,
    p_locale: locale,
    p_timezone: timezone,
    p_guide: guide,
  });

  if (error) {
    const knownCode = knownTransferError(error.message);
    if (knownCode) {
      return appError({
        status: 409,
        code: knownCode,
        message:
          knownCode === "claim_ticket_already_used"
            ? "このコードはすでに使用されています。"
            : "引き継ぎの有効期限が切れました。最初からやり直してください。",
        requestId,
      });
    }
    console.error("[alice/transfer/consume] transaction failed", {
      requestId,
      message: error.message,
    });
    return appError({
      status: 503,
      code: "transfer_failed",
      message: "診断結果を引き継げませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.active_snapshot_id) {
    return appError({
      status: 503,
      code: "transfer_failed",
      message: "診断結果を引き継げませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }

  return NextResponse.json(
    { active_snapshot_id: result.active_snapshot_id },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function knownTransferError(message: string) {
  const known = [
    "invalid_claim_ticket",
    "claim_ticket_already_used",
    "claim_ticket_expired",
    "source_diagnosis_not_found",
    "source_merge_chain_invalid",
  ] as const;
  return known.find((code) => message.includes(code)) ?? null;
}

function invalidTicket(requestId: string) {
  return appError({
    status: 400,
    code: "invalid_claim_ticket",
    message: "引き継ぎ情報を確認できませんでした。最初からやり直してください。",
    requestId,
  });
}
