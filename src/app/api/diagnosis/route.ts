import crypto from "crypto";
import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { verifyBearer } from "@/lib/liff-verify";
import {
  sendDiagnosisCompleteMessage,
  sendWelcomeMessage,
} from "@/lib/line-notify";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { getModifierLabel } from "@/lib/modifier-data";
import {
  buildFullCode as buildFullCodeFromIds,
  classifyModifier,
} from "@/lib/diagnosis";
import type { BigFiveDimension, TorisetsuTypeId } from "@/lib/types";

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

  // Phase 3-β A-2: Authorization: Bearer <LIFF id_token> がついていれば
  // LINE userId を verify して users.line_user_id を埋める。
  // ヘッダ無し or verify 失敗時は LINE 未連携扱い (= 既存の web 単独診断と同じ動作)。
  // クライアント側 (LIFF 経由 /diagnosis) が後続フェーズで送るようになる予定。
  let lineUserId: string | null = null;
  const hasAuthHeader = !!request.headers.get("authorization");
  if (hasAuthHeader) {
    const verified = await verifyBearer(request);
    if (verified) {
      lineUserId = verified.sub;
    } else {
      // Bearer ヘッダはあるが verify 失敗 → 改ざんや期限切れの可能性。
      // 診断結果の保存自体は止めない (UX 優先)。LINE 紐付けはしないだけ。
      console.warn(
        "[api/diagnosis] LIFF id_token verify failed; falling back to web-only diagnosis",
      );
    }
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
      // Phase 3-β A-2: LIFF id_token から検証された LINE userId (未連携時は NULL)
      line_user_id: lineUserId,
    })
    .select("id, invite_code, owner_token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Phase 3-β A-2: LINE 連携済の再診断時、line_users.current_owner_token を最新に更新。
  // 該当 line_users 行が無いケース (= まだ /api/line-register を通っていない初回診断) は
  // 何もしない。後続で /line-register が新規 INSERT する流れに任せる。
  // race condition は last-write-wins で OK (同 lineUserId の同時診断は実運用ほぼ皆無)。
  if (lineUserId) {
    const { error: updateError } = await supabaseAdmin
      .from("line_users")
      .update({ current_owner_token: ownerToken })
      .eq("line_user_id", lineUserId);
    if (updateError) {
      // UPDATE 失敗しても診断結果自体は保存済み。warning のみ。
      console.warn(
        "[api/diagnosis] line_users.current_owner_token update failed:",
        updateError.message,
      );
    }
  }

  // Phase 3-β D-6: lineLinked 時は二段通知を fire-and-forget で発火
  //   1) Welcome (welcome_sent_at が NULL のとき = 初診断 or 再 follow リセット後)
  //   2) 3 秒後に DiagnosisComplete
  // 失敗時もレスポンスは止めない (`next/server` の after() で response 送信後に実行)
  if (lineUserId) {
    const persistedLineUserId = lineUserId;
    const persistedOwnerToken = data.owner_token as string;
    const persistedUserId = data.id as string;
    const persistedTypeId = typeId as TorisetsuTypeId;
    const persistedFullCode =
      (fullCode as string | undefined) ??
      deriveFullCode(persistedTypeId, scores as Record<BigFiveDimension, number>);
    const persistedTypeName =
      torisetsuTypes[persistedTypeId]?.name ?? persistedTypeId;
    const persistedModifierLabel =
      (modifierLabel as string | undefined) ??
      deriveModifierLabel(scores as Record<BigFiveDimension, number>);

    after(async () => {
      // 1 段目: Welcome (welcome_sent_at がまだなら送信、既送ならスキップ)
      try {
        const { data: lineUserRow } = await supabaseAdmin
          .from("line_users")
          .select("welcome_sent_at")
          .eq("line_user_id", persistedLineUserId)
          .maybeSingle();
        if (!lineUserRow?.welcome_sent_at) {
          await sendWelcomeMessage(persistedOwnerToken, persistedLineUserId);
        }
      } catch (err) {
        console.error("[api/diagnosis] welcome step error:", err);
      }

      // 3 秒インターバル
      await new Promise((r) => setTimeout(r, 3000));

      // 2 段目: DiagnosisComplete
      try {
        await sendDiagnosisCompleteMessage({
          ownerToken: persistedOwnerToken,
          lineUserId: persistedLineUserId,
          fullCode: persistedFullCode,
          typeName: persistedTypeName,
          modifierLabel: persistedModifierLabel,
          userId: persistedUserId,
        });
      } catch (err) {
        console.error("[api/diagnosis] diagnosis_complete step error:", err);
      }
    });
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
    lineLinked: !!lineUserId,
  });
}

// クライアントから fullCode/modifierLabel が来なかった場合の派生ヘルパー
// (sidecar 未設定の旧クライアント互換 + サーバ単独算出)
function deriveFullCode(
  typeId: TorisetsuTypeId,
  scores: Record<BigFiveDimension, number>,
): string {
  const safeScores: Record<BigFiveDimension, number> = {
    E: typeof scores.E === "number" ? scores.E : 5,
    A: typeof scores.A === "number" ? scores.A : 5,
    O: typeof scores.O === "number" ? scores.O : 5,
    C: typeof scores.C === "number" ? scores.C : 5,
    N: typeof scores.N === "number" ? scores.N : 5,
  };
  const { cModifier, nModifier } = classifyModifier(safeScores);
  return buildFullCodeFromIds(typeId, cModifier, nModifier);
}

function deriveModifierLabel(scores: Record<BigFiveDimension, number>): string {
  const safeScores: Record<BigFiveDimension, number> = {
    E: typeof scores.E === "number" ? scores.E : 5,
    A: typeof scores.A === "number" ? scores.A : 5,
    O: typeof scores.O === "number" ? scores.O : 5,
    C: typeof scores.C === "number" ? scores.C : 5,
    N: typeof scores.N === "number" ? scores.N : 5,
  };
  const { cModifier, nModifier } = classifyModifier(safeScores);
  return getModifierLabel(cModifier, nModifier);
}
