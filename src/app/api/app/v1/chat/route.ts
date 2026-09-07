import { APICallError, gateway, streamText } from "ai";
import { NextRequest } from "next/server";

import {
  appError,
  appRequestId,
  requireAppAccountId,
} from "@/lib/alice-app-api";
import {
  buildAliceChatContext,
  markAliceMemoriesUsed,
} from "@/lib/alice-chat";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ChatRequestBody = {
  client_message_id?: unknown;
  content?: unknown;
  thread_id?: unknown;
};

type Reservation = {
  duplicate: boolean;
  reserved: boolean;
  thread_id: string;
  user_message_id: string;
  assistant_message_id: string;
  assistant_status: "generating" | "completed" | "failed" | "aborted";
  assistant_content: string;
  attempt_count: number;
};

const encoder = new TextEncoder();

export async function POST(request: NextRequest) {
  const requestId = appRequestId(request);
  const auth = await requireAppAccountId(request);
  if (!auth.ok) return auth.response;
  const developmentBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.ALICE_CHAT_DEV_BYPASS === "true";
  if (process.env.ALICE_CHAT_ENABLED !== "true" && !developmentBypass) {
    return appError({
      status: 503,
      code: "chat_feature_unavailable",
      message: "対話機能は現在準備中です。",
      retryable: false,
      requestId,
    });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return appError({
      status: 400,
      code: "invalid_json",
      message: "メッセージの形式が正しくありません。",
      requestId,
    });
  }

  const clientMessageId = normalizeUuid(body.client_message_id);
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const threadId =
    body.thread_id === null || body.thread_id === undefined
      ? null
      : normalizeUuid(body.thread_id);
  if (!clientMessageId || !content || content.length > 4_000) {
    return appError({
      status: 400,
      code: "chat_message_invalid",
      message: "メッセージは1〜4000文字で入力してください。",
      requestId,
    });
  }
  if (body.thread_id !== null && body.thread_id !== undefined && !threadId) {
    return appError({
      status: 400,
      code: "chat_thread_invalid",
      message: "会話を確認できませんでした。",
      requestId,
    });
  }

  const { data, error } = await supabaseAdmin.rpc(
    "reserve_alice_chat_message",
    {
      p_account_id: auth.accountId,
      p_client_message_id: clientMessageId,
      p_content: content,
      p_thread_id: threadId,
      p_bypass_entitlement: developmentBypass,
    },
  );

  if (error || !data) {
    if (error) {
      console.error("[alice/chat] reservation failed", {
        requestId,
        code: error.code,
        message: error.message,
      });
    }
    return reservationError(error, requestId);
  }

  const reservation = data as Reservation;
  if (reservation.duplicate && reservation.assistant_status === "completed") {
    return sseResponse(
      oneShotStream([
        sseEvent("meta", {
          request_id: requestId,
          thread_id: reservation.thread_id,
          user_message_id: reservation.user_message_id,
          assistant_message_id: reservation.assistant_message_id,
          duplicate: true,
        }),
        sseEvent("delta", { text: reservation.assistant_content }),
        sseEvent("done", {
          assistant_message_id: reservation.assistant_message_id,
          content: reservation.assistant_content,
          finish_reason: "stored",
        }),
      ]),
      requestId,
    );
  }
  if (!reservation.reserved) {
    return appError({
      status: 409,
      code: "message_in_progress",
      message: "同じメッセージへの返答を作成中です。少し待ってから確認してください。",
      retryable: true,
      requestId,
    });
  }

  let context;
  try {
    context = await buildAliceChatContext({
      accountId: auth.accountId,
      threadId: reservation.thread_id,
      currentMessage: content,
    });
  } catch (caught) {
    console.error("[alice/chat] context build failed", {
      requestId,
      message: caught instanceof Error ? caught.message : String(caught),
    });
    await releaseReservation({
      accountId: auth.accountId,
      clientMessageId,
      status: "failed",
      errorCode: "chat_context_unavailable",
    });
    return appError({
      status: 503,
      code: "chat_context_unavailable",
      message: "会話の準備ができませんでした。もう一度お試しください。",
      retryable: true,
      requestId,
    });
  }

  const modelId = dialogueModelId();
  const streamAbortController = new AbortController();
  const onRequestAbort = () => streamAbortController.abort(request.signal.reason);
  request.signal.addEventListener("abort", onRequestAbort, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let completeText = "";
      let settled = false;
      controller.enqueue(
        encoder.encode(
          sseEvent("meta", {
            request_id: requestId,
            thread_id: reservation.thread_id,
            user_message_id: reservation.user_message_id,
            assistant_message_id: reservation.assistant_message_id,
            duplicate: reservation.duplicate,
          }),
        ),
      );

      try {
        const result = streamText({
          model: gateway(modelId),
          instructions: context.instructions,
          messages: context.messages,
          maxOutputTokens: context.maxOutputTokens,
          maxRetries: 2,
          abortSignal: streamAbortController.signal,
          providerOptions: {
            gateway: {
              caching: "auto",
              tags: ["feature:alice-dialogue", "tier:A"],
            },
          },
        });

        for await (const delta of result.textStream) {
          if (!delta) continue;
          completeText += delta;
          controller.enqueue(encoder.encode(sseEvent("delta", { text: delta })));
        }

        if (streamAbortController.signal.aborted) {
          throw new Error("chat_stream_aborted");
        }

        const [usage, finishReason] = await Promise.all([
          result.usage,
          result.finishReason,
        ]);
        if (!completeText.trim()) throw new Error("empty_ai_response");

        const { error: settleError } = await supabaseAdmin.rpc(
          "settle_alice_chat_message",
          {
            p_account_id: auth.accountId,
            p_client_message_id: clientMessageId,
            p_content: completeText,
            p_model: modelId,
            p_finish_reason: String(finishReason),
            p_input_tokens: usage.inputTokens ?? 0,
            p_output_tokens: usage.outputTokens ?? 0,
            p_estimated_cost_jpy: 0,
          },
        );
        if (settleError) throw new Error(`chat_settle_failed:${settleError.message}`);
        settled = true;
        void markAliceMemoriesUsed(auth.accountId, context.selectedMemoryIds);

        controller.enqueue(
          encoder.encode(
            sseEvent("done", {
              assistant_message_id: reservation.assistant_message_id,
              content: completeText,
              finish_reason: String(finishReason),
            }),
          ),
        );
      } catch (caught) {
        const aborted = streamAbortController.signal.aborted;
        const publicError = generationError(caught, requestId, aborted);
        console.error("[alice/chat] generation failed", {
          requestId,
          model: modelId,
          aborted,
          message: caught instanceof Error ? caught.message : String(caught),
        });
        if (!settled) {
          await releaseReservation({
            accountId: auth.accountId,
            clientMessageId,
            status: aborted ? "aborted" : "failed",
            errorCode: publicError.code,
            model: modelId,
          });
        }
        if (!aborted) {
          controller.enqueue(encoder.encode(sseEvent("error", publicError)));
        }
      } finally {
        request.signal.removeEventListener("abort", onRequestAbort);
        try {
          controller.close();
        } catch {
          // The client may already have cancelled and closed the stream.
        }
      }
    },
    cancel() {
      streamAbortController.abort("client_disconnected");
    },
  });

  return sseResponse(stream, requestId);
}

function reservationError(
  error: { code?: string; message?: string } | null,
  requestId: string,
) {
  const message = error?.message ?? "";
  const mapping: Record<
    string,
    { status: number; code: string; message: string; retryable?: boolean }
  > = {
    account_not_linked: {
      status: 404,
      code: "account_not_linked",
      message: "診断結果がまだ引き継がれていません。",
    },
    subscription_required: {
      status: 402,
      code: "subscription_required",
      message: "対話を続けるにはPlusへの登録が必要です。",
    },
    ai_daily_limit_reached: {
      status: 429,
      code: "ai_daily_limit_reached",
      message: "今日はたくさん話しました。続きは明日また話せます。",
    },
    ai_rolling_limit_reached: {
      status: 429,
      code: "ai_rolling_limit_reached",
      message: "今月の対話上限に達しました。しばらくしてからお試しください。",
    },
    client_message_id_conflict: {
      status: 409,
      code: "client_message_id_conflict",
      message: "送信内容が競合しました。もう一度送信してください。",
    },
    chat_retry_limit_reached: {
      status: 409,
      code: "chat_retry_limit_reached",
      message: "このメッセージは再送できません。新しいメッセージとして送ってください。",
    },
    chat_thread_not_found: {
      status: 404,
      code: "chat_thread_not_found",
      message: "会話が見つかりませんでした。",
    },
    chat_message_invalid: {
      status: 400,
      code: "chat_message_invalid",
      message: "メッセージは1〜4000文字で入力してください。",
    },
  };
  const matched = Object.entries(mapping).find(([key]) => message.includes(key));
  if (matched) return appError({ ...matched[1], requestId });
  return appError({
    status: 503,
    code: "chat_unavailable",
    message: "現在、対話を開始できません。もう一度お試しください。",
    retryable: true,
    requestId,
  });
}

function generationError(caught: unknown, requestId: string, aborted: boolean) {
  if (aborted) {
    return {
      code: "chat_aborted",
      message: "応答を中断しました。",
      retryable: true,
      request_id: requestId,
    };
  }
  if (APICallError.isInstance(caught)) {
    if (caught.statusCode === 429) {
      return {
        code: "ai_provider_busy",
        message: "ただいま混み合っています。少し待ってからもう一度お試しください。",
        retryable: true,
        request_id: requestId,
      };
    }
    if (caught.statusCode === 402) {
      return {
        code: "ai_gateway_budget_unavailable",
        message: "現在、対話を利用できません。しばらくしてからお試しください。",
        retryable: true,
        request_id: requestId,
      };
    }
  }
  return {
    code: "ai_generation_failed",
    message: "うまく返事を作れませんでした。もう一度送ってください。",
    retryable: true,
    request_id: requestId,
  };
}

async function releaseReservation(input: {
  accountId: string;
  clientMessageId: string;
  status: "failed" | "aborted";
  errorCode: string;
  model?: string;
}) {
  const { error } = await supabaseAdmin.rpc("release_alice_chat_message", {
    p_account_id: input.accountId,
    p_client_message_id: input.clientMessageId,
    p_status: input.status,
    p_error_code: input.errorCode,
    p_model: input.model ?? null,
  });
  if (error) {
    console.error("[alice/chat] failed to release reservation", {
      message: error.message,
    });
  }
}

function dialogueModelId() {
  const value = process.env.AI_MODEL_DIALOGUE?.trim();
  if (value && /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(value)) return value;
  return "openai/gpt-5.6-terra";
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    normalized,
  )
    ? normalized
    : null;
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function oneShotStream(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function sseResponse(stream: ReadableStream<Uint8Array>, requestId: string) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Request-Id": requestId,
    },
  });
}
