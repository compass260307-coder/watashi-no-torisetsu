import {
  existsSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const animDir = resolve(process.cwd(), "public/characters/anim");
const force = process.argv.includes("--force");
const webmFiles = readdirSync(animDir)
  .filter((file) => file.endsWith(".webm"))
  .sort();

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, {
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed (${result.status})`);
  }
}

let generated = 0;
let skipped = 0;

for (const file of webmFiles) {
  const inputPath = join(animDir, file);
  const outputPath = join(animDir, file.replace(/\.webm$/i, ".mov"));
  const tempPath = `${outputPath}.tmp.mov`;

  if (!force && existsSync(outputPath) && statSync(outputPath).size > 0) {
    skipped += 1;
    continue;
  }

  if (existsSync(tempPath)) unlinkSync(tempPath);

  console.log(`${file}: preserving VP9 alpha channel`);

  runFfmpeg([
    "-y",
    "-v",
    "warning",
    "-c:v",
    "libvpx-vp9",
    "-i",
    inputPath,
    "-vf",
    "format=bgra",
    "-c:v",
    "hevc_videotoolbox",
    "-allow_sw",
    "1",
    "-alpha_quality",
    "0.9",
    "-tag:v",
    "hvc1",
    "-an",
    "-movflags",
    "+faststart",
    tempPath,
  ]);

  renameSync(tempPath, outputPath);
  generated += 1;
}

console.log(
  `iOS alpha videos: generated=${generated} skipped=${skipped} total=${webmFiles.length}`,
);
