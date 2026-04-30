import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const body = await request.json();
  const { inviteCode, displayName } = body;

  if (!inviteCode || typeof displayName !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const trimmed = displayName.trim().slice(0, 20);

  const { error } = await supabase
    .from("users")
    .update({ display_name: trimmed })
    .eq("invite_code", inviteCode);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, displayName: trimmed });
}
