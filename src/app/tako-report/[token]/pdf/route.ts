// 友達診断 完全版レポートの PDF ダウンロード: GET /tako-report/[token]/pdf
//
// /tako の「レポートをダウンロード」ボタンの着地先。
// /tako-report/[token]/print (PDF生成専用ページ) をサーバ側の headless Chromium で
// 開き、A4 PDF に変換して attachment で返す (/report/[token]/pdf と同じ機構)。
//
// - 認可はページと同じ token + hasTakoAccess。未購入・不明 token は本文を生成せず
//   /tako へ 303 (フェイルクローズ)。
// - 内容は友達回答が増えたときにだけ変わるため、生成結果を Supabase Storage に
//   キャッシュする。キーは (診断完了時刻・表示名・回答の件数と最新時刻・print 版数)。
//   一致すれば Chromium を起動せず保存済みバイトを返す。
// - 生成中に同じ PDF の要求が重なったら (ボタンの連打・アプリ内ブラウザの再送)、
//   1回の生成を共有する。Chromium を要求の数だけ同時に起動すると互いに遅くなり、
//   描画待ちの時間切れで一部が 500 になっていた (2026-11-21 本番で確認)。
// - 応答には「応答が届いた」ことを示す短命 Cookie を付ける。添付ファイルの
//   ダウンロードはページ側から完了を検知できないため、/tako のボタンがこの Cookie を
//   見て「作成中...」の表示を戻す (src/lib/report-pdf-download.ts)。

import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasTakoAccess } from "@/lib/entitlements";
import { launchPdfBrowser } from "@/lib/pdf-browser";
import { resolveSiteUrl } from "@/lib/site-url";
import { REPORT_PDF_DOWNLOAD_COOKIE } from "@/lib/report-pdf-download";
import {
  getCachedReportPdf,
  putCachedReportPdf,
  reportPdfCachePath,
} from "@/lib/report-pdf-cache";

export const maxDuration = 60;
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ token: string }>;
}

const REPORT_BODY_WIDTH_MM = 174;
const A4_WIDTH_MM = 210;

async function expandFirstPageToFullBleed(pdfBytes: Uint8Array) {
  const source = await PDFDocument.load(pdfBytes);
  const pageCount = source.getPageCount();
  if (pageCount === 0) return pdfBytes;

  const output = await PDFDocument.create();
  const cover = source.getPage(0);
  const { width, height } = cover.getSize();
  const printScale = REPORT_BODY_WIDTH_MM / A4_WIDTH_MM;
  const croppedWidth = width * printScale;
  const croppedHeight = height * printScale;
  const embeddedCover = await output.embedPage(cover, {
    left: 0,
    bottom: height - croppedHeight,
    right: croppedWidth,
    top: height,
  });
  const fullBleedCover = output.addPage([width, height]);
  fullBleedCover.drawPage(embeddedCover, {
    x: 0,
    y: 0,
    width,
    height,
  });

  if (pageCount > 1) {
    const remainingPages = await output.copyPages(
      source,
      Array.from({ length: pageCount - 1 }, (_, index) => index + 1),
    );
    for (const page of remainingPages) output.addPage(page);
  }

  return output.save();
}

// print ページの描画完了を待つ上限。以前は 10 秒で、Chromium が混み合うと超えていた。
const REPORT_READY_TIMEOUT_MS = 30_000;

// 応答が届いたことをページ側へ知らせる Cookie。値に意味はなく、有無だけを見る。
const DOWNLOAD_RESPONDED_COOKIE = `${REPORT_PDF_DOWNLOAD_COOKIE}=1; Path=/; Max-Age=60; SameSite=Lax`;

// 生成中の PDF (キー = キャッシュのパス。プレビューは print ページの URL)。
// Fluid Compute は1プロセスで複数リクエストを処理するため、同じキーの要求は
// ここで合流できる。別プロセスに分かれた要求までは束ねない。
const inFlightPdfs = new Map<string, Promise<Uint8Array>>();

async function generateTakoPdf(
  pageUrl: string,
  cachePath: string | null,
): Promise<Uint8Array> {
  let browser: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null;
  try {
    browser = await launchPdfBrowser();
    const page = await browser.newPage();
    const response = await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!response?.ok()) {
      throw new Error(`Friend report print request failed (${response?.status() ?? "no response"})`);
    }
    // Never turn a login, error, or incomplete streamed page into a cached PDF.
    await page.waitForSelector('main article[data-tako-report-document="ready"]', {
      timeout: REPORT_READY_TIMEOUT_MS,
    });
    await page.evaluate(async () => {
      const timeout = (ms: number) =>
        new Promise<void>((resolve) => window.setTimeout(resolve, ms));
      await Promise.race([document.fonts.ready.then(() => undefined), timeout(15_000)]);
      await Promise.race([
        Promise.all(
          Array.from(document.images).map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            });
          }),
        ).then(() => undefined),
        timeout(15_000),
      ]);
    });
    const pdf = await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    const fullBleedPdf = await expandFirstPageToFullBleed(pdf);

    if (cachePath) await putCachedReportPdf(cachePath, fullBleedPdf);
    return fullBleedPdf;
  } catch (err) {
    // 合流した要求の数だけ同じエラーを記録しないよう、生成1回につき1度だけ残す。
    console.error("[/tako-report/pdf] generation failed:", err);
    throw err;
  } finally {
    await browser?.close().catch(() => {});
  }
}

export async function GET(req: Request, ctx: RouteContext) {
  const { token } = await ctx.params;
  const requestUrl = new URL(req.url);
  const isKo = requestUrl.searchParams.get("locale") === "ko";
  const isEn = requestUrl.searchParams.get("locale") === "en";
  const isId = requestUrl.searchParams.get("locale") === "id";

  // ===== プレビュー (開発のみ): ?previewType=<32タイプID> は認可をスキップして
  // PDF生成専用ページのモック描画を PDF 化する =====
  const rawPreview = requestUrl.searchParams.get("previewType") ?? "";
  const isPreview =
    process.env.NODE_ENV !== "production" &&
    /^[a-z-]+__[NR]$/.test(rawPreview);
  const printParams = new URLSearchParams();
  if (isPreview) printParams.set("previewType", rawPreview);
  if (isKo) printParams.set("locale", "ko");
  if (isEn) printParams.set("locale", "en");
  if (isId) printParams.set("locale", "id");
  const printQuery = printParams.size > 0 ? `?${printParams.toString()}` : "";

  // ===== 認可 (ページと同一条件。未購入にはロック画面 PDF すら作らない) =====
  let cachePath: string | null = null;
  if (!isPreview) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, diagnosis_completed_at, display_name")
      .eq("owner_token", token)
      .maybeSingle();
    if (error) {
      console.error("[/tako-report/pdf] users lookup error:", error);
    }
    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!(await hasTakoAccess(data.id))) {
      return NextResponse.redirect(
        `${resolveSiteUrl()}${isKo ? "/ko" : isEn ? "/en" : isId ? "/id" : ""}/tako/${encodeURIComponent(token)}`,
        303,
      );
    }

    // キャッシュキー素材: 友達回答の件数と最新時刻 (回答が増減すればキーが変わる)。
    const { data: latestPerception, count: perceptionCount } =
      await supabaseAdmin
        .from("friend_perceptions")
        .select("created_at", { count: "exact" })
        .eq("target_user_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1);
    cachePath = reportPdfCachePath(
      "tako",
      data.id as string,
      isKo ? "ko" : isEn ? "en" : isId ? "id" : "ja",
      [
        "tako-verified-print-v2",
        data.diagnosis_completed_at,
        data.display_name,
        perceptionCount ?? 0,
        latestPerception?.[0]?.created_at ?? null,
      ],
    );
  }

  // ===== PDF生成専用ページを描画して PDF 化 =====
  // Production deployment URLs may require Vercel authentication. Render through
  // the public site, where the print route still checks the owner's paid access.
  const origin = process.env.VERCEL_ENV === "production"
    ? resolveSiteUrl()
    : new URL(req.url).origin;
  const pageUrl = isEn
    ? `${origin}/en/tako-report/${encodeURIComponent(token)}/print${printQuery}`
    : isId
      ? `${origin}/id/tako-report/${encodeURIComponent(token)}/print${printQuery}`
    : `${origin}/tako-report/${encodeURIComponent(token)}/print${printQuery}`;

  const takoPdfResponse = (bytes: Uint8Array) =>
    new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `attachment; filename="${isKo ? "friend-personality-report-ko.pdf" : isEn ? "alice-test-friend-analysis.pdf" : isId ? "analisis-kepribadian-teman.pdf" : "watashi-no-torisetsu-friend-report.pdf"}"; ` +
          `filename*=UTF-8''${encodeURIComponent(isKo ? "앨리스 진단 - 친구 진단 완전판 리포트.pdf" : isEn ? "Alice Personalities Friend Analysis.pdf" : isId ? "Analisis Kepribadian Teman.pdf" : "友達診断 完全版レポート.pdf")}`,
        "Cache-Control": "private, no-store",
        "Set-Cookie": DOWNLOAD_RESPONDED_COOKIE,
      },
    });

  // 内容が同じ生成済み PDF があれば Chromium を起動せずに返す。
  if (cachePath) {
    const cached = await getCachedReportPdf(cachePath);
    if (cached) return takoPdfResponse(new Uint8Array(cached));
  }

  // 同じ PDF を生成中なら、新しく Chromium を起動せずその結果を待つ。
  const flightKey = cachePath ?? pageUrl;
  let generation = inFlightPdfs.get(flightKey);
  if (!generation) {
    generation = generateTakoPdf(pageUrl, cachePath).finally(() => {
      inFlightPdfs.delete(flightKey);
    });
    inFlightPdfs.set(flightKey, generation);
  }

  try {
    return takoPdfResponse(await generation);
  } catch {
    // 原因は generateTakoPdf が記録済み。
    return NextResponse.json(
      { error: "pdf_failed" },
      { status: 500, headers: { "Set-Cookie": DOWNLOAD_RESPONDED_COOKIE } },
    );
  }
}
