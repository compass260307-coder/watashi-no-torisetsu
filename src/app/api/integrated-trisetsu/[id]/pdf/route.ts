// プレミアム化 v2 Week 2 T2-2: 統合トリセツ PDF ダウンロード本実装
//
// GET /api/integrated-trisetsu/[id]/pdf
//   - Authorization: Bearer <LIFF id_token> 必須 (所有者のみアクセス可)
//   - integrated_trisetsu の本人のみが PDF を取得できる
//
// 認可フロー:
//   1. verifyBearer(request) で line_user_id 取得 (401 if 失敗)
//   2. line_users + users 経由で「自分の全 users.id」を取得 (再診断履歴含む)
//   3. integrated_trisetsu.user_id がその集合に含まれていなければ 403
//
// データフロー:
//   integrated_trisetsu (id, user_id, perception_ids, include_self,
//                        status, generated_title, generated_subtitle,
//                        generated_chapters, ai_model, generated_at, source_summary)
//   users (display_name, type_id, scores) -- typeCode + typeName + ownerName
//   friend_perceptions[] -- perceiver_name + perceived_full_code + perceived_modifier_label
//   → MinimalPdfData
//
// レスポンス:
//   - 200 + application/pdf + Content-Disposition: attachment (本文は PDF バイナリ)
//   - 401: Bearer 検証失敗
//   - 403: ownership 不一致
//   - 404: not found / status != 'completed' / chapters 欠落
//   - 500: PDF 生成失敗

import { NextRequest, NextResponse } from "next/server";
import {
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyBearer } from "@/lib/liff-verify";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import {
  IntegratedTrisetsuPDF,
  type MinimalPdfData,
  type PdfChapter,
  type PdfSource,
} from "@/components/pdf/IntegratedTrisetsuPDF";
import type { TorisetsuTypeId } from "@/lib/types";

export const runtime = "nodejs";
// PDF 生成は通常 < 1 秒だが、フォント Cold start + DB 取得込みで余裕を持つ
export const maxDuration = 30;

const CHAPTER_KEYS = [
  "essence",
  "multifacetedness",
  "hidden_self",
  "strengths_weaknesses",
  "relationships",
  "life_guidance",
  "message",
] as const;

type ChapterFromDb = { title?: string; subtitle?: string; body?: string };

type IntegratedRow = {
  id: string;
  user_id: string;
  include_self: boolean;
  perception_ids: string[] | null;
  status: string | null;
  generated_title: string | null;
  generated_subtitle: string | null;
  generated_chapters: Record<string, ChapterFromDb> | null;
  ai_model: string | null;
  generated_at: string;
};

type UserRow = {
  display_name: string | null;
  type_id: string;
  scores: Record<string, unknown> | null;
};

type PerceptionRow = {
  id: string;
  perceiver_name: string;
  perceived_full_code: string;
  perceived_modifier_label: string | null;
};

function modelLabelFor(model: string | null): string {
  if (!model) return "Claude (詳細非公開)";
  if (model.includes("opus-4-7")) return "Claude Opus 4.7";
  if (model.includes("sonnet-4-6")) return "Claude Sonnet 4.6";
  if (model.includes("haiku-4-5")) return "Claude Haiku 4.5";
  return model;
}

async function getMyUserIds(lineUserId: string): Promise<string[]> {
  // /api/integrated-trisetsu POST と同じパターン: line_user_id 直接 +
  // line_users.owner_token / current_owner_token 経由の OR フォールバック。
  const { data: lineUsersAll } = await supabaseAdmin
    .from("line_users")
    .select("owner_token, current_owner_token")
    .eq("line_user_id", lineUserId);
  const tokens: string[] = [];
  for (const r of lineUsersAll ?? []) {
    if (r.owner_token) tokens.push(r.owner_token as string);
    if (
      r.current_owner_token &&
      r.current_owner_token !== r.owner_token
    ) {
      tokens.push(r.current_owner_token as string);
    }
  }
  const uniqTokens = Array.from(new Set(tokens));

  let q = supabaseAdmin.from("users").select("id");
  if (uniqTokens.length > 0) {
    const ownerList = uniqTokens.map((t) => `"${t}"`).join(",");
    q = q.or(
      `line_user_id.eq.${lineUserId},owner_token.in.(${ownerList})`,
    );
  } else {
    q = q.eq("line_user_id", lineUserId);
  }
  const { data: rows } = await q;
  return (rows ?? []).map((r) => r.id as string);
}

function buildChapters(
  raw: Record<string, ChapterFromDb> | null,
): PdfChapter[] | null {
  if (!raw) return null;
  const ordered: PdfChapter[] = [];
  for (const key of CHAPTER_KEYS) {
    const ch = raw[key];
    if (!ch || typeof ch.body !== "string" || ch.body.length === 0) {
      return null; // 7 章揃ってない場合は失敗扱い
    }
    ordered.push({
      title: typeof ch.title === "string" ? ch.title : "",
      subtitle: typeof ch.subtitle === "string" ? ch.subtitle : undefined,
      body: ch.body,
    });
  }
  return ordered;
}

function buildFilename(ownerName: string, generatedAt: string): {
  ascii: string;
  utf8: string;
} {
  let dateStr: string;
  try {
    const d = new Date(generatedAt);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dateStr = `${yyyy}${mm}${dd}`;
  } catch {
    dateStr = "unknown-date";
  }
  const safe = ownerName.replace(/[\/\\\?\*:|"<>]/g, "_");
  const utf8 = `トリセツ_${safe}_${dateStr}.pdf`;
  const ascii = `trisetsu_${dateStr}.pdf`;
  return { ascii, utf8 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // ===== 認可: LIFF id_token =====
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lineUserId = verified.sub;

  // ===== integrated_trisetsu 取得 =====
  const { data: row, error: rowErr } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select(
      "id, user_id, include_self, perception_ids, status, generated_title, generated_subtitle, generated_chapters, ai_model, generated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (rowErr) {
    console.error("[integrated-trisetsu/:id/pdf] DB error:", rowErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const trow = row as IntegratedRow;

  // ===== status / chapters チェック =====
  if (trow.status !== "completed") {
    return NextResponse.json(
      { error: "PDF is only available for completed integrations" },
      { status: 404 },
    );
  }
  const chapters = buildChapters(trow.generated_chapters);
  if (!chapters) {
    return NextResponse.json(
      { error: "Generated chapters are missing or invalid" },
      { status: 404 },
    );
  }

  // ===== ownership 確認 =====
  const myUserIds = await getMyUserIds(lineUserId);
  if (!myUserIds.includes(trow.user_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ===== owner users 行取得 (型コード + 型名 + ownerName) =====
  const { data: ownerRow } = await supabaseAdmin
    .from("users")
    .select("display_name, type_id, scores")
    .eq("id", trow.user_id)
    .maybeSingle();
  const owner = (ownerRow ?? null) as UserRow | null;
  const ownerName =
    ((owner?.display_name as string | null) ?? "").trim() || "あなた";
  const storedScores =
    (owner?.scores as Record<string, unknown> | null) ?? {};
  const fullCode =
    typeof storedScores.fullCode === "string"
      ? (storedScores.fullCode as string)
      : "";
  const modifierLabel =
    typeof storedScores.modifierLabel === "string"
      ? (storedScores.modifierLabel as string)
      : "";
  const typeName =
    (owner?.type_id &&
      torisetsuTypes[owner.type_id as TorisetsuTypeId]?.name) ||
    "";
  const typeNameLabel =
    typeName && modifierLabel
      ? `${typeName} ・ ${modifierLabel}`
      : typeName || modifierLabel || undefined;

  // ===== friend_perceptions 取得 (sources の modifierLabel に必要) =====
  const perceptionIds = trow.perception_ids ?? [];
  let perceptionRows: PerceptionRow[] = [];
  if (perceptionIds.length > 0) {
    const { data: ps } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id, perceiver_name, perceived_full_code, perceived_modifier_label")
      .in("id", perceptionIds);
    perceptionRows = (ps ?? []) as PerceptionRow[];
  }
  // perception_ids の順序を保つよう map
  const perceptionById = new Map(perceptionRows.map((p) => [p.id, p]));
  const orderedPerceptions = perceptionIds
    .map((pid) => perceptionById.get(pid))
    .filter((p): p is PerceptionRow => Boolean(p));

  // ===== PdfData 組立 =====
  const sources: PdfSource[] = [];
  if (trow.include_self) {
    sources.push({
      kind: "self",
      name: ownerName,
      fullCode: fullCode || "—",
      modifierLabel: modifierLabel || undefined,
    });
  }
  for (const p of orderedPerceptions) {
    sources.push({
      kind: "perception",
      name: p.perceiver_name,
      fullCode: p.perceived_full_code,
      modifierLabel: p.perceived_modifier_label ?? undefined,
    });
  }

  const pdfData: MinimalPdfData = {
    ownerName,
    typeCode: fullCode || undefined,
    typeName: typeNameLabel,
    title:
      (trow.generated_title ?? "").trim() ||
      `${ownerName}さんの真のトリセツ`,
    subtitle: trow.generated_subtitle ?? "",
    generatedAt: trow.generated_at,
    chapters,
    sources,
    modelLabel: modelLabelFor(trow.ai_model),
  };

  // ===== PDF 生成 =====
  const t0 = Date.now();
  let pdfBuffer: Buffer | Uint8Array;
  try {
    pdfBuffer = await renderToBuffer(
      createElement(IntegratedTrisetsuPDF, {
        data: pdfData,
      }) as unknown as ReactElement<DocumentProps>,
    );
  } catch (err) {
    console.error("[integrated-trisetsu/:id/pdf] render error:", err);
    return NextResponse.json(
      {
        error: "PDF render failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
  const elapsedMs = Date.now() - t0;

  // ===== レスポンス =====
  const { ascii, utf8 } = buildFilename(ownerName, trow.generated_at);
  const utf8Encoded = encodeURIComponent(utf8);
  return new Response(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      // RFC 5987: ASCII fallback + UTF-8 (日本語ファイル名)
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${utf8Encoded}`,
      "X-PDF-Render-Ms": String(elapsedMs),
      "X-PDF-Bytes": String(pdfBuffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
