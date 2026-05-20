// Phase 3-β リリース 3 C-1: AI 統合トリセツ生成エンドポイント
// プレミアム化 v2 (Week 1 T1-4 + Week 2 T2-7): 共通 generator に委譲
//
// POST /api/integrated-trisetsu
//   - Authorization: Bearer <LIFF id_token> 必須
//   - body: { perception_ids: string[], include_self?: boolean (default true) }
//   - 自分の current users 行特定 → perception 検証 → INSERT pending →
//     runAIGenerationAndUpdate (同期 await) → 結果返却
//
// 認可:
//   - verifyBearer で line_user_id 導出
//   - line_users.current_owner_token から自分の最新 users 行を特定
//   - perception_ids が全て「自分の users (履歴含む) の target_user_id か」を検証
//
// 設計判断:
//   - AI 呼び出し本体は src/lib/integrated-trisetsu-generator.ts に分離
//     (Webhook と本ルートの両方から呼び出される)
//   - 本ルートは認可 + 入力検証 + INSERT pending + 同期 await のみを担当
//   - payment_id は付与しない (= 課金フローを通らないパス、開発・テスト向け)
//
// 戻り値:
//   - 200: { ok, integrated_trisetsu_id, redirect_to } (生成成功)
//   - 401: 認可失敗
//   - 400 / 403 / 404: バリデーション失敗
//   - 500: AI 生成 or DB エラー (integrated_trisetsu_id を含めて返す)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyBearer } from "@/lib/liff-verify";
import {
  buildSourceSummary,
  runAIGenerationAndUpdate,
} from "@/lib/integrated-trisetsu-generator";

export const runtime = "nodejs";
// プレミアム化 v2: Opus 4.7 + 5,000-6,000 字生成で 30-90 秒かかる想定
// (Vercel Pro / Fluid Compute 前提、Hobby プランでは動作しない)
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // ===== 認可 =====
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lineUserId = verified.sub;

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

  // ===== 自分の current users 行特定 =====
  const { data: lineUserRow, error: lineUserErr } = await supabaseAdmin
    .from("line_users")
    .select("current_owner_token, owner_token")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (lineUserErr) {
    console.error("[integrated-trisetsu] line_users lookup error:", lineUserErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  const currentOwnerToken =
    lineUserRow?.current_owner_token ?? lineUserRow?.owner_token ?? null;
  if (!currentOwnerToken) {
    return NextResponse.json(
      { error: "LINE 連携が完了していません" },
      { status: 400 },
    );
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("owner_token", currentOwnerToken)
    .maybeSingle();
  if (userErr || !userRow) {
    console.error("[integrated-trisetsu] users lookup error:", userErr);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = userRow.id as string;

  // ===== 自分の全 users.id 取得 (再診断履歴含む、perception 検証用) =====
  // 🔴 致命バグ修正 (2026-05-18): users.line_user_id 直接 +
  //   line_users.owner_token 経由の OR フォールバック。
  //   users.line_user_id = NULL のまま放置された古いユーザーでも、line_users 経由で
  //   自分の users 行を全部拾える (再診断履歴含む)。
  const ownerTokensFromLineUsers: string[] = [];
  {
    const { data: lineUsersAll } = await supabaseAdmin
      .from("line_users")
      .select("owner_token, current_owner_token")
      .eq("line_user_id", lineUserId);
    for (const r of lineUsersAll ?? []) {
      const ot = (r.owner_token as string | null) ?? null;
      const cot = (r.current_owner_token as string | null) ?? null;
      if (ot) ownerTokensFromLineUsers.push(ot);
      if (cot && cot !== ot) ownerTokensFromLineUsers.push(cot);
    }
  }
  const uniqOwnerTokens = Array.from(new Set(ownerTokensFromLineUsers));

  let allMyUsersQuery = supabaseAdmin.from("users").select("id");
  if (uniqOwnerTokens.length > 0) {
    const ownerList = uniqOwnerTokens.map((t) => `"${t}"`).join(",");
    allMyUsersQuery = allMyUsersQuery.or(
      `line_user_id.eq.${lineUserId},owner_token.in.(${ownerList})`,
    );
  } else {
    allMyUsersQuery = allMyUsersQuery.eq("line_user_id", lineUserId);
  }
  const { data: allMyUsers } = await allMyUsersQuery;
  const allMyUserIds = (allMyUsers ?? []).map((u) => u.id as string);
  if (!allMyUserIds.includes(userId)) allMyUserIds.push(userId);

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
      (p) => !allMyUserIds.includes(p.target_user_id as string),
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
          error:
            "PDF 利用未同意の友達評価は統合素材にできません",
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
      line_user_id: lineUserId,
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
