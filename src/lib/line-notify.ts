import { messagingApi } from "@line/bot-sdk";
import { supabase } from "./supabase";
import {
  buildWelcomeRegisteredFlex,
  buildWelcomeUnregisteredFlex,
  buildN1Flex,
  buildN2Flex,
  buildN3Flex,
} from "./line-flex";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

let cachedClient: messagingApi.MessagingApiClient | null = null;
function getClient(): messagingApi.MessagingApiClient | null {
  if (!channelAccessToken) return null;
  if (!cachedClient) {
    cachedClient = new messagingApi.MessagingApiClient({ channelAccessToken });
  }
  return cachedClient;
}

export type LineSendResult = {
  success: boolean;
  statusCode?: number;
  error?: string;
};

function getErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SendContext = {
  type: "welcome" | "notify";
  recipientId: string;
  metadata?: Record<string, unknown>;
};

async function sendWithErrorHandling(
  client: messagingApi.MessagingApiClient,
  pushParams: messagingApi.PushMessageRequest,
  context: SendContext,
): Promise<LineSendResult> {
  try {
    await client.pushMessage(pushParams);
    return { success: true };
  } catch (err) {
    const status = getErrorStatus(err);
    const ctxLabel = `[LINE ${context.type}]`;

    if (status === 400) {
      console.error(`${ctxLabel} 400 Bad message format`, {
        context,
        error: String(err),
      });
      return { success: false, statusCode: 400, error: "bad_format" };
    }

    if (status === 401) {
      console.error(
        `${ctxLabel} 401 Token invalid/expired - URGENT (要 LINE_CHANNEL_ACCESS_TOKEN 確認)`,
        { context },
      );
      return { success: false, statusCode: 401, error: "auth_failed" };
    }

    if (status === 403) {
      console.warn(`${ctxLabel} 403 User blocked or not friend`, { context });
      return { success: false, statusCode: 403, error: "user_unreachable" };
    }

    if (status === 429) {
      console.warn(`${ctxLabel} 429 Rate limited, retrying once`, { context });
      await sleep(2000);
      try {
        await client.pushMessage(pushParams);
        return { success: true };
      } catch (retryErr) {
        const retryStatus = getErrorStatus(retryErr);
        console.error(`${ctxLabel} 429 retry also failed`, {
          context,
          retryStatus,
        });
        return {
          success: false,
          statusCode: retryStatus ?? 429,
          error: "rate_limited",
        };
      }
    }

    if (status !== undefined && status >= 500) {
      console.error(`${ctxLabel} ${status} LINE service error`, { context });
      return {
        success: false,
        statusCode: status,
        error: "line_service_error",
      };
    }

    console.error(`${ctxLabel} Unknown error`, { context, error: String(err) });
    return { success: false, error: "unknown" };
  }
}

export async function sendWelcomeMessage(
  ownerToken: string,
  lineUserId: string,
): Promise<LineSendResult> {
  const client = getClient();
  if (!client) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping welcome");
    return { success: false, error: "no_token" };
  }

  const { data, error } = await supabase
    .from("users")
    .select("invite_code")
    .eq("owner_token", ownerToken)
    .maybeSingle();

  if (error) {
    console.error("users lookup error (welcome):", error);
    return { success: false, error: "db_lookup_error" };
  }
  if (!data?.invite_code) {
    console.warn("invite_code not found for owner_token:", ownerToken);
    return { success: false, error: "invite_code_not_found" };
  }

  const flex = buildWelcomeRegisteredFlex(data.invite_code as string);
  const result = await sendWithErrorHandling(
    client,
    { to: lineUserId, messages: [flex] },
    { type: "welcome", recipientId: lineUserId, metadata: { ownerToken } },
  );

  if (result.success) {
    const { error: updateError } = await supabase
      .from("line_users")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("line_user_id", lineUserId);
    if (updateError) {
      console.error("welcome_sent_at update error:", updateError);
      // welcome 自体は成功なので success: true のまま返す
    }
  }

  return result;
}

// 紐付けなしユーザー (LIFF 経由せず直接 bot 追加) 向けの welcome Flex
export async function sendGenericWelcome(
  lineUserId: string,
): Promise<LineSendResult> {
  const client = getClient();
  if (!client) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping generic welcome");
    return { success: false, error: "no_token" };
  }

  const flex = buildWelcomeUnregisteredFlex();
  return sendWithErrorHandling(
    client,
    { to: lineUserId, messages: [flex] },
    { type: "welcome", recipientId: lineUserId, metadata: { generic: true } },
  );
}

// webhook の reply token を使った reply 専用ヘルパー (push と異なり 1 度しか使えない)
export async function replyToLine(
  replyToken: string,
  messages: messagingApi.Message[],
  metadata?: Record<string, unknown>,
): Promise<LineSendResult> {
  const client = getClient();
  if (!client) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping reply");
    return { success: false, error: "no_token" };
  }

  try {
    await client.replyMessage({ replyToken, messages });
    return { success: true };
  } catch (err) {
    const status = getErrorStatus(err);
    console.error("[LINE reply] error", {
      status,
      metadata,
      error: String(err),
    });
    return {
      success: false,
      statusCode: status,
      error: status ? `http_${status}` : "unknown",
    };
  }
}

export async function notifyFriendAnswered(
  ownerToken: string,
  friendCount: number,
): Promise<LineSendResult> {
  let flex: messagingApi.Message | null = null;
  if (friendCount === 1) flex = buildN1Flex(ownerToken);
  else if (friendCount === 2) flex = buildN2Flex(ownerToken);
  else if (friendCount === 3) flex = buildN3Flex(ownerToken);
  // friendCount === 0 や 4+ は通知対象外 (silent skip)
  if (!flex) return { success: false, error: "out_of_range" };

  const client = getClient();
  if (!client) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping notify");
    return { success: false, error: "no_token" };
  }

  const { data, error } = await supabase
    .from("line_users")
    .select("line_user_id")
    .eq("owner_token", ownerToken)
    .maybeSingle();

  if (error) {
    console.error("line_users lookup error:", error);
    return { success: false, error: "db_lookup_error" };
  }
  if (!data?.line_user_id) {
    // user has not registered LINE yet — silently skip
    return { success: false, error: "no_line_user" };
  }

  return sendWithErrorHandling(
    client,
    { to: data.line_user_id, messages: [flex] },
    {
      type: "notify",
      recipientId: data.line_user_id,
      metadata: { ownerToken, friendCount },
    },
  );
}
