import { sendWelcomeMessage } from "@/lib/line-notify";
import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

function authorize(request: NextRequest): boolean {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;
  return !!adminKey && key === adminKey;
}

// GET: welcome 未送信ユーザー一覧
export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("line_users")
    .select("id, owner_token, line_user_id, welcome_sent_at, created_at")
    .is("welcome_sent_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("welcome-status list error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ undelivered: data ?? [] });
}

// POST: 指定ユーザーへの welcome 再送
export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const lineUserId =
    typeof body.lineUserId === "string" ? body.lineUserId : null;
  if (!lineUserId) {
    return NextResponse.json(
      { error: "lineUserId required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("line_users")
    .select("owner_token")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (error) {
    console.error("line_users lookup error (resend):", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!data?.owner_token) {
    return NextResponse.json(
      { error: "lineUserId に紐付くレコードが見つかりません" },
      { status: 404 },
    );
  }

  const result = await sendWelcomeMessage(data.owner_token, lineUserId);

  return NextResponse.json({
    ok: result.success,
    statusCode: result.statusCode,
    error: result.error,
  });
}
