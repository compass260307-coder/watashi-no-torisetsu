// Phase 3-β リリース 3 D-9: 友達評価依頼リマインド (Vercel Cron 経由、毎日 12:00 JST)
//
// 認可: Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` を付けて呼ぶ。
//
// 抽出ロジック (論点 7-b 採用: invite_code + friend_perceptions JOIN ベース):
//   - users.line_user_id IS NOT NULL (LINE 連携済)
//   - users.invite_code IS NOT NULL
//   - users.created_at: 3 日前以前、30 日前以内 (古すぎる招待は対象外)
//   - friend_perceptions が 1 件もない (target_user_id = users.id)
//   - notification_preferences.enable_reminder != false
//   - 過去 7 日に reminder_pending_eval を送っていない (スパム防止)
//
// 同 owner の users 行が複数 (再診断) ある場合は最新のみ対象 (current ownership 判定)。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  logLineMessage,
  type LineSendResult,
} from "@/lib/line-notify";
import { buildFriendEvalReminderFlex } from "@/lib/line-flex";
import { messagingApi } from "@line/bot-sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const REMINDER_MIN_AGE_DAYS = 3;
const REMINDER_MAX_AGE_DAYS = 30;
const REMINDER_COOLDOWN_DAYS = 7;

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

async function pushFlex(
  lineUserId: string,
  flex: messagingApi.Message,
): Promise<LineSendResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { success: false, error: "no_token" };
  }
  // Cron 内なので line-notify の send 関数経由ではなく、自前で送る
  // (notifyFriendAnswered パターンに合わせる)
  try {
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: token,
    });
    await client.pushMessage({ to: lineUserId, messages: [flex] });
    return { success: true };
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err
        ? ((err as { status?: unknown }).status as number | undefined)
        : undefined;
    return {
      success: false,
      statusCode: status,
      error:
        status === 403
          ? "user_unreachable"
          : status === 429
            ? "rate_limited"
            : status && status >= 500
              ? "line_service_error"
              : "unknown",
    };
  }
}

function resultToLogStatus(
  result: LineSendResult,
): "success" | "failed" | "blocked" | "rate_limited" {
  if (result.success) return "success";
  if (result.statusCode === 403) return "blocked";
  if (result.statusCode === 429) return "rate_limited";
  return "failed";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const minAge = new Date(now.getTime() - REMINDER_MIN_AGE_DAYS * 86400000);
  const maxAge = new Date(now.getTime() - REMINDER_MAX_AGE_DAYS * 86400000);
  const cooldownSince = new Date(
    now.getTime() - REMINDER_COOLDOWN_DAYS * 86400000,
  );

  // ===== 1. 候補 users 抽出 (3 日前以前 / 30 日前以内 / LINE 連携済 / invite_code あり) =====
  const { data: candidateUsers, error: usersErr } = await supabaseAdmin
    .from("users")
    .select("id, line_user_id, invite_code, display_name, created_at")
    .not("line_user_id", "is", null)
    .not("invite_code", "is", null)
    .lte("created_at", minAge.toISOString())
    .gte("created_at", maxAge.toISOString());
  if (usersErr) {
    console.error("[cron/remind] users lookup error:", usersErr);
    return NextResponse.json({ error: "DB error (users)" }, { status: 500 });
  }
  const candidates = candidateUsers ?? [];
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, errors: [] });
  }

  const candidateUserIds = candidates.map((u) => u.id as string);
  const candidateLineUserIds = Array.from(
    new Set(candidates.map((u) => u.line_user_id as string)),
  );

  // ===== 2. friend_perceptions ありの user_id を除外 set 化 =====
  const { data: perceptionTargets, error: pErr } = await supabaseAdmin
    .from("friend_perceptions")
    .select("target_user_id")
    .in("target_user_id", candidateUserIds);
  if (pErr) {
    console.error("[cron/remind] perceptions lookup error:", pErr);
    return NextResponse.json({ error: "DB error (perceptions)" }, { status: 500 });
  }
  const hasPerceptionSet = new Set(
    (perceptionTargets ?? []).map((r) => r.target_user_id as string),
  );

  // ===== 3. notification_preferences で reminder OFF の line_user_id =====
  const { data: prefsRows, error: prefsErr } = await supabaseAdmin
    .from("notification_preferences")
    .select("line_user_id, enable_reminder")
    .in("line_user_id", candidateLineUserIds);
  if (prefsErr) {
    console.error("[cron/remind] prefs lookup error:", prefsErr);
    return NextResponse.json({ error: "DB error (prefs)" }, { status: 500 });
  }
  const reminderDisabledSet = new Set(
    (prefsRows ?? [])
      .filter((r) => r.enable_reminder === false)
      .map((r) => r.line_user_id as string),
  );

  // ===== 4. 過去 7 日に reminder_pending_eval を送った line_user_id =====
  const { data: recentReminders, error: lmsErr } = await supabaseAdmin
    .from("line_messages_sent")
    .select("line_user_id")
    .eq("message_type", "reminder_pending_eval")
    .gte("sent_at", cooldownSince.toISOString())
    .in("line_user_id", candidateLineUserIds);
  if (lmsErr) {
    console.error("[cron/remind] line_messages_sent lookup error:", lmsErr);
    return NextResponse.json({ error: "DB error (lms)" }, { status: 500 });
  }
  const recentRemindSet = new Set(
    (recentReminders ?? []).map((r) => r.line_user_id as string),
  );

  // ===== 5. 同 owner の最新 users 行に絞る (再診断ユーザー対策) =====
  //    候補内で line_user_id 単位で最新の users 行のみ残す。
  const latestByLineUserId = new Map<
    string,
    { id: string; line_user_id: string; created_at: string }
  >();
  for (const u of candidates) {
    const lid = u.line_user_id as string;
    const existing = latestByLineUserId.get(lid);
    if (
      !existing ||
      new Date(u.created_at as string) > new Date(existing.created_at)
    ) {
      latestByLineUserId.set(lid, {
        id: u.id as string,
        line_user_id: lid,
        created_at: u.created_at as string,
      });
    }
  }

  // ===== 6. 各候補のフィルタリング + 通知発火 =====
  let processedCount = 0;
  let sentCount = 0;
  const errors: Array<{ lineUserId: string; reason: string }> = [];

  for (const { id: userId, line_user_id: lineUserId } of latestByLineUserId.values()) {
    processedCount++;

    if (hasPerceptionSet.has(userId)) continue;
    if (reminderDisabledSet.has(lineUserId)) continue;
    if (recentRemindSet.has(lineUserId)) continue;

    const flex = buildFriendEvalReminderFlex();
    const result = await pushFlex(lineUserId, flex);

    await logLineMessage({
      lineUserId,
      userId,
      messageType: "reminder_pending_eval",
      flexContent: flex,
      sendResult: resultToLogStatus(result),
      errorDetail: result.error ?? null,
    });

    if (result.success) {
      sentCount++;
    } else {
      errors.push({
        lineUserId: lineUserId.slice(0, 8) + "...",
        reason: result.error ?? "unknown",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processedCount,
    sent: sentCount,
    errors,
  });
}
