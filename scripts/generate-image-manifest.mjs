// public/characters/{cut,scenes} のファイル一覧をビルド前に JSON 化する。
// /me/[token] がランタイム fs.existsSync で画像の有無を判定していたところ、
// 動的パスのせいでトレーサーが public/ 全体 (約350MB) を Vercel Function に
// 同梱し 250MB 上限を超えたため、存在チェックをビルド時に前倒しする。
// 「画像を置くだけで自動表示」の運用はこのスクリプトが吸収する
// (追加したら次のビルドで反映)。
//
// 追加: cut 画像は「上端の透過余白の割合」(cutTopMargin: 0〜1) も計測する。
// /me ヒーローは SP で画像を -mt-8 引き上げて OCEAN 行と詰めているが、
// 家などで上端まで絵が詰まったキャラは称号/OCEAN に被るため、
// 余白の少ないキャラだけ引き上げを自動で弱める用 (page.tsx 側で参照)。
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const listDir = (rel) => {
  try {
    return fs.readdirSync(path.join(root, "public", rel)).filter((f) => f.endsWith(".png")).sort();
  } catch {
    return [];
  }
};

// PNG の上端から「実質不透明なピクセルが現れる行」を探し、高さに対する割合を返す。
// 8bit RGBA・非インターレースのみ対応 (cut 画像はすべてこの形式)。
// 対応外・パース失敗は null (呼び出し側で既定挙動にフォールバック)。
function pngTopAlphaFraction(file) {
  try {
    const buf = fs.readFileSync(file);
    // シグネチャ確認
    if (buf.readUInt32BE(0) !== 0x89504e47) return null;
    let pos = 8;
    let w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
    const idats = [];
    while (pos + 12 <= buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString("ascii", pos + 4, pos + 8);
      const data = buf.subarray(pos + 8, pos + 8 + len);
      if (type === "IHDR") {
        w = data.readUInt32BE(0);
        h = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
        interlace = data[12];
      } else if (type === "IDAT") {
        idats.push(data);
      } else if (type === "IEND") {
        break;
      }
      pos += 12 + len;
    }
    if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) return null;
    const raw = zlib.inflateSync(Buffer.concat(idats));
    const bpp = 4;
    const stride = w * bpp;
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < h; y++) {
      const off = y * (stride + 1);
      const filter = raw[off];
      const row = Buffer.from(raw.subarray(off + 1, off + 1 + stride));
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? row[x - bpp] : 0;
        const b = prev[x];
        const c = x >= bpp ? prev[x - bpp] : 0;
        let v = row[x];
        switch (filter) {
          case 1: v = (v + a) & 255; break;
          case 2: v = (v + b) & 255; break;
          case 3: v = (v + ((a + b) >> 1)) & 255; break;
          case 4: {
            const p = a + b - c;
            const pa = Math.abs(p - a);
            const pb = Math.abs(p - b);
            const pc = Math.abs(p - c);
            const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            v = (v + pr) & 255;
            break;
          }
        }
        row[x] = v;
      }
      prev = row;
      // ノイズ除け: alpha>20 のピクセルが 4 つ以上ある行を「絵の始まり」とみなす
      let opaque = 0;
      for (let x = 3; x < stride; x += 4) {
        if (row[x] > 20 && ++opaque >= 4) return Math.round((y / h) * 1000) / 1000;
      }
    }
    return 1;
  } catch {
    return null;
  }
}

const cut = listDir("characters/cut");
const cutTopMargin = {};
for (const f of cut) {
  const frac = pngTopAlphaFraction(path.join(root, "public", "characters", "cut", f));
  if (frac !== null) cutTopMargin[f] = frac;
}

const manifest = {
  cut,
  scenes: listDir("characters/scenes"),
  // 顔ズーム版 (16P の顔アバター風・/aisho のキャラカード用)。
  // public/characters/face/<slug>.png を置くだけで次のビルドから自動使用。
  face: listDir("characters/face"),
  // 相性ランク画像 (S/A/B/C)。public/aisho/ranks/<S|A|B|C>.png を置くだけで
  // 結果ページの主役表示に使われる (無いランクは文字バッジにフォールバック)。
  ranks: listDir("aisho/ranks").map((f) => f.replace(/\.png$/, "")),
  cutTopMargin,
};

const outDir = path.join(root, "src", "generated");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "character-images.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `character-images.json: cut=${manifest.cut.length} scenes=${manifest.scenes.length} face=${manifest.face.length} topMargin=${Object.keys(cutTopMargin).length}`,
);
