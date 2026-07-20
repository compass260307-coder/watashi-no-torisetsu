// 詳細レポートの PDF ダウンロード: GET /report/[token]/pdf
//
// 課金完了メールの「完全版PDFをダウンロード」ボタンの着地先。
// /report/[token]/print (PDF生成専用ページ) をサーバ側の headless Chromium で開き、
// A4 PDF に変換して attachment で返す。印刷スタイル (print:hidden 等) はページ側に
// 実装済みなので、ここでは描画と変換だけを行う。
//
// - 認可はページと同じ token + hasFullAccess。未課金・不明 token は本文を
//   生成せず /me へ 303 (フェイルクローズ。ロック画面の PDF も作らない)。
// - Chromium は Vercel では @sparticuz/chromium、ローカルではインストール済みの
//   Chrome (channel: "chrome") を使う。
// - 生成に数秒かかるため maxDuration を明示。タイプ別に内容が固定なので
//   将来重くなったらタイプ単位のキャッシュを検討。

import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasFullAccess } from "@/lib/entitlements";
import { resolveSiteUrl } from "@/lib/site-url";

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ token: string }>;
}

async function launchBrowser() {
  // Vercel (Linux serverless) では @sparticuz/chromium のバイナリを使う。
  // 判定は platform で行うこと。process.env.VERCEL は `vercel env pull` した
  // .env.local にも入るため、ローカルで Linux バイナリを exec して
  // spawn ENOEXEC になる (実際に踏んだ)。
  if (process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  // ローカル開発 (macOS): インストール済みの Chrome を使う
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

  // ===== 認可 (ページと同一条件。未課金にはロック画面 PDF すら作らない) =====
  if (!previewQuery) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("owner_token", token)
      .maybeSingle();
    if (error) {
      console.error("[/report/pdf] users lookup error:", error);
    }
    if (!data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!(await hasFullAccess(data.id))) {
      return NextResponse.redirect(
        `${resolveSiteUrl()}/me/${encodeURIComponent(token)}`,
        303,
      );
    }
  }

  // ===== PDF生成専用ページを描画して PDF 化 =====
  // 自デプロイメントの URL を開く。Vercel 上では VERCEL_URL (デプロイ固有 URL) で
  // プレビュー環境でも自分自身を見る。ローカル開発ではリクエスト自身の origin
  // (localhost:3000 等)。
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : new URL(req.url).origin;
  const pageUrl = `${origin}/report/${encodeURIComponent(token)}/print${previewQuery}`;

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
        // 日本語ファイル名は RFC 5987 (filename*)、ASCII フォールバック併記
        "Content-Disposition":
          `attachment; filename="watashi-no-torisetsu-report.pdf"; ` +
          `filename*=UTF-8''${encodeURIComponent("ワタシのトリセツ詳細レポート.pdf")}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[/report/pdf] pdf generation failed:", err);
    // 生成失敗時は解放済みの自己診断結果へ案内する。
    return NextResponse.redirect(
      `${resolveSiteUrl()}/me/${encodeURIComponent(token)}`,
      303,
    );
  } finally {
    await browser?.close().catch(() => {});
  }
}
