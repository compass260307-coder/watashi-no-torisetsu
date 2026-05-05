import { supabase } from "@/lib/supabase";
import { sendWelcomeMessage } from "@/lib/line-notify";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ownerToken = typeof body.ownerToken === "string" ? body.ownerToken : null;
    const lineUserId = typeof body.lineUserId === "string" ? body.lineUserId : null;

    if (!ownerToken || !lineUserId) {
      return NextResponse.json(
        { error: "ownerToken and lineUserId required" },
        { status: 400 },
      );
    }

    // 既存チェック: 既に登録済みなら welcome を送らない
    const { data: existing, error: lookupError } = await supabase
      .from("line_users")
      .select("id")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (lookupError) {
      console.error("line_users lookup error:", lookupError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    if (existing) {
      // 既に登録済み: owner_token を最新に更新するのみ、welcome はスキップ
      const { error: updateError } = await supabase
        .from("line_users")
        .update({ owner_token: ownerToken })
        .eq("line_user_id", lineUserId);

      if (updateError) {
        console.error("line_users update error:", updateError);
        return NextResponse.json({ error: "DB error" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, welcomed: false });
    }

    // 新規登録: insert + welcome
    const { error: insertError } = await supabase
      .from("line_users")
      .insert({ owner_token: ownerToken, line_user_id: lineUserId });

    if (insertError) {
      console.error("line_users insert error:", insertError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    // fire-and-forget: welcome message must not block the response
    sendWelcomeMessage(ownerToken, lineUserId).catch((err) =>
      console.error("sendWelcomeMessage error:", err),
    );

    return NextResponse.json({ ok: true, welcomed: true });
  } catch (err) {
    console.error("/api/line-register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
