import { messagingApi } from "@line/bot-sdk";
import { supabaseAdmin } from "./supabase-server";
import {
  buildDiagnosisCompleteFlex,
  buildWelcomeRegisteredFlex,
  buildWelcomeUnregisteredFlex,
  buildN1Flex,
  buildN2Flex,
  buildN3Flex,
} from "./line-flex";
import {
  buildFullCode as buildFullCodeFromIds,
  classifyModifier,
} from "./diagnosis";
import { torisetsuTypes } from "./torisetsu-data";
import type { BigFiveDimension, TorisetsuTypeId } from "./types";

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

// Phase 3-β D-5/D-6/D-8: 送信履歴を line_messages_sent に記録する共通 helper
// 各 send 関数の末尾で呼ぶ。失敗してもログのみで黙殺 (push 自体の成否を上書きしない)。
export type LogLineMessageInput = {
  lineUserId: string;
  userId?: string | null;
  messageType: string;        // 'welcome' | 'diagnosis_complete' | 'friend_perception_received' | 'reminder_pending_eval' | 'broadcast' | 'integrated_complete' 等
  messageSubtype?: string | null; // 例: 'N1' / 'N2' / 'N3' / 'invited'
  flexContent?: unknown;       // 送ったメッセージの中身 (jsonb)
  sendResult: "success" | "failed" | "blocked" | "rate_limited" | "skipped";
  errorDetail?: string | null;
};

export async function logLineMessage(input: LogLineMessageInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("line_messages_sent").insert({
      line_user_id: input.lineUserId,
      user_id: input.userId ?? null,
      message_type: input.messageType,
      message_subtype: input.messageSubtype ?? null,
      flex_content: (input.flexContent as object) ?? null,
      send_result: input.sendResult,
      error_detail: input.errorDetail ?? null,
    });
    if (error) {
      console.error("[logLineMessage] insert error:", error.message);
    }
  } catch (err) {
    console.error("[logLineMessage] unexpected error:", err);
  }
}

// 内部: LineSendResult → log 用の send_result 文字列
function resultToLogStatus(
  result: LineSendResult,
): "success" | "failed" | "blocked" | "rate_limited" {
  if (result.success) return "success";
  if (result.statusCode === 403) return "blocked";
  if (result.statusCode === 429) return "rate_limited";
  return "failed";
}

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

// Phase 3-β D-5/D-7: 拡張版 sendWelcomeMessage
// - users から type_id + scores を SELECT して fullCode/typeName を Flex に注入 (D-5)
// - source_user_id があれば招待元 (display_name + invite_code) を取得し、inviter として
//   Flex に渡す → buildWelcomeRegisteredFlex 側で逆向き評価 CTA を組み立てる (D-7)
// - line_messages_sent に記録
//
// 内部派生: scores.fullCode sidecar 優先、なければ classifyModifier + buildFullCode
//          (Phase 2F 以前の行 / sidecar 未登録のレガシー対応)

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
};

export async function sendWelcomeMessage(
  ownerToken: string,
  lineUserId: string,
): Promise<LineSendResult> {
  const client = getClient();
  if (!client) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping welcome");
    await logLineMessage({
      lineUserId,
      messageType: "welcome",
      messageSubtype: "registered",
      sendResult: "skipped",
      errorDetail: "no_token",
    });
    return { success: false, error: "no_token" };
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, invite_code, type_id, scores, source_user_id")
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

  // 1) fullCode / typeName 取得 (sidecar 優先、フォールバックでサーバ派生)
  const typeId = data.type_id as TorisetsuTypeId;
  const typeName = torisetsuTypes[typeId]?.name ?? typeId;
  const stored = (data.scores ?? {}) as StoredScores;
  let fullCode: string | undefined = stored.fullCode;
  if (!fullCode) {
    const dimScores: Record<BigFiveDimension, number> = {
      E: typeof stored.E === "number" ? stored.E : 5,
      A: typeof stored.A === "number" ? stored.A : 5,
      O: typeof stored.O === "number" ? stored.O : 5,
      C: typeof stored.C === "number" ? stored.C : 5,
      N: typeof stored.N === "number" ? stored.N : 5,
    };
    const { cModifier, nModifier } = classifyModifier(dimScores);
    fullCode = buildFullCodeFromIds(typeId, cModifier, nModifier);
  }

  // 2) 招待経由判定: source_user_id があれば招待元情報を取得 (D-7)
  let inviter: { name: string; inviteCode: string } | undefined;
  let logSubtype = "registered";
  if (data.source_user_id) {
    const { data: inviterRow, error: inviterErr } = await supabaseAdmin
      .from("users")
      .select("display_name, invite_code")
      .eq("id", data.source_user_id as string)
      .maybeSingle();
    if (inviterErr) {
      console.error("inviter lookup error:", inviterErr);
      // 続行 (招待元不明として通常 Welcome に fallback)
    } else if (inviterRow?.invite_code) {
      inviter = {
        name:
          (inviterRow.display_name as string | null)?.trim() || "招待してくれた人",
        inviteCode: inviterRow.invite_code as string,
      };
      logSubtype = "invited";
    }
  }

  const flex = buildWelcomeRegisteredFlex(data.invite_code as string, {
    fullCode,
    typeName,
    inviter,
  });
  const result = await sendWithErrorHandling(
    client,
    { to: lineUserId, messages: [flex] },
    {
      type: "welcome",
      recipientId: lineUserId,
      metadata: { ownerToken, hasInviter: !!inviter },
    },
  );

  if (result.success) {
    const { error: updateError } = await supabaseAdmin
      .from("line_users")
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq("line_user_id", lineUserId);
    if (updateError) {
      console.error("welcome_sent_at update error:", updateError);
      // welcome 自体は成功なので success: true のまま返す
    }
  }

  await logLineMessage({
    lineUserId,
    userId: (data.id as string | null) ?? null,
    messageType: "welcome",
    messageSubtype: logSubtype,
    flexContent: flex,
    sendResult: resultToLogStatus(result),
    errorDetail: result.error ?? null,
  });

  return result;
}

// 紐付けなしユーザー (LIFF 経由せず直接 bot 追加) 向けの welcome Flex
export async function sendGenericWelcome(
  lineUserId: string,
): Promise<LineSendResult> {
  const client = getClient();
  if (!client) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping generic welcome");
    await logLineMessage({
      lineUserId,
      messageType: "welcome",
      messageSubtype: "generic",
      sendResult: "skipped",
      errorDetail: "no_token",
    });
    return { success: false, error: "no_token" };
  }

  const flex = buildWelcomeUnregisteredFlex();
  const result = await sendWithErrorHandling(
    client,
    { to: lineUserId, messages: [flex] },
    { type: "welcome", recipientId: lineUserId, metadata: { generic: true } },
  );

  await logLineMessage({
    lineUserId,
    messageType: "welcome",
    messageSubtype: "generic",
    flexContent: flex,
    sendResult: resultToLogStatus(result),
    errorDetail: result.error ?? null,
  });
  return result;
}

// Phase 3-β D-6: 診断完了通知 (二段通知の 2 段目、Welcome の 3 秒後に送る)
//   - 入力は明示引数 (ownerToken, lineUserId, fullCode, typeName, modifierLabel, userId?)
//   - Welcome と異なり、welcome_sent_at の更新等の副作用は持たない
//   - line_messages_sent に message_type='diagnosis_complete' で記録
export async function sendDiagnosisCompleteMessage(args: {
  ownerToken: string;
  lineUserId: string;
  fullCode: string;
  typeName: string;
  modifierLabel: string;
  userId?: string | null;
}): Promise<LineSendResult> {
  const client = getClient();
  if (!client) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN not set; skipping diagnosis_complete");
    await logLineMessage({
      lineUserId: args.lineUserId,
      userId: args.userId ?? null,
      messageType: "diagnosis_complete",
      sendResult: "skipped",
      errorDetail: "no_token",
    });
    return { success: false, error: "no_token" };
  }

  const flex = buildDiagnosisCompleteFlex({
    ownerToken: args.ownerToken,
    fullCode: args.fullCode,
    typeName: args.typeName,
    modifierLabel: args.modifierLabel,
  });
  const result = await sendWithErrorHandling(
    client,
    { to: args.lineUserId, messages: [flex] },
    {
      type: "notify",
      recipientId: args.lineUserId,
      metadata: { ownerToken: args.ownerToken, kind: "diagnosis_complete" },
    },
  );

  await logLineMessage({
    lineUserId: args.lineUserId,
    userId: args.userId ?? null,
    messageType: "diagnosis_complete",
    flexContent: flex,
    sendResult: resultToLogStatus(result),
    errorDetail: result.error ?? null,
  });
  return result;
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
  const subtype = `N${friendCount}`;
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

  const { data, error } = await supabaseAdmin
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

  const result = await sendWithErrorHandling(
    client,
    { to: data.line_user_id, messages: [flex] },
    {
      type: "notify",
      recipientId: data.line_user_id,
      metadata: { ownerToken, friendCount },
    },
  );

  await logLineMessage({
    lineUserId: data.line_user_id as string,
    messageType: "friend_perception_received",
    messageSubtype: subtype,
    flexContent: flex,
    sendResult: resultToLogStatus(result),
    errorDetail: result.error ?? null,
  });
  return result;
}
