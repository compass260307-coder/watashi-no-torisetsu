import { supabase } from "@/lib/supabase";
import { buildReportData } from "@/lib/report-data";
import type { BigFiveDimension, TorisetsuTypeId } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, type_id, scores, owner_token")
    .eq("owner_token", token)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: friendAnswers } = await supabase
    .from("friend_answers")
    .select("answers, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const report = buildReportData({
    ownerToken: user.owner_token as string,
    typeId: user.type_id as TorisetsuTypeId,
    selfScores: user.scores as Record<BigFiveDimension, number>,
    friendAnswers: friendAnswers ?? [],
  });

  return NextResponse.json(report);
}
