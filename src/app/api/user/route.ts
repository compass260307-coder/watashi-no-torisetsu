import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const body = await request.json();
  const { inviteCode, ownerToken, displayName } = body;

  if ((!inviteCode && !ownerToken) || typeof displayName !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const trimmed = displayName.trim().slice(0, 20);

  let query = supabase.from("users").update({ display_name: trimmed });

  if (ownerToken) {
    query = query.eq("owner_token", ownerToken);
  } else {
    query = query.eq("invite_code", inviteCode);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, displayName: trimmed });
}
