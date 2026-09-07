import { NextRequest, NextResponse } from "next/server";

import {
  appError,
  appRequestId,
  requireAppAccountId,
} from "@/lib/alice-app-api";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = appRequestId(request);
  const auth = await requireAppAccountId(request);
  if (!auth.ok) return auth.response;

  const { data: thread, error: threadError } = await supabaseAdmin
    .from("chat_threads")
    .select("id")
    .eq("account_id", auth.accountId)
    .eq("status", "active")
    .maybeSingle();

  if (threadError) {
    console.error("[alice/chat/messages] thread lookup failed", {
      requestId,
      message: threadError.message,
    });
    return appError({
      status: 503,
      code: "chat_history_unavailable",
      message: "会話履歴を読み込めませんでした。",
      retryable: true,
      requestId,
    });
  }
  if (!thread) {
    return NextResponse.json(
      { thread_id: null, messages: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: rows, error: messageError } = await supabaseAdmin
    .from("chat_messages")
    .select(
      "id, role, content, status, client_message_id, response_to_client_message_id, created_at, completed_at, error_code",
    )
    .eq("account_id", auth.accountId)
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  if (messageError) {
    console.error("[alice/chat/messages] message lookup failed", {
      requestId,
      message: messageError.message,
    });
    return appError({
      status: 503,
      code: "chat_history_unavailable",
      message: "会話履歴を読み込めませんでした。",
      retryable: true,
      requestId,
    });
  }

  return NextResponse.json(
    { thread_id: thread.id, messages: (rows ?? []).reverse() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
