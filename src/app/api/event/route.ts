import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { eventName, sessionId, inviteCode, ownerToken, metadata } = body;

  if (!eventName || typeof eventName !== "string") {
    return NextResponse.json({ error: "Missing eventName" }, { status: 400 });
  }

  await supabase.from("events").insert({
    event_name: eventName,
    session_id: sessionId ?? null,
    invite_code: inviteCode ?? null,
    owner_token: ownerToken ?? null,
    metadata: metadata ?? {},
  });

  return NextResponse.json({ ok: true });
}
