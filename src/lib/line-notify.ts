import { messagingApi } from "@line/bot-sdk";
import { supabase } from "./supabase";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://watashi-no-torisetsu.vercel.app";

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

function buildMessage(friendCount: number, ownerToken: string): string | null {
  if (friendCount === 1) {
    return [
      "1人目の友達が回答してくれました🐧",
      "あと2人で詳細レポートが届きます",
    ].join("\n");
  }
  if (friendCount === 2) {
    return [
      "2人目の友達が回答してくれました🎉",
      "あと1人で詳細レポートが届きます🎁",
    ].join("\n");
  }
  if (friendCount === 3) {
    const reportUrl = `${PUBLIC_BASE_URL}/report/${ownerToken}`;
    return [
      "3人の友達からの回答が揃いました🎉",
      "あなたの詳細レポートが完成しました📖",
      "",
      "▼ こちらから確認できます",
      reportUrl,
    ].join("\n");
  }
  return null;
}

function buildWelcomeFlexMessage(inviteCode: string): messagingApi.Message {
  const liffShareIdRaw =
    process.env.NEXT_PUBLIC_LIFF_ID_SHARE ?? process.env.LIFF_ID_SHARE ?? "";
  const liffShareUrl = liffShareIdRaw
    ? `https://liff.line.me/${liffShareIdRaw}?inviteCode=${encodeURIComponent(inviteCode)}`
    : `${PUBLIC_BASE_URL}/friend/${inviteCode}`;

  return {
    type: "flex",
    altText: "ご登録ありがとうございます🐧 完全版を解放する3ステップ",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: `${PUBLIC_BASE_URL}/ogp-v3.png`,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "ご登録ありがとうございます🐧",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: "完全版を解放する3ステップ",
            weight: "bold",
            size: "sm",
            color: "#888888",
            margin: "md",
          },
          {
            type: "text",
            text: "1. 友達3人にシェア",
            size: "sm",
            margin: "sm",
            wrap: true,
          },
          {
            type: "text",
            text: "2. 友達が答えると順次通知",
            size: "sm",
            margin: "xs",
            wrap: true,
          },
          {
            type: "text",
            text: "3. 3人揃ったら詳細レポート🎁",
            size: "sm",
            margin: "xs",
            wrap: true,
          },
          {
            type: "text",
            text: "（友達は2分・10問で完了）",
            size: "xs",
            color: "#888888",
            margin: "md",
            wrap: true,
          },
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: "完全版に追加",
            weight: "bold",
            size: "xs",
            color: "#888888",
            margin: "md",
          },
          {
            type: "text",
            text: "深掘り解説の続き・友達評価レーダー・相性診断・自他ギャップなど",
            size: "xs",
            color: "#666666",
            wrap: true,
            margin: "xs",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: "友達にシェア",
              uri: liffShareUrl,
            },
            style: "primary",
            color: "#06C755",
            height: "md",
          },
        ],
      },
    },
  };
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

  const flex = buildWelcomeFlexMessage(data.invite_code as string);
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

export async function notifyFriendAnswered(
  ownerToken: string,
  friendCount: number,
): Promise<LineSendResult> {
  const text = buildMessage(friendCount, ownerToken);
  if (!text) return { success: false, error: "out_of_range" };

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
    { to: data.line_user_id, messages: [{ type: "text", text }] },
    {
      type: "notify",
      recipientId: data.line_user_id,
      metadata: { ownerToken, friendCount },
    },
  );
}
