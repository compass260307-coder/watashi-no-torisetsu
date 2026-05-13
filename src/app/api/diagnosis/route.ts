import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { NextResponse } from "next/server";

// PR-FIX-3 H6: Math.random() ではなく CSPRNG (crypto.randomBytes) を使用
function generateInviteCode(): string {
  return crypto.randomBytes(8).toString("base64url");
}
function generateOwnerToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const body = await request.json();
  const {
    typeId,
    scores,
    facetScores,
    fullCode,
    cModifier,
    nModifier,
    modifierLabel,
    campaign,
    sourceInviteCode,
  } = body;

  if (!typeId || !scores) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Phase 2F: scores jsonb に v2 拡張フィールドをマージして 1 カラムに永続化
  // (DB スキーマは jsonb のままで OK)。レガシー読み出し側は 5 dim キーだけ参照するため安全。
  const persistedScores = {
    ...scores,
    ...(facetScores ? { facetScores } : {}),
    ...(fullCode ? { fullCode } : {}),
    ...(cModifier ? { cModifier } : {}),
    ...(nModifier ? { nModifier } : {}),
    ...(modifierLabel ? { modifierLabel } : {}),
  };

  const inviteCode = generateInviteCode();
  const ownerToken = generateOwnerToken();

  let sourceUserId: string | null = null;
  let generation: number | null = null;

  if (sourceInviteCode) {
    const { data: sourceUser } = await supabaseAdmin
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

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      type_id: typeId,
      scores: persistedScores,
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
    typeId,
    scores,
    facetScores: facetScores ?? null,
    fullCode: fullCode ?? null,
    cModifier: cModifier ?? null,
    nModifier: nModifier ?? null,
    modifierLabel: modifierLabel ?? null,
  });
}
