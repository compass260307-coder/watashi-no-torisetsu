// プレミアム化 v3 Day 3: マイ図鑑のデータ取得 API (Web ファースト版)
//
// 認可: Cookie wn_session → users 行を直接解決
// (旧: Authorization: Bearer <LIFF id_token>)
//
// 取得対象:
//   1. current = session の users 行から導出
//   2. past[] = 同一ユーザーの過去診断 (Web ファースト Day 3 では空配列。
//      Day 4 以降で「再診断時に旧 users 行へのリンクを残す」設計を入れる予定)
//   3. friend_perceptions: target_user_id = session.user.id
//   4. integrated_trisetsu: user_id = session.user.id

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { buildFullCode, classifyModifier } from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type {
  BigFiveDimension,
  CModifier,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";

export const runtime = "nodejs";

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
};

type UserRow = {
  id: string;
  owner_token: string | null;
  type_id: string;
  scores: StoredScores | null;
  display_name: string | null;
  created_at: string;
};

type DiagnosisCard = {
  userId: string;
  ownerToken: string | null;
  typeId: TorisetsuTypeId;
  typeName: string;
  typeColor: string;
  fullCode: string;
  modifierLabel: string;
  diagnosedAt: string;
};

function deriveDiagnosisCard(row: UserRow): DiagnosisCard {
  const typeId = row.type_id as TorisetsuTypeId;
  const typeMeta = torisetsuTypes[typeId];
  const stored = (row.scores ?? {}) as StoredScores;

  let fullCode = stored.fullCode ?? null;
  let modifierLabel = stored.modifierLabel ?? null;
  if (!fullCode || !modifierLabel) {
    const dimScores: Record<BigFiveDimension, number> = {
      E: typeof stored.E === "number" ? stored.E : 5,
      A: typeof stored.A === "number" ? stored.A : 5,
      O: typeof stored.O === "number" ? stored.O : 5,
      C: typeof stored.C === "number" ? stored.C : 5,
      N: typeof stored.N === "number" ? stored.N : 5,
    };
    const { cModifier, nModifier } = classifyModifier(dimScores);
    fullCode = stored.fullCode ?? buildFullCode(typeId, cModifier, nModifier);
    modifierLabel =
      stored.modifierLabel ?? getModifierLabel(cModifier, nModifier);
  }

  return {
    userId: row.id,
    ownerToken: row.owner_token,
    typeId,
    typeName: typeMeta?.name ?? typeId,
    typeColor: typeMeta?.color ?? "#888888",
    fullCode,
    modifierLabel,
    diagnosedAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ===== current: session.user_id から users 行を取得して導出 =====
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, owner_token, type_id, scores, display_name, created_at")
    .eq("id", session.id)
    .maybeSingle();
  if (userErr) {
    console.error("[zukan-mine] users lookup error:", userErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const current = deriveDiagnosisCard(userRow as UserRow);
  const past: DiagnosisCard[] = []; // Day 4 以降で再診断履歴を実装予定

  // ===== friend_perceptions: target_user_id = session.user.id =====
  let perceptions: Array<{
    id: string;
    targetUserId: string;
    perceiverName: string;
    perceivedTypeId: TorisetsuTypeId;
    perceivedTypeName: string;
    perceivedFullCode: string;
    perceivedModifierLabel: string;
    perceivedModifierParagraph: string;
    qualitativeData: Record<string, string> | null;
    pdfConsent: boolean;
    createdAt: string;
  }> = [];

  {
    const { data: perceptionRows, error: perceptionErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select(
        "id, target_user_id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, perceived_modifier_paragraph, qualitative_data, pdf_consent, pdf_consent_at, created_at",
      )
      .eq("target_user_id", session.id)
      .order("created_at", { ascending: false });
    if (perceptionErr) {
      console.error("[zukan-mine] friend_perceptions lookup error:", perceptionErr);
      // 致命ではない (perception 表示が空になるだけ)
    } else {
      perceptions = (perceptionRows ?? []).map((r) => {
        const typeId = r.perceived_type_id as TorisetsuTypeId;
        return {
          id: r.id as string,
          targetUserId: r.target_user_id as string,
          perceiverName: r.perceiver_name as string,
          perceivedTypeId: typeId,
          perceivedTypeName: torisetsuTypes[typeId]?.name ?? typeId,
          perceivedFullCode: r.perceived_full_code as string,
          perceivedModifierLabel: r.perceived_modifier_label as string,
          perceivedModifierParagraph: r.perceived_modifier_paragraph as string,
          qualitativeData:
            (r.qualitative_data as Record<string, string> | null) ?? null,
          pdfConsent: r.pdf_consent === true,
          createdAt: r.created_at as string,
        };
      });
    }
  }

  const ownerName = (userRow as UserRow).display_name ?? null;

  // ===== integrated_trisetsu: user_id = session.user.id =====
  let integrated: Array<{
    id: string;
    title: string;
    summary: string;
    generatedAt: string;
    perceptionCount: number;
    includeSelf: boolean;
  }> = [];
  let integratedTotalCount = 0;

  {
    const { count: totalCount } = await supabaseAdmin
      .from("integrated_trisetsu")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.id);
    integratedTotalCount = totalCount ?? 0;
  }

  if (integratedTotalCount > 0) {
    const { data: integratedRows, error: integratedErr } = await supabaseAdmin
      .from("integrated_trisetsu")
      .select(
        "id, generated_title, generated_summary, generated_at, perception_ids, include_self",
      )
      .eq("user_id", session.id)
      .order("generated_at", { ascending: false })
      .limit(10);
    if (integratedErr) {
      console.error("[zukan-mine] integrated lookup error:", integratedErr);
    } else {
      integrated = (integratedRows ?? []).map((r) => ({
        id: r.id as string,
        title: (r.generated_title as string | null) ?? "真のトリセツ",
        summary: (r.generated_summary as string | null) ?? "",
        generatedAt: r.generated_at as string,
        perceptionCount: Array.isArray(r.perception_ids)
          ? (r.perception_ids as unknown[]).length
          : 0,
        includeSelf: r.include_self !== false,
      }));
    }
  }

  return NextResponse.json({
    ok: true,
    ownerName,
    current,
    past,
    perceptions,
    integrated,
    integratedTotalCount,
  });
}
