import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

// line-upgrade-image-render.ts の Cloudflare 版。Workers では sharp (ネイティブ部品) が
// 動かないので、Cloudflare の画像変換 (wrangler.jsonc の images binding "IMAGES") を使う。
// 出力の条件は sharp 版と同じ: 長辺を 720 / 2048 以内に収め (拡大しない)、透明部分は白、
// JPEG の品質は 75 / 85。
type ImageTransformer = {
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: Record<string, unknown>): {
      output(options: { format: string; quality?: number }): Promise<{ response(): Response }>;
    };
  };
};

export async function renderLineUpgradeJpeg(input: ArrayBuffer, preview: boolean): Promise<Uint8Array> {
  const images = (getCloudflareContext().env as unknown as { IMAGES?: ImageTransformer }).IMAGES;
  if (!images) {
    throw new Error("[line-upgrade-image] IMAGES binding is not configured");
  }
  const size = preview ? 720 : 2048;
  const result = await images
    .input(new Blob([input]).stream())
    .transform({ width: size, height: size, fit: "scale-down", background: "#ffffff" })
    .output({ format: "image/jpeg", quality: preview ? 75 : 85 });
  return new Uint8Array(await result.response().arrayBuffer());
}
