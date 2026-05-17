// Phase 3-β B-4: マイ図鑑のデータ取得 API
//
// 認可: Authorization: Bearer <LIFF id_token> → verifyBearer で line_user_id 取得
//
// 取得対象:
//   1. 自分の users 行全件 (line_user_id 経由、再診断履歴含む)
//   2. line_users.current_owner_token と一致する users 行 = current、他 = past
//   3. friend_perceptions: target_user_id IN (上記 users.id 全件)
//
// レスポンス側で typeName / modifierLabel / fullCode を補完:
//   - users.scores jsonb sidecar (Phase 2F) から取得を優先
//   - 無ければ classifyType + classifyModifier + buildFullCode で派生
//   - perceived_* は friend_perceptions から直接 (B-2 で書き込み済)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyBearer } from "@/lib/liff-verify";
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

  // Sidecar 優先、無ければ scores 5 dim から派生
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
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lineUserId = verified.sub;

  // 1. line_users から current_owner_token を取得
  const { data: lineUserRow, error: lineUserErr } = await supabaseAdmin
    .from("line_users")
    .select("current_owner_token, owner_token")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (lineUserErr) {
    console.error("[zukan-mine] line_users lookup error:", lineUserErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  const currentOwnerToken =
    lineUserRow?.current_owner_token ?? lineUserRow?.owner_token ?? null;

  // 2. 自分の users 全件 (line_user_id 経由、新しい順)
  const { data: userRows, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, owner_token, type_id, scores, display_name, created_at")
    .eq("line_user_id", lineUserId)
    .order("created_at", { ascending: false });
  if (userErr) {
    console.error("[zukan-mine] users lookup error:", userErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  const users = (userRows ?? []) as UserRow[];

  let current: DiagnosisCard | null = null;
  const past: DiagnosisCard[] = [];

  for (const row of users) {
    const card = deriveDiagnosisCard(row);
    if (!current && row.owner_token === currentOwnerToken) {
      current = card;
    } else {
      past.push(card);
    }
  }
  // current が特定できなければ最新行を current 扱い (バックフィル前のレガシー対応)
  if (!current && past.length > 0) {
    current = past.shift() ?? null;
  }

  // 3. friend_perceptions: target_user_id IN (users.id)
  const targetUserIds = users.map((u) => u.id);
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
    createdAt: string;
  }> = [];

  if (targetUserIds.length > 0) {
    const { data: perceptionRows, error: perceptionErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select(
        "id, target_user_id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, perceived_modifier_paragraph, qualitative_data, created_at",
      )
      .in("target_user_id", targetUserIds)
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
          createdAt: r.created_at as string,
        };
      });
    }
  }

  // owner display name (current 優先)
  const ownerName =
    users.find((u) => u.owner_token === currentOwnerToken)?.display_name ??
    users[0]?.display_name ??
    null;

  // Phase 3-β リリース 3 C-4: 統合トリセツ実データを取得
  // line_user_id 経由で同 LINE userId に紐付く全 integrated_trisetsu 行を新しい順で。
  // 上限 10 件、total_count で件数表示可能に。
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
      .eq("line_user_id", lineUserId);
    integratedTotalCount = totalCount ?? 0;
  }

  if (integratedTotalCount > 0) {
    const { data: integratedRows, error: integratedErr } = await supabaseAdmin
      .from("integrated_trisetsu")
      .select(
        "id, generated_title, generated_summary, generated_at, perception_ids, include_self",
      )
      .eq("line_user_id", lineUserId)
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
