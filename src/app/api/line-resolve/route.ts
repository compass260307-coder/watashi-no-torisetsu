import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyBearer } from "@/lib/liff-verify";
import { NextRequest, NextResponse } from "next/server";

// LIFF クライアントから Authorization: Bearer <id_token> で呼び出す。
// 検証された LINE userId に紐付く owner_token / display_name / invite_code を返す。
export async function GET(request: NextRequest) {
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lineUserId = verified.sub;

  const { data: lineUserRow, error: lineUserErr } = await supabaseAdmin
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

  const { data: userRow, error: userErr } = await supabaseAdmin
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
