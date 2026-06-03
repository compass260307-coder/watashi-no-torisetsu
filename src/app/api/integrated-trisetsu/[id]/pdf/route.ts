// プレミアム化 v3 Day 3: 統合トリセツ PDF (Web ファースト版)
//
// GET /api/integrated-trisetsu/[id]/pdf
//   - 認可: Cookie wn_session (旧: Authorization: Bearer <LIFF id_token>)
//   - integrated_trisetsu.user_id が session.user.id と一致するときのみ取得可
//
// 認可フロー:
//   1. getSession(request) で users 行を解決 (401 if 失敗)
//   2. integrated_trisetsu.user_id === session.user.id でなければ 403
//
// レスポンス:
//   - 200 + application/pdf (本文は PDF バイナリ、新タブ表示前提)
//   - 401: session 不正
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
import { getSession } from "@/lib/session";
import { classifySixteenType, sixteenTypes } from "@/lib/sixteen-types";
import {
  IntegratedTrisetsuPDF,
  type MinimalPdfData,
  type PdfChapter,
  type PdfSource,
} from "@/components/pdf/IntegratedTrisetsuPDF";
import type { BigFiveDimension } from "@/lib/types";

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

  // ===== 認可: Cookie session =====
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  if (trow.user_id !== session.id) {
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
  // Day 12-D: 自己タイプ名は 16 タイプ (scores から派生)
  const typeName =
    sixteenTypes[
      classifySixteenType(
        storedScores as Partial<Record<BigFiveDimension, number>>,
      )
    ].name;
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
