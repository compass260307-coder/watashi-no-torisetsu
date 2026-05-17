// Phase 3-β リリース 3 C-4: 統合トリセツ取得 GET API (公開エンドポイント)
//
// 認可なし (Bearer 不要) — URL を知ってる人なら誰でも閲覧可能。
// 論点 3 (a) 採用: シェアリンク前提、プライバシーよりシェア体験を優先。
//
// 内部メタ (ai_input_tokens / ai_output_tokens / ai_cost_usd / ai_model /
// line_user_id) は返さない。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select(
      "id, include_self, perception_ids, source_summary, generated_title, generated_summary, generated_body, generated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[integrated-trisetsu/:id] DB error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    title: data.generated_title,
    summary: data.generated_summary,
    body: data.generated_body,
    include_self: data.include_self,
    perception_ids: data.perception_ids,
    source_summary: data.source_summary,
    generated_at: data.generated_at,
  });
}
