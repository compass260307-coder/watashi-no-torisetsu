import {
  notifyFriendAnswered,
  sendWelcomeMessage,
} from "@/lib/line-notify";
import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const ownerToken = typeof body.ownerToken === "string" ? body.ownerToken : null;
  const type = body.type as "welcome" | "friend_answered" | undefined;
  const friendCount =
    typeof body.friendCount === "number" ? body.friendCount : null;

  if (!ownerToken || !type) {
    return NextResponse.json(
      { error: "ownerToken and type required" },
      { status: 400 },
    );
  }

  const { data: user, error: userError } = await supabase
    .from("line_users")
    .select("line_user_id")
    .eq("owner_token", ownerToken)
    .maybeSingle();

  if (userError) {
    return NextResponse.json({ error: "DB lookup error" }, { status: 500 });
  }
  if (!user?.line_user_id) {
    return NextResponse.json(
      { error: "owner_token に紐付くLINEユーザーが見つかりません" },
      { status: 404 },
    );
  }

  if (type === "welcome") {
    await sendWelcomeMessage(ownerToken, user.line_user_id);
    return NextResponse.json({ ok: true, sent: "welcome" });
  }

  if (type === "friend_answered") {
    if (friendCount === null || friendCount < 1 || friendCount > 3) {
      return NextResponse.json(
        { error: "friendCount は 1〜3 を指定してください" },
        { status: 400 },
      );
    }
    await notifyFriendAnswered(ownerToken, friendCount);
    return NextResponse.json({ ok: true, sent: `friend_answered:${friendCount}` });
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
