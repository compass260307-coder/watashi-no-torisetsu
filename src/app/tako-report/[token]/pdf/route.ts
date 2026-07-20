// 友達診断 完全版レポートの PDF ダウンロード: GET /tako-report/[token]/pdf
//
// /tako の「レポートをダウンロード」ボタンの着地先。
// /tako-report/[token]/print (PDF生成専用ページ) をサーバ側の headless Chromium で
// 開き、A4 PDF に変換して attachment で返す (/report/[token]/pdf と同じ機構)。
//
// - 認可はページと同じ token + hasTakoAccess。未購入・不明 token は本文を生成せず
//   /tako へ 303 (フェイルクローズ)。
// - 友達が増えるたびに内容が変わるためキャッシュしない (毎回生成)。

import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasTakoAccess } from "@/lib/entitlements";
import { resolveSiteUrl } from "@/lib/site-url";

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ token: string }>;
}

async function launchBrowser() {
  // Vercel (Linux serverless) では @sparticuz/chromium のバイナリを使う。
  // 判定は platform で行う (/report/[token]/pdf と同じ理由)。
  if (process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const localChrome =
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return puppeteer.launch({ executablePath: localChrome, headless: true });
}

export async function GET(req: Request, ctx: RouteContext) {
  const { token } = await ctx.params;

  // ===== プレビュー (開発のみ): ?previewType=<32タイプID> は認可をスキップして
  // PDF生成専用ページのモック描画を PDF 化する =====
  const rawPreview = new URL(req.url).searchParams.get("previewType") ?? "";
  const previewQuery =
    process.env.NODE_ENV !== "production" && /^[a-z-]+__[NR]$/.test(rawPreview)
      ? `?previewType=${rawPreview}`
      : "";

  // ===== 認可 (ページと同一条件。未購入にはロック画面 PDF すら作らない) =====
  if (!previewQuery) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id")
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
        `${resolveSiteUrl()}/tako/${encodeURIComponent(token)}`,
        303,
      );
    }
  }

  // ===== PDF生成専用ページを描画して PDF 化 =====
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : new URL(req.url).origin;
  const pageUrl = `${origin}/tako-report/${encodeURIComponent(token)}/print${previewQuery}`;

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 45_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) => {
          if (image.complete && image.naturalWidth > 0) {
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
        }),
      );
    });
    const pdf = await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `attachment; filename="watashi-no-torisetsu-friend-report.pdf"; ` +
          `filename*=UTF-8''${encodeURIComponent("友達診断 完全版レポート.pdf")}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/tako-report/pdf] generation failed:", err);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
