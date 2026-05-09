import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

// LINE userId から紐付け済みの owner 情報を解決する
// share LIFF をパラメータ無しで開いた際 (リッチメニュー経由など) に使う
export async function GET(request: NextRequest) {
  const lineUserId = request.nextUrl.searchParams.get("lineUserId");

  if (!lineUserId) {
    return NextResponse.json(
      { error: "lineUserId required" },
      { status: 400 },
    );
  }

  // line_users → owner_token を取得
  const { data: lineUserRow, error: lineUserErr } = await supabase
    .from("line_users")
    .select("owner_token")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (lineUserErr) {
    console.error("line-resolve line_users lookup error:", lineUserErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!lineUserRow?.owner_token) {
    return NextResponse.json({
      ownerToken: null,
      displayName: null,
      inviteCode: null,
    });
  }

  // users → display_name + invite_code を取得
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("display_name, invite_code")
    .eq("owner_token", lineUserRow.owner_token)
    .maybeSingle();

  if (userErr) {
    console.error("line-resolve users lookup error:", userErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({
    ownerToken: lineUserRow.owner_token,
    displayName: userRow?.display_name ?? null,
    inviteCode: userRow?.invite_code ?? null,
  });
}
