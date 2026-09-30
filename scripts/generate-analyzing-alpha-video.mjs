// Rebuild the loading animation from its original 5-second MP4, without redrawing it.
// Usage: node scripts/generate-analyzing-alpha-video.mjs /path/to/analyzing-loop.mp4
// Requires FFmpeg on macOS (HEVC with alpha uses VideoToolbox).
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import sharp from "sharp";

const input = process.argv[2] && resolve(process.argv[2]);
if (!input || !existsSync(input)) {
  throw new Error("Pass the original analyzing-loop.mp4 as the first argument.");
}

const output = resolve("public/mascot");
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

try {
  const master = join(temporary, "alpha.mkv");
  // The source's neutral background is RGB 249/249/249. A narrow key preserves
  // the cream faces/books; the blend softens the original antialiased edges.
  // The bottom strip contains only empty background and the original watermark.
  // Keep the full canvas size so the animation retains its previous framing.
  ffmpeg([
    "-i", input,
    "-vf", "scale=832:624:flags=lanczos,format=rgba,colorkey=0xf9f9f9:0.018:0.025,crop=832:560:0:0,pad=832:624:0:0:color=black@0",
    "-c:v", "ffv1", "-pix_fmt", "bgra", "-an", master,
  ]);
  ffmpeg([
    "-i", master, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
    "-b:v", "0", "-crf", "32", "-deadline", "good", "-cpu-used", "4",
    "-auto-alt-ref", "0", "-an", join(output, "analyzing-loop-alpha.webm"),
  ]);
  ffmpeg([
    "-i", master, "-c:v", "hevc_videotoolbox", "-pix_fmt", "bgra",
    "-allow_sw", "1", "-alpha_quality", "0.9", "-b:v", "700k",
    "-tag:v", "hvc1", "-an", "-movflags", "+faststart",
    join(output, "analyzing-loop-alpha.mov"),
  ]);
  ffmpeg([
    "-i", master, "-frames:v", "1", "-update", "1", join(temporary, "poster.png"),
  ]);
  await sharp(join(temporary, "poster.png"))
    .webp({ quality: 85, alphaQuality: 100 })
    .toFile(join(output, "analyzing-loop-alpha-poster.webp"));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
