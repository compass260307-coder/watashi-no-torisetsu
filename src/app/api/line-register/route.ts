import { supabase } from "@/lib/supabase";
import { sendWelcomeMessage } from "@/lib/line-notify";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ownerToken = typeof body.ownerToken === "string" ? body.ownerToken : null;
    const lineUserId = typeof body.lineUserId === "string" ? body.lineUserId : null;
    const displayNameRaw =
      typeof body.displayName === "string" ? body.displayName.trim() : "";
    const displayName = displayNameRaw.length > 0 ? displayNameRaw : null;

    if (!ownerToken || !lineUserId) {
      return NextResponse.json(
        { error: "ownerToken and lineUserId required" },
        { status: 400 },
      );
    }

    // users.display_name は既存値を尊重し、未設定 (null/空) の場合のみ LIFF displayName で更新
    if (displayName) {
      const { data: userRow, error: userLookupError } = await supabase
        .from("users")
        .select("display_name")
        .eq("owner_token", ownerToken)
        .maybeSingle();

      if (userLookupError) {
        console.error("users lookup error (display_name):", userLookupError);
      } else if (userRow && !userRow.display_name) {
        const { error: nameUpdateError } = await supabase
          .from("users")
          .update({ display_name: displayName })
          .eq("owner_token", ownerToken);
        if (nameUpdateError) {
          console.error("users update error (display_name):", nameUpdateError);
          // 失敗しても LINE 登録自体は続ける
        }
      }
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
