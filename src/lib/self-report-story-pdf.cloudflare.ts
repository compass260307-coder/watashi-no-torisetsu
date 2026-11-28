import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

// self-report-story-pdf.ts の Cloudflare 版。課金者だけに配る PDF なので、公開の静的ファイル
// 置き場ではなく、非公開の R2 バケット (wrangler.jsonc の r2_buckets binding "PRIVATE_FILES") に
// private/self-report-stories/ と同じファイル名で置く。認可は呼び出し側 (PDF の入口) が行う。
type PrivateBucket = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
};

export async function readSelfReportStoryPdf(slug: string): Promise<Buffer> {
  const bucket = (getCloudflareContext().env as unknown as { PRIVATE_FILES?: PrivateBucket }).PRIVATE_FILES;
  if (!bucket) {
    throw new Error("[self-report-story-pdf] PRIVATE_FILES binding is not configured");
  }
  const key = `self-report-stories/${slug}-vertical-story.pdf`;
  const object = await bucket.get(key);
  if (!object) {
    throw new Error(`[self-report-story-pdf] not found in R2: ${key}`);
  }
  return Buffer.from(await object.arrayBuffer());
}
