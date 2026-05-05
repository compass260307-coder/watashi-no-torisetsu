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

    const { error } = await supabase
      .from("line_users")
      .upsert(
        { owner_token: ownerToken, line_user_id: lineUserId },
        { onConflict: "line_user_id" },
      );

    if (error) {
      console.error("line_users upsert error:", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    // fire-and-forget: welcome message must not block the response
    sendWelcomeMessage(ownerToken, lineUserId).catch((err) =>
      console.error("sendWelcomeMessage error:", err),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/line-register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
