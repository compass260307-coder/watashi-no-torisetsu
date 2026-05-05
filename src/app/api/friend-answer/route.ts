import { supabase } from "@/lib/supabase";
import { notifyFriendAnswered } from "@/lib/line-notify";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { inviteCode, answers } = body;

  if (!inviteCode || !answers) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, owner_token")
    .eq("invite_code", inviteCode)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("friend_answers")
    .insert({ user_id: user.id, answers });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (user.owner_token) {
    const { count } = await supabase
      .from("friend_answers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // fire-and-forget: notification failures must not break the response
    notifyFriendAnswered(user.owner_token, count ?? 0).catch((err) =>
      console.error("notifyFriendAnswered error:", err),
    );
  }

  return NextResponse.json({ success: true });
}
