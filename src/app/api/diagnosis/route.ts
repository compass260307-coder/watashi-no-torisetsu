import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

function generateInviteCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { typeId, scores } = body;

  if (!typeId || !scores) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const inviteCode = generateInviteCode();

  const { data, error } = await supabase
    .from("users")
    .insert({ type_id: typeId, scores, invite_code: inviteCode })
    .select("id, invite_code")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ userId: data.id, inviteCode: data.invite_code });
}
