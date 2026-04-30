import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const inviteCode = request.nextUrl.searchParams.get("code");

  if (!inviteCode) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("display_name")
    .eq("invite_code", inviteCode)
    .single();

  if (error || !data) {
    return NextResponse.json({ displayName: null });
  }

  return NextResponse.json({ displayName: data.display_name ?? null });
}
