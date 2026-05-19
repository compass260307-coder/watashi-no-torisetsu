// プレミアム化 v2 Week 1 T1-8: PDF プロトタイプ用テストエンドポイント
// 認可なし、固定ダミーデータで PDF を生成して返却。
// 本番リリース前に削除すること (T2-2 で本実装に置換予定)。
//
// GET /api/test-pdf  → Content-Type: application/pdf

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import {
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import {
  IntegratedTrisetsuPDF,
  type MinimalPdfData,
  type PdfChapter,
} from "@/components/pdf/IntegratedTrisetsuPDF";

const CHAPTER_KEYS = [
  "essence",
  "multifacetedness",
  "hidden_self",
  "strengths_weaknesses",
  "relationships",
  "life_guidance",
  "message",
] as const;

type ChapterFromJson = { title: string; subtitle?: string; body: string };
type SampleJson = {
  ownerName: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  chapters: Record<(typeof CHAPTER_KEYS)[number], ChapterFromJson>;
};

function loadSampleData(): MinimalPdfData {
  const jsonPath = resolve(process.cwd(), "scripts/sample-7chapters.json");
  const raw = readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as SampleJson;
  const ordered: PdfChapter[] = CHAPTER_KEYS.map((k) => {
    const ch = parsed.chapters[k];
    return { title: ch.title, subtitle: ch.subtitle, body: ch.body };
  });
  return {
    ownerName: parsed.ownerName,
    title: parsed.title,
    subtitle: parsed.subtitle,
    generatedAt: parsed.generatedAt,
    chapters: ordered,
  };
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  let sampleData: MinimalPdfData;
  try {
    sampleData = loadSampleData();
  } catch (err) {
    console.error("[test-pdf] failed to load sample JSON:", err);
    return NextResponse.json(
      {
        error: "Sample JSON load failed",
        detail: err instanceof Error ? err.message : String(err),
        hint: "Run `npx tsx scripts/generate-sample-7chapters.ts` to create scripts/sample-7chapters.json first.",
      },
      { status: 500 },
    );
  }
  const t0 = Date.now();
  let pdfBuffer: Buffer | Uint8Array;
  try {
    // renderToBuffer は <Document> を直接受ける型なので、ラッパー越しのため cast。
    pdfBuffer = await renderToBuffer(
      createElement(IntegratedTrisetsuPDF, {
        data: sampleData,
      }) as unknown as ReactElement<DocumentProps>,
    );
  } catch (err) {
    console.error("[test-pdf] render error:", err);
    return NextResponse.json(
      {
        error: "PDF render failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
  const elapsedMs = Date.now() - t0;
  const size = pdfBuffer.byteLength;

  // メタ情報をヘッダーに乗せる (curl -I で観測しやすく)
  return new Response(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'inline; filename="test-pdf-prototype.pdf"',
      "X-PDF-Render-Ms": String(elapsedMs),
      "X-PDF-Bytes": String(size),
    },
  });
}
