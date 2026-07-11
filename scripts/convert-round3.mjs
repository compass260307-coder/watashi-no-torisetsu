// 軽量化 第3弾。一度きり。
//  - characters/{cut,v3,scenes,face}/*.webp: near-lossless → lossy q85 に再エンコード(in place)。
//    これらは next/image 経由でユーザーには ~q75 で配信されるため、ソースを q85 に下げても
//    体感はほぼ不変。ファイル名は不変なので参照/マニフェスト変更不要。
//    (keyvisual は CSS 背景で生配信のため対象外)
//  - heading-*.png / decorations/{heart-pink,flower-yellow}.png: near-lossless WebP へ。
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const mb = (n) => (n / 1024 / 1024).toFixed(1) + "MB";

// 1) キャラ原画 webp を q85 で再エンコード (in place, 同名)
const charDirs = ["characters/cut", "characters/v3", "characters/scenes", "characters/face"];
let cO = 0, cN = 0, cn = 0;
for (const rel of charDirs) {
  const dir = path.join(root, "public", rel);
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".webp"));
  for (const f of files) {
    const p = path.join(dir, f);
    const old = fs.statSync(p).size;
    const buf = await sharp(p).webp({ quality: 85, effort: 6 }).toBuffer();
    fs.writeFileSync(p, buf);
    cO += old; cN += buf.length; cn++;
  }
  console.log(`  requant ${rel}: done`);
}
console.log(`characters q85: ${cn} files ${mb(cO)} -> ${mb(cN)}`);

// 2) heading-*.png / decorations → near-lossless WebP (png 削除)
const pngTargets = [
  "heading-ranking.png",
  "heading-ranking-promo.png",
  "heading-friend-invite.png",
  "decorations/heart-pink.png",
  "decorations/flower-yellow.png",
];
let pO = 0, pN = 0, pn = 0;
for (const rel of pngTargets) {
  const src = path.join(root, "public", rel);
  if (!fs.existsSync(src)) { console.warn(`  skip (missing): ${rel}`); continue; }
  const out = src.replace(/\.png$/i, ".webp");
  const old = fs.statSync(src).size;
  const buf = await sharp(src).webp({ nearLossless: true, quality: 90, effort: 6 }).toBuffer();
  fs.writeFileSync(out, buf);
  fs.unlinkSync(src);
  pO += old; pN += buf.length; pn++;
}
console.log(`heading/decorations webp: ${pn} files ${mb(pO)} -> ${mb(pN)}`);
console.log(`\nTOTAL: ${mb(cO + pO)} -> ${mb(cN + pN)} (-${((1 - (cN + pN) / (cO + pO)) * 100).toFixed(0)}%)`);
