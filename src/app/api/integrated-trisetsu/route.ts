// プレミアム化 v3 Day 3: AI 統合トリセツ生成 (Web ファースト版、dev/preview 限定)
//
// POST /api/integrated-trisetsu
//   - 本番 (VERCEL_ENV='production') では 410 を返す。
//     本番の AI 統合生成は Stripe Checkout → Webhook 経路に一本化。
//   - 認可: Cookie wn_session (旧: Authorization: Bearer <LIFF id_token>)
//   - body: { perception_ids: string[], include_self?: boolean (default true) }
//
// 認可・perception 検証:
//   - session.user.id を直接使用 (LINE 経由の users.id 集約ロジックは不要)
//   - perception の target_user_id が session.user.id と一致するかチェック
//
// 戻り値:
//   - 200: { ok, integrated_trisetsu_id, redirect_to } (生成成功)
//   - 401: 認可失敗
//   - 400 / 403 / 404: バリデーション失敗
//   - 500: AI 生成 or DB エラー (integrated_trisetsu_id を含めて返す)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import {
  buildSourceSummary,
  runAIGenerationAndUpdate,
} from "@/lib/integrated-trisetsu-generator";

export const runtime = "nodejs";
// プレミアム化 v2: Opus 4.7 + 5,000-6,000 字生成で 30-90 秒かかる想定
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // ===== T3-7 本番ガード =====
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "production"
  ) {
    return NextResponse.json(
      {
        error: "This endpoint is disabled in production.",
        hint: "本番では Stripe Checkout 経由で生成してください: POST /api/checkout/create-session",
      },
      { status: 410 },
    );
  }

  // ===== 認可 =====
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.id;

  // ===== body parse =====
  let body: { perception_ids?: unknown; include_self?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const includeSelf = body.include_self !== false; // default true
  const perceptionIds: string[] = Array.isArray(body.perception_ids)
    ? body.perception_ids.filter((v): v is string => typeof v === "string")
    : [];

  if (!includeSelf && perceptionIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "include_self=false の場合、perception_ids を 1 件以上指定してください",
      },
      { status: 400 },
    );
  }

  // ===== perception_ids 検証 =====
  if (perceptionIds.length > 0) {
    const { data: ps, error: pErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id, target_user_id, pdf_consent")
      .in("id", perceptionIds);
    if (pErr) {
      console.error("[integrated-trisetsu] perceptions lookup error:", pErr);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
    const rows = ps ?? [];
    if (rows.length !== perceptionIds.length) {
      return NextResponse.json(
        { error: "一部の perception_id が見つかりません" },
        { status: 404 },
      );
    }
    const invalid = rows.find(
      (p) => (p.target_user_id as string) !== userId,
    );
    if (invalid) {
      return NextResponse.json(
        { error: "他人の perception_id は統合素材にできません" },
        { status: 403 },
      );
    }
    // T3-3: pdf_consent=false の perception は使用不可 (サーバ側ガード)
    const notConsented = rows.find((p) => p.pdf_consent !== true);
    if (notConsented) {
      return NextResponse.json(
        {
          error: "PDF 利用未同意の友達評価は統合素材にできません",
          perception_id: notConsented.id,
        },
        { status: 403 },
      );
    }
  }

  // ===== source_summary 構築 + INSERT pending =====
  const sourceSummary = await buildSourceSummary(
    userId,
    includeSelf,
    perceptionIds,
  );

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("integrated_trisetsu")
    .insert({
      user_id: userId,
      line_user_id: session.line_user_id, // Phase 2 復活用、optional
      include_self: includeSelf,
      perception_ids: perceptionIds,
      source_summary: sourceSummary,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    console.error("[integrated-trisetsu] INSERT error:", insErr);
    return NextResponse.json(
      { error: "DB insert failed", detail: insErr?.message },
      { status: 500 },
    );
  }
  const integratedId = inserted.id as string;

  // ===== AI 生成 (同期 await。dev/テスト向けパスなのでクライアントは結果まで待つ) =====
  const result = await runAIGenerationAndUpdate(integratedId);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "AI 生成に失敗しました",
        detail: result.error,
        integrated_trisetsu_id: integratedId,
        status: "failed",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    integrated_trisetsu_id: integratedId,
    redirect_to: `/integrated/${integratedId}`,
  });
}
