// 生成済みレポート PDF の Supabase Storage キャッシュ。
//
// /report/[token]/pdf と /tako-report/[token]/pdf は headless Chromium での生成に
// 数秒〜数十秒 (大メモリ) かかる、コスト最大の Function。内容が変わるのは
// 診断のやり直し・友達回答の追加・表示名の変更くらいなので、内容を決める入力の
// ハッシュをファイル名にして Storage へ保存し、同一内容の再ダウンロードは
// 保存済みバイトをそのまま返す (2026-09-23 サーバー費用削減)。
//
// - バケットは初回利用時にコードから作成する (冪等。マイグレーション・db push 不要)。
// - キャッシュ層の失敗はすべて握りつぶし、従来どおりの生成へフォールバックする。
// - print ページの文面・デザインを変えたときは REPORT_PDF_CACHE_VERSION を上げること
//   (キーに混ぜているので、上げた瞬間から旧キャッシュは参照されなくなる)。

import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

const BUCKET = "report-pdf-cache";

// print ページ (report/tako-report の print 各ロケール) の内容を変えたらバンプする。
export const REPORT_PDF_CACHE_VERSION = "20260923-1";

let bucketEnsured: Promise<boolean> | null = null;

async function ensureBucket(): Promise<boolean> {
  bucketEnsured ??= (async () => {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "50MB",
      allowedMimeTypes: ["application/pdf"],
    });
    if (
      error &&
      (error as { status?: number }).status !== 409 &&
      !/exist/i.test(error.message)
    ) {
      console.error("[report-pdf-cache] createBucket failed:", error);
      return false;
    }
    return true;
  })();
  const ok = await bucketEnsured;
  if (!ok) bucketEnsured = null; // 一時障害なら次のリクエストで再試行する
  return ok;
}

/**
 * キャッシュの保存先パス。keyParts には「PDF の内容を決める入力」を全部渡す
 * (診断完了時刻・表示名・友達回答の件数と最新時刻など)。
 */
export function reportPdfCachePath(
  kind: "self" | "tako",
  userId: string,
  locale: string,
  keyParts: readonly unknown[],
): string {
  const hash = createHash("sha256")
    .update(JSON.stringify([REPORT_PDF_CACHE_VERSION, ...keyParts]))
    .digest("hex")
    .slice(0, 24);
  return `${kind}/${userId}/${locale}/${hash}.pdf`;
}

export async function getCachedReportPdf(path: string): Promise<Buffer | null> {
  try {
    if (!(await ensureBucket())) return null;
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

export async function putCachedReportPdf(
  path: string,
  pdf: Uint8Array,
): Promise<void> {
  try {
    if (!(await ensureBucket())) return;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (error) {
      console.error("[report-pdf-cache] upload failed:", error);
      return;
    }
    // 同じユーザー×ロケールの旧ハッシュはもう参照されないので掃除する (失敗は無視)。
    const dir = path.slice(0, path.lastIndexOf("/"));
    const current = path.slice(path.lastIndexOf("/") + 1);
    const { data: files } = await supabaseAdmin.storage.from(BUCKET).list(dir);
    const stale = (files ?? [])
      .filter((f) => f.name !== current)
      .map((f) => `${dir}/${f.name}`);
    if (stale.length > 0) {
      await supabaseAdmin.storage.from(BUCKET).remove(stale);
    }
  } catch (err) {
    console.error("[report-pdf-cache] put failed:", err);
  }
}
