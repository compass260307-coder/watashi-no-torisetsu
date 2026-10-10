// Rebuild the loading animation from its original 5-second MP4, without redrawing it.
// Usage: node scripts/generate-analyzing-alpha-video.mjs /path/to/analyzing-loop.mp4
// Requires FFmpeg on macOS (HEVC with alpha uses VideoToolbox).
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import sharp from "sharp";

const input = process.argv[2] && resolve(process.argv[2]);
if (!input || !existsSync(input)) {
  throw new Error("Pass the original analyzing-loop.mp4 as the first argument.");
}

const output = resolve("public/mascot");
const assetName = "analyzing-loop-transparent";
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

// Remove only neutral pixels connected to the outside of the canvas. This
// preserves the pale faces and book pages enclosed by the character outlines.
async function removeBackground(inputFrame, outputFrame) {
  const { data, info } = await sharp(inputFrame).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const count = width * height;
  const visited = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let start = 0;
  let end = 0;
  function visit(pixel) {
    if (visited[pixel]) return;
    visited[pixel] = 1;
    const offset = pixel * 4;
    const min = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const max = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    if (min >= 220 && max - min <= 22) queue[end++] = pixel;
  }
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (start < end) {
    const pixel = queue[start++];
    const x = pixel % width;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < count - width) visit(pixel + width);
  }
  for (let i = 0; i < end; i++) {
    const offset = queue[i] * 4;
    const min = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const alpha = Math.max(0, Math.min(1, (244 - min) / 24));
    data[offset + 3] = Math.round(alpha * 255);
    // Undo the original white matte at soft edges to avoid a white halo.
    for (let channel = 0; channel < 3; channel++) {
      data[offset + channel] = alpha === 0 ? 0 : Math.max(0, Math.min(255,
        Math.round((data[offset + channel] - (1 - alpha) * 249) / alpha)));
    }
  }
  // This strip contains only empty background and the source watermark.
  for (let pixel = 560 * width; pixel < count; pixel++) data[pixel * 4 + 3] = 0;
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(outputFrame);
}

try {
  const originalFrames = join(temporary, "original");
  const alphaFrames = join(temporary, "alpha");
  mkdirSync(originalFrames);
  mkdirSync(alphaFrames);
  const master = join(temporary, "alpha.mkv");
  ffmpeg([
    "-i", input,
    "-vf", "fps=24,scale=832:624:flags=lanczos", join(originalFrames, "%04d.png"),
  ]);
  for (const frame of readdirSync(originalFrames).sort()) {
    await removeBackground(join(originalFrames, frame), join(alphaFrames, frame));
  }
  ffmpeg([
    "-framerate", "24", "-i", join(alphaFrames, "%04d.png"),
    "-c:v", "ffv1", "-pix_fmt", "bgra", "-an", master,
  ]);
  ffmpeg([
    "-i", master, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
    "-b:v", "0", "-crf", "32", "-deadline", "good", "-cpu-used", "4",
    "-auto-alt-ref", "0", "-an", join(output, `${assetName}.webm`),
  ]);
  ffmpeg([
    "-i", master, "-c:v", "hevc_videotoolbox", "-pix_fmt", "bgra",
    "-allow_sw", "1", "-alpha_quality", "0.9", "-b:v", "700k",
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
