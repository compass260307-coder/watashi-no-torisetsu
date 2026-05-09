import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWelcomeMessage, sendGenericWelcome } from "@/lib/line-notify";

// LINE Webhook の follow イベントをシミュレートして welcome 送信フローを検証する
// 本物の webhook と同じロジックを通すが、署名検証は省略
//
// 使い方: POST /api/admin/simulate-follow with { lineUserId, resetWelcome?: boolean }
//   resetWelcome: true にすると welcome_sent_at を NULL に戻してから送信する
export async function POST(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const lineUserId =
    typeof body.lineUserId === "string" ? body.lineUserId : null;
  const resetWelcome = body.resetWelcome === true;

  if (!lineUserId) {
    return NextResponse.json(
      { error: "lineUserId required" },
      { status: 400 },
    );
  }

  const trace: Record<string, unknown> = {
    lineUserId: lineUserId.slice(0, 10) + "...",
    resetWelcome,
    steps: [] as string[],
  };
  const steps = trace.steps as string[];

  // env チェック
  trace.env = {
    LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET: !!process.env.LINE_CHANNEL_SECRET,
    NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_LIFF_ID_SHARE: !!process.env.NEXT_PUBLIC_LIFF_ID_SHARE,
  };
  steps.push("env-check-done");

  if (resetWelcome) {
    const { error: resetError } = await supabase
      .from("line_users")
      .update({ welcome_sent_at: null })
      .eq("line_user_id", lineUserId);
    if (resetError) {
      trace.resetError = resetError.message;
      steps.push("reset-failed");
    } else {
      steps.push("reset-ok");
    }
  }

  // line_users 検索
  const { data, error: lookupError } = await supabase
    .from("line_users")
    .select("owner_token, welcome_sent_at, created_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (lookupError) {
    trace.lookupError = lookupError.message;
    steps.push("lookup-failed");
    return NextResponse.json({ ok: false, trace }, { status: 500 });
  }

  if (!data) {
    steps.push("no-line-users-row");
    trace.action = "would-send-generic-welcome";
    const result = await sendGenericWelcome(lineUserId);
    trace.sendResult = result;
    steps.push(result.success ? "generic-welcome-sent" : "generic-welcome-failed");
    return NextResponse.json({ ok: result.success, trace });
  }

  trace.lineUsersRow = {
    owner_token: (data.owner_token as string)?.slice(0, 8) + "...",
    welcome_sent_at: data.welcome_sent_at,
    created_at: data.created_at,
  };
  steps.push("line-users-row-found");

  if (data.welcome_sent_at) {
    steps.push("already-sent-skipping");
    trace.action = "skip-already-sent";
    trace.hint =
      "welcome_sent_at がセットされているため重複送信防止でスキップ。再送するには resetWelcome: true を指定してください。";
    return NextResponse.json({ ok: false, trace });
  }

  // welcome 送信
  steps.push("calling-sendWelcomeMessage");
  const result = await sendWelcomeMessage(
    data.owner_token as string,
    lineUserId,
  );
  trace.sendResult = result;
  steps.push(result.success ? "welcome-sent" : "welcome-failed");

  return NextResponse.json({ ok: result.success, trace });
}
