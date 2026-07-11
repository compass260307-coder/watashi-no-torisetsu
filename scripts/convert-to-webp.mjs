// 一度きりの移行スクリプト: next/image 経由で表示される PNG を near-lossless WebP へ変換する。
// 目的はリポジトリ/デプロイ容量の削減 (ユーザー配信は Next の画像最適化が別途行うため見た目不変)。
// near-lossless なので視覚的な劣化なし。変換後は元 PNG を削除する。
//
// 除外: mascot/ と types/penguin-base.png は LINE Flex メッセージで生 URL 配信され
// WebP 非対応のため対象外。cards/og-characters/ogp は OG/DL の生配信のため対象外。
//
// 実行: node scripts/convert-to-webp.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

// [ディレクトリ, 除外ファイル名(基本名)]
const targets = [
  ["public/characters/v3", []],
  ["public/characters/cut", []],
  ["public/characters/scenes", []],
  ["public/characters/face", []],
  ["public/types", ["penguin-base.png"]],
];

let totalOld = 0;
let totalNew = 0;
let count = 0;

for (const [rel, exclude] of targets) {
  const dir = path.join(root, rel);
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".png"));
  } catch {
    console.warn(`skip (no dir): ${rel}`);
    continue;
  }
  for (const f of files) {
    if (exclude.includes(f)) {
      console.log(`  keep (excluded): ${rel}/${f}`);
      continue;
    }
    const src = path.join(dir, f);
    const out = src.replace(/\.png$/i, ".webp");
    const oldSize = fs.statSync(src).size;
    const buf = await sharp(src)
      .webp({ nearLossless: true, quality: 90, effort: 6 })
      .toBuffer();
    fs.writeFileSync(out, buf);
    fs.unlinkSync(src);
    totalOld += oldSize;
    totalNew += buf.length;
    count++;
  }
  console.log(`done: ${rel}`);
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + "MB";
console.log(
  `\nconverted ${count} files: ${mb(totalOld)} -> ${mb(totalNew)} (-${(
    (1 - totalNew / totalOld) *
    100
  ).toFixed(0)}%)`,
);
