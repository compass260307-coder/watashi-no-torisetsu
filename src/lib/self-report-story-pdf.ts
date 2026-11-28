import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// 日本語版の自己診断レポート (キャラ別の縦書き小説 PDF) を読む (Vercel 用)。
// ファイルは private/self-report-stories/ にあり、next.config.ts の
// outputFileTracingIncludes で PDF の入口に同梱している。
// Cloudflare 向けビルド (DEPLOY_TARGET=cloudflare) では self-report-story-pdf.cloudflare.ts に
// 差し替わる (Workers はプログラムにファイルを同梱できないため、R2 から読む)。
export async function readSelfReportStoryPdf(slug: string): Promise<Buffer> {
  return readFile(join(process.cwd(), "private", "self-report-stories", `${slug}-vertical-story.pdf`));
}
