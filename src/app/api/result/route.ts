import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const code = request.nextUrl.searchParams.get("code");

  if (!token && !code) {
    return NextResponse.json({ error: "Missing token or code" }, { status: 400 });
  }

  let query = supabase
    .from("users")
    .select("id, type_id, scores, invite_code, owner_token, display_name");

  if (token) {
    query = query.eq("owner_token", token);
  } else {
    query = query.eq("invite_code", code!);
  }

  const { data: user, error: userError } = await query.single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: friendAnswers } = await supabase
    .from("friend_answers")
    .select("id, answers, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    typeId: user.type_id,
    scores: user.scores,
    inviteCode: user.invite_code,
    ownerToken: user.owner_token ?? null,
    displayName: user.display_name ?? null,
    friendAnswers: friendAnswers ?? [],
    friendCount: friendAnswers?.length ?? 0,
  });
}
