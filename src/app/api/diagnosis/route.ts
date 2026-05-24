// プレミアム化 v3 Day 4: 自己診断保存 + session 発行
//
// Cookie wn_session の有無で 2 経路:
//   - 既存 session (Cookie が有効): users 行を UPDATE (option A: 同 user_id 維持)
//     friend_perceptions / integrated_trisetsu との関連を保つため、新規 INSERT は
//     しない。invite_code と owner_token は新規生成 (新しいシェア URL として使う)
//   - 新規ユーザー (Cookie なし or DB 不一致): createSession で INSERT + Cookie set
//
// Cookie 偽造 (DB に存在しない session_token) 時は getSession が null を返すため
// 自動的に新規ユーザー扱いとなり、新しい session で Cookie を上書きする。

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { createSession, getSession } from "@/lib/session";

// PR-FIX-3 H6: Math.random() ではなく CSPRNG (crypto.randomBytes) を使用
function generateInviteCode(): string {
  return crypto.randomBytes(8).toString("base64url");
}
function generateOwnerToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export async function POST(request: NextRequest) {
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

  // Phase 2F: scores jsonb に v2 拡張フィールドをマージ
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

  // sourceInviteCode が指定された場合のみ source_user_id / generation を解決。
  // 再診断時は基本的に sourceInviteCode は付かないため UPDATE 経路では使わない。
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

  // ===== 既存 session の有無で分岐 =====
  const existing = await getSession(request);

  // ----- 既存ユーザー: UPDATE (同 user_id 維持) -----
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({
        type_id: typeId,
        scores: persistedScores,
        invite_code: inviteCode,
        owner_token: ownerToken,
        // display_name / campaign / source_user_id / generation / line_user_id /
        // email / email_verified_at / session_token は変更しない (再診断時の
        // user identity を保つ)。
      })
      .eq("id", existing.id)
      .select("id, invite_code, owner_token")
      .single();

    if (error) {
      console.error("[api/diagnosis] re-diagnosis UPDATE error:", error);
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
      lineLinked: !!existing.line_user_id,
      sessionMode: "updated",
    });
  }

  // ----- 新規ユーザー: createSession で INSERT + Cookie set -----
  try {
    const { user } = await createSession({
      type_id: typeId,
      scores: persistedScores,
      invite_code: inviteCode,
      owner_token: ownerToken,
      campaign: campaign || null,
      source_user_id: sourceUserId,
      generation,
    });

    return NextResponse.json({
      userId: user.id,
      inviteCode,
      ownerToken,
      typeId,
      scores,
      facetScores: facetScores ?? null,
      fullCode: fullCode ?? null,
      cModifier: cModifier ?? null,
      nModifier: nModifier ?? null,
      modifierLabel: modifierLabel ?? null,
      lineLinked: false,
      sessionMode: "created",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/diagnosis] createSession error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
