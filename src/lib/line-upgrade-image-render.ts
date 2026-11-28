import "server-only";

import sharp from "sharp";

// LINE のリザルトアップグレード画像を、配信用の JPEG に整える (Vercel 用)。
// Cloudflare 向けビルド (DEPLOY_TARGET=cloudflare) では next.config.ts の resolveAlias により
// line-upgrade-image-render.cloudflare.ts に差し替わる (Workers では sharp が動かないため)。
export async function renderLineUpgradeJpeg(input: ArrayBuffer, preview: boolean): Promise<Uint8Array> {
  const size = preview ? 720 : 2048;
  const output = await sharp(Buffer.from(input), { limitInputPixels: 24_000_000 })
    .rotate()
    .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: preview ? 75 : 85 })
    .toBuffer();
  return new Uint8Array(output);
}
