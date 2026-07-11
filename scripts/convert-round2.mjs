// 軽量化 第2弾。一度きりの移行スクリプト。
//  - cards/*.png (OG/DL 生配信・不透明): 高品質 JPEG q92 4:4:4 (mozjpeg) へ。
//    universal 互換 (OG/LINE/DL) を保ちつつ最大削減。テキストの鮮明さ維持のため 4:4:4。
//  - aisho/ranks・tako/ato-*・characters/keyvisual{,-mobile}: near-lossless WebP。
// 変換後は元 PNG を削除する。
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const mb = (n) => (n / 1024 / 1024).toFixed(1) + "MB";

async function convertDir(rel, encode, ext, filterFn = () => true) {
  const dir = path.join(root, rel);
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f) && filterFn(f));
  } catch {
    console.warn(`skip (no dir): ${rel}`);
    return [0, 0, 0];
  }
  let oldT = 0, newT = 0, n = 0;
  for (const f of files) {
    const src = path.join(dir, f);
    const out = src.replace(/\.png$/i, ext);
    const oldSize = fs.statSync(src).size;
    const buf = await encode(sharp(src)).toBuffer();
    fs.writeFileSync(out, buf);
    fs.unlinkSync(src);
    oldT += oldSize; newT += buf.length; n++;
  }
  console.log(`  ${rel}: ${n} files ${mb(oldT)} -> ${mb(newT)}`);
  return [oldT, newT, n];
}

const jpeg = (s) => s.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" });
const webpNL = (s) => s.webp({ nearLossless: true, quality: 90, effort: 6 });

let O = 0, N = 0;
console.log("cards -> JPEG q92 4:4:4:");
let r = await convertDir("public/cards", jpeg, ".jpg"); O += r[0]; N += r[1];
console.log("safe WebP (near-lossless):");
for (const d of ["public/aisho/ranks", "public/tako", "public/characters"]) {
  // tako は ato-*.png のみ、characters は keyvisual*.png のみ対象
  const filter =
    d === "public/tako" ? (f) => f.startsWith("ato-")
    : d === "public/characters" ? (f) => f.startsWith("keyvisual")
    : () => true;
  r = await convertDir(d, webpNL, ".webp", filter); O += r[0]; N += r[1];
}
console.log(`\nTOTAL: ${mb(O)} -> ${mb(N)} (-${((1 - N / O) * 100).toFixed(0)}%)`);
