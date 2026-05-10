import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const body = await request.json();
  const { ownerToken, displayName } = body;

  // PR-FIX-3 H4: invite_code 単体での書換禁止、ownerToken 必須化
  if (typeof ownerToken !== "string" || !ownerToken) {
    return NextResponse.json(
      { error: "ownerToken is required" },
      { status: 400 },
    );
  }
  if (typeof displayName !== "string") {
    return NextResponse.json(
      { error: "displayName is required" },
      { status: 400 },
    );
  }

  const trimmed = displayName.trim().slice(0, 20);

  const { error } = await supabaseAdmin
    .from("users")
    .update({ display_name: trimmed })
    .eq("owner_token", ownerToken);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, displayName: trimmed });
}
