import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const sourceDir = resolve(process.cwd(), "public/characters/anim");
const outputDir = resolve(process.cwd(), "public/characters/anim-mobile");
const force = process.argv.includes("--force");
const webmFiles = readdirSync(sourceDir)
  .filter((file) => file.endsWith(".webm"))
  .sort();

const width = 480;
const height = 480;
const framesPerSecond = 10;
const frameDurationMs = Math.round(1000 / framesPerSecond);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status})`);
  }
}

mkdirSync(outputDir, { recursive: true });

let generated = 0;
let skipped = 0;

for (const file of webmFiles) {
  const sourcePath = join(sourceDir, file);
  const outputPath = join(outputDir, file.replace(/\.webm$/i, ".webp"));

  if (!force && existsSync(outputPath) && statSync(outputPath).size > 0) {
    skipped += 1;
    continue;
  }

  const frameDir = mkdtempSync(join(tmpdir(), "character-webp-"));
  const tempOutput = join(frameDir, "animation.webp");

  try {
    console.log(`${file}: creating mobile alpha animation`);

    run("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-c:v",
      "libvpx-vp9",
      "-i",
      sourcePath,
      "-vf",
      `fps=${framesPerSecond},scale=${width}:${height}:flags=lanczos`,
      "-an",
      join(frameDir, "frame%03d.png"),
    ]);

    const frames = readdirSync(frameDir)
      .filter((frame) => /^frame\d+\.png$/.test(frame))
      .sort();

    if (frames.length === 0) {
      throw new Error(`No frames were generated for ${file}`);
    }

    const webpArgs = ["-loop", "0", "-mixed", "-kmin", "9", "-kmax", "10"];
    for (const frame of frames) {
      webpArgs.push(
        "-d",
        String(frameDurationMs),
        "-lossy",
        "-q",
        "72",
        "-m",
        "4",
        "-exact",
        join(frameDir, frame),
      );
    }
    webpArgs.push("-o", tempOutput);

    run("img2webp", webpArgs);
    renameSync(tempOutput, outputPath);
    generated += 1;
  } finally {
    rmSync(frameDir, { recursive: true, force: true });
  }
}

console.log(
  `Mobile alpha WebP: generated=${generated} skipped=${skipped} total=${webmFiles.length}`,
);
