import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  createIdGenerator,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { consumeRateLimit, isSafeOpaqueToken, readJsonObject } from "@/lib/api-security";
import { buildHoshiyomiInstructions } from "@/lib/hoshiyomi/prompt";
import {
  ensureHoshiyomiCreditsFromPurchase,
  loadHoshiyomiConversation,
  reserveHoshiyomiMessage,
  saveHoshiyomiConversation,
  settleHoshiyomiMessage,
} from "@/lib/hoshiyomi/store";
import { checkOrigin } from "@/lib/origin-check";
import { getSession } from "@/lib/session";
import { hasFullAccess } from "@/lib/entitlements";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "anthropic/claude-sonnet-5";
const MAX_MESSAGE_LENGTH = 1200;

function userText(message: UIMessage): string | null {
  if (message.role !== "user") return null;
  if (message.parts.some((part) => part.type !== "text")) return null;
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n")
    .trim();
  return text && text.length <= MAX_MESSAGE_LENGTH ? text : null;
}

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const session = await getSession(request as never);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [credits, fullAccess] = await Promise.all([
    ensureHoshiyomiCreditsFromPurchase(session.id),
    hasFullAccess(session.id),
  ]);
  if (!fullAccess || !credits.available || credits.data.total <= 0) {
    return NextResponse.json({ error: "Chat access required" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit(request, {
    scope: "hoshiyomi-chat",
    identifier: session.id,
    limit: 6,
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "少し間をあけてから、もう一度お話しください。" },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const body = await readJsonObject(request, 24_000);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }
  const locale = body.value.locale === "ko" ? "ko" : "ja";
  const conversationId = body.value.id;
  if (!isSafeOpaqueToken(conversationId, 8, 64)) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  const checkedMessage = await safeValidateUIMessages({
    messages: [body.value.message],
  });
  if (!checkedMessage.success || checkedMessage.data.length !== 1) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  const newMessage = checkedMessage.data[0];
  if (!userText(newMessage)) {
    return NextResponse.json(
      {
        error:
          locale === "ko"
            ? `메시지는 ${MAX_MESSAGE_LENGTH}자 이내로 입력해 주세요.`
            : `メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください。`,
      },
      { status: 400 },
    );
  }

  const storedMessages =
    (await loadHoshiyomiConversation(session.id, conversationId)) ?? [];
  const checkedStored = await safeValidateUIMessages({ messages: storedMessages });
  if (!checkedStored.success) {
    console.error("[hoshiyomi] stored message validation failed", checkedStored.error);
    return NextResponse.json({ error: "Conversation could not be loaded" }, { status: 500 });
  }
  const messages = [...checkedStored.data.slice(-20), newMessage];

  // プロンプト構築中の例外で回数が消費されないよう、構築後に予約する。
  const instructions = await buildHoshiyomiInstructions(session.id, locale);
  const reservationId = createIdGenerator({ prefix: "credit", size: 16 })();
  const usage = await reserveHoshiyomiMessage(session.id, reservationId);
  if (!usage.allowed || !usage.ownerId) {
    return NextResponse.json(
      {
        error:
          locale === "ko"
            ? "채팅 횟수를 모두 사용했어요."
            : "チャットの利用回数を使い切りました。",
        code: "credits_exhausted",
        used: usage.used,
        remaining: usage.remaining,
      },
      { status: 429 },
    );
  }

  const creditOwnerId = usage.ownerId;
  let streamFailed = false;
  let result;
  try {
    result = streamText({
      model: MODEL,
      instructions,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 900,
      abortSignal: request.signal,
      onError: async ({ error }) => {
        streamFailed = true;
        console.error("[hoshiyomi] model generation failed", error);
        await settleHoshiyomiMessage(creditOwnerId, reservationId, false);
      },
    });
  } catch (error) {
    await settleHoshiyomiMessage(creditOwnerId, reservationId, false);
    throw error;
  }

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onEnd: async ({
        messages: completeMessages,
        finishReason,
        isAborted,
      }) => {
        const commit = !streamFailed && !isAborted && finishReason !== "error";
        try {
          await settleHoshiyomiMessage(creditOwnerId, reservationId, commit);
          if (!commit) return;
          await saveHoshiyomiConversation({
            id: conversationId,
            userId: session.id,
            messages: completeMessages,
          });
        } catch (error) {
          console.error("[hoshiyomi] conversation save failed", error);
        }
      },
      onError: (error) => {
        streamFailed = true;
        console.error("[hoshiyomi] model stream failed", error);
        return locale === "ko"
          ? "별을 제대로 읽지 못했어요. 잠시 뒤 다시 이야기해 주세요."
          : "うまく星を読めませんでした。少し時間をおいて、もう一度お話しください。";
      },
    }),
    consumeSseStream: consumeStream,
  });
}
