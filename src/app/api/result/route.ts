import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const inviteCode = request.nextUrl.searchParams.get("code");

  if (!inviteCode) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, type_id, scores, invite_code, display_name")
    .eq("invite_code", inviteCode)
    .single();

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
    displayName: user.display_name ?? null,
    friendAnswers: friendAnswers ?? [],
    friendCount: friendAnswers?.length ?? 0,
  });
}
