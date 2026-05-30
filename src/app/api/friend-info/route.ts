// Phase 1.5-α Day 12-C3: friend-info API を拡張
// /friend/[inviteCode] の Koi 風入口で A のタイプ情報 (名 / コード / 修飾ラベル / 色 / 副題)
// を表示するため、display_name に加えて公開可能なタイプ情報を返す。
//
// セキュリティ方針 (PR-FIX-2 維持):
//   - owner_token は引き続き返さない (推測不可な認可キー)
//   - 返すのは「invite_code を持つ人にとってだけ価値ある情報」(タイプ名 / コード / 色 / 副題)
//   - これらは結果ページでも公開される情報のため漏洩リスク評価は変わらない

import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { buildFullCode, classifyModifier } from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";
import type {
  BigFiveDimension,
  CModifier,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
};

function deriveLabels(
  typeId: string,
  stored: StoredScores,
): { fullCode: string; modifierLabel: string } {
  let fullCode = stored.fullCode ?? "";
  let modifierLabel = stored.modifierLabel ?? "";
  if (!fullCode || !modifierLabel) {
    const dimScores: Record<BigFiveDimension, number> = {
      E: typeof stored.E === "number" ? stored.E : 5,
      A: typeof stored.A === "number" ? stored.A : 5,
      O: typeof stored.O === "number" ? stored.O : 5,
      C: typeof stored.C === "number" ? stored.C : 5,
      N: typeof stored.N === "number" ? stored.N : 5,
    };
    const { cModifier, nModifier } = classifyModifier(dimScores);
    if (!fullCode) {
      fullCode = buildFullCode(
        typeId as TorisetsuTypeId,
        cModifier,
        nModifier,
      );
    }
    if (!modifierLabel) {
      modifierLabel = getModifierLabel(cModifier, nModifier);
    }
  }
  return { fullCode, modifierLabel };
}

export async function GET(request: NextRequest) {
  const inviteCode = request.nextUrl.searchParams.get("code");

  if (!inviteCode) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // owner_token は外部に返さない (PR-FIX-2 維持)。
  // 公開可能なタイプ情報 (type_id / scores / display_name) を取得。
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("display_name, type_id, scores")
    .eq("invite_code", inviteCode)
    .single();

  if (error || !data) {
    return NextResponse.json({ displayName: null });
  }

  const typeId = (data.type_id as string | null) ?? null;
  const stored = (data.scores ?? {}) as StoredScores;

  let typeName: string | null = null;
  let typeSubtitle: string | null = null;
  let typeColor: string | null = null;
  let fullCode: string | null = null;
  let modifierLabel: string | null = null;

  if (typeId) {
    const meta = torisetsuTypes[typeId as TorisetsuTypeId];
    typeName = meta?.name ?? null;
    typeSubtitle = (meta?.subtitle as string | undefined) ?? null;
    typeColor = meta?.color ?? null;
    const derived = deriveLabels(typeId, stored);
    fullCode = derived.fullCode || null;
    modifierLabel = derived.modifierLabel || null;
  }

  return NextResponse.json({
    displayName: (data.display_name as string | null) ?? null,
    typeId,
    typeName,
    typeSubtitle,
    typeColor,
    fullCode,
    modifierLabel,
  });
}
