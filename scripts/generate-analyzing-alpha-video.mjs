// Rebuild the loading animation from its original 5-second MP4, without redrawing it.
// Usage: node scripts/generate-analyzing-alpha-video.mjs /path/to/analyzing-loop.mp4
// Requires FFmpeg and Swift on macOS 14+ (Vision foreground segmentation); HEVC with alpha uses VideoToolbox.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const input = process.argv[2] && resolve(process.argv[2]);
if (!input || !existsSync(input)) {
  throw new Error("Pass the original analyzing-loop.mp4 as the first argument.");
}

const output = resolve("public/mascot");
const assetName = "analyzing-loop-cutout-v2";
const scratch = resolve(".codex_tmp");
mkdirSync(scratch, { recursive: true });
const temporary = mkdtempSync(join(scratch, "analyzing-alpha-"));

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-y", "-v", "warning", ...args], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`FFmpeg exited with ${result.status}`);
}

// Vision segments the complete subject instead of retaining pale floor shadows.
// Undo the source white matte along the soft contour; keep pale faces and books.
async function removeBackground(inputFrame, maskFrame, outputFrame) {
  const { data, info } = await sharp(inputFrame).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const mask = await sharp(maskFrame).greyscale().raw().toBuffer();
  // Vision includes a thin fringe of the source white canvas. Contract its soft
  // mask by two source pixels (less than one displayed pixel) before unmatting.
  const horizontal = Buffer.alloc(mask.length);
  const contracted = Buffer.alloc(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let alpha = 255;
      for (let dx = -2; dx <= 2; dx++) {
        alpha = Math.min(alpha, mask[y * width + Math.max(0, Math.min(width - 1, x + dx))]);
      }
      horizontal[y * width + x] = alpha;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let alpha = 255;
      for (let dy = -2; dy <= 2; dy++) {
        alpha = Math.min(alpha, horizontal[Math.max(0, Math.min(height - 1, y + dy)) * width + x]);
      }
      contracted[y * width + x] = alpha;
    }
  }
  let steam = Buffer.alloc(width * height, 255);
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const offset = pixel * 4;
    const min = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const max = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    // The generated off-white puff beside the chimney is part of the backdrop.
    // Limit color cleanup to that area so cream faces and pages stay intact.
    if (x > 553 && y < 178 && min >= 205 && max - min <= 65) steam[pixel] = 0;
  }
  steam = await sharp(steam, { raw: { width, height, channels: 1 } })
    .blur(0.6).greyscale().raw().toBuffer();
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const offset = pixel * 4;
    const y = Math.floor(pixel / width);
    // Explicitly clear the entire watermark strip in every frame.
    const alpha = y >= 560 ? 0 : (contracted[pixel] / 255) * (steam[pixel] / 255);
    data[offset + 3] = Math.round(alpha * 255);
    for (let channel = 0; channel < 3; channel++) {
      data[offset + channel] = alpha === 0 ? 0 : Math.max(0, Math.min(255,
        Math.round((data[offset + channel] - (1 - alpha) * 249) / alpha)));
    }
  }
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(outputFrame);
}

try {
  const originalFrames = join(temporary, "original");
  const alphaFrames = join(temporary, "alpha");
  const maskFrames = join(temporary, "masks");
  mkdirSync(originalFrames);
  mkdirSync(alphaFrames);
  mkdirSync(maskFrames);
  const master = join(temporary, "alpha.mkv");
  ffmpeg([
    "-i", input,
    "-vf", "fps=24,scale=832:624:flags=lanczos", join(originalFrames, "%04d.png"),
  ]);
  const segmentation = spawnSync("swift", [
    "-module-cache-path", join(temporary, "swift-cache"),
    join(dirname(fileURLToPath(import.meta.url)), "analyzing-foreground-mask.swift"),
    originalFrames, maskFrames,
  ], { stdio: "inherit", env: {
    ...process.env, CLANG_MODULE_CACHE_PATH: join(temporary, "clang-cache"),
  } });
  if (segmentation.error) throw segmentation.error;
  if (segmentation.status !== 0) throw new Error("Foreground segmentation failed");
  for (const frame of readdirSync(originalFrames).sort()) {
    await removeBackground(join(originalFrames, frame), join(maskFrames, frame),
      join(alphaFrames, frame));
  }
  ffmpeg([
    "-framerate", "24", "-i", join(alphaFrames, "%04d.png"),
    "-c:v", "ffv1", "-pix_fmt", "bgra", "-an", master,
  ]);
  ffmpeg([
    "-i", master, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
    "-b:v", "0", "-crf", "24", "-deadline", "good", "-cpu-used", "4",
    "-auto-alt-ref", "0", "-an", join(output, `${assetName}.webm`),
  ]);
  ffmpeg([
    "-i", master,
    // VideoToolbox defaults to premultiplied alpha. VP9/poster use straight
    // alpha; explicitly premultiply HEVC input to prevent Safari white fringes.
    "-vf", "format=gbrap,premultiply=inplace=1,format=bgra",
    "-c:v", "hevc_videotoolbox", "-pix_fmt", "bgra",
    "-allow_sw", "1", "-alpha_quality", "1", "-b:v", "1200k",
    "-tag:v", "hvc1", "-an", "-movflags", "+faststart",
    join(output, `${assetName}.mp4`),
  ]);
  ffmpeg([
    "-i", master, "-frames:v", "1", "-update", "1", join(temporary, "poster.png"),
  ]);
  await sharp(join(temporary, "poster.png"))
    .webp({ quality: 85, alphaQuality: 100 })
    .toFile(join(output, `${assetName}-poster.webp`));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
