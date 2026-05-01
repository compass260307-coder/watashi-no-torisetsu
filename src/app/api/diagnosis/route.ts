import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

function generateCode(length: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { typeId, scores, campaign, sourceInviteCode } = body;

  if (!typeId || !scores) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const inviteCode = generateCode(8);
  const ownerToken = generateCode(16);

  let sourceUserId: string | null = null;
  let generation: number | null = null;

  if (sourceInviteCode) {
    const { data: sourceUser } = await supabase
      .from("users")
      .select("id, generation")
      .eq("invite_code", sourceInviteCode)
      .single();
    if (sourceUser) {
      sourceUserId = sourceUser.id;
      generation = (sourceUser.generation ?? 0) + 1;
    }
  } else if (campaign) {
    generation = 0;
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      type_id: typeId,
      scores,
      invite_code: inviteCode,
      owner_token: ownerToken,
      campaign: campaign || null,
      source_user_id: sourceUserId,
      generation,
    })
    .select("id, invite_code, owner_token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    userId: data.id,
    inviteCode: data.invite_code,
    ownerToken: data.owner_token,
  });
}
