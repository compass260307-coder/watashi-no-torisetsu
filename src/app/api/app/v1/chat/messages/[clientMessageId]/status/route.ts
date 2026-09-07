import { NextRequest, NextResponse } from "next/server";

import {
  appError,
  appRequestId,
  requireAppAccountId,
} from "@/lib/alice-app-api";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clientMessageId: string }> },
) {
  const requestId = appRequestId(request);
  const auth = await requireAppAccountId(request);
  if (!auth.ok) return auth.response;
  const { clientMessageId } = await context.params;
  if (!isUuid(clientMessageId)) {
    return appError({
      status: 400,
      code: "client_message_id_invalid",
      message: "メッセージを確認できませんでした。",
      requestId,
    });
  }

  const { data: message, error } = await supabaseAdmin
    .from("chat_messages")
    .select("id, thread_id, content, status, completed_at, error_code")
    .eq("account_id", auth.accountId)
    .eq("role", "assistant")
    .eq("response_to_client_message_id", clientMessageId)
    .maybeSingle();

  if (error) {
    console.error("[alice/chat/status] lookup failed", {
      requestId,
      message: error.message,
    });
    return appError({
      status: 503,
      code: "chat_status_unavailable",
      message: "返答の状態を確認できませんでした。",
      retryable: true,
      requestId,
    });
  }
  if (!message) {
    return appError({
      status: 404,
      code: "chat_message_not_found",
      message: "メッセージが見つかりませんでした。",
      requestId,
    });
  }

  return NextResponse.json(message, {
    headers: { "Cache-Control": "no-store" },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
