// プレミアム化 v3 Day 3: 自己診断保存 (Web ファースト版、認可なし版)
//
// 旧: Authorization: Bearer <LIFF id_token> を任意で受け取り users.line_user_id に保存。
// 新: LIFF 認可を完全に削除。Web ファーストでは line_user_id=NULL で INSERT のみ。
//
// 注: Day 4 で createSession (src/lib/session) と統合予定。
// 現状はまだ users INSERT のままで、session_token はセットしない。
// この状態だと、診断後の保護 API は 401 を返す (cookie 未発行のため)。
// Day 4 で「診断完了 = session 発行」に繋ぎ込む。

import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";

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
      // Day 4 で createSession に置き換え予定。それまでは line_user_id=NULL の Web 単独行。
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
    lineLinked: false, // Day 3 で常時 false に固定 (Phase 2 で復活)
  });
}
