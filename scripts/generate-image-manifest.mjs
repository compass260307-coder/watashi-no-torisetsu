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
//
// v3/cut/scenes/face は near-lossless WebP へ移行済み (容量削減・見た目不変)。
// 余白計測は sharp で raw アルファを読むためフォーマット非依存。
// aisho/ranks は LINE/OG 都合で PNG のまま。
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const listDir = (rel, ext = ".webp") => {
  try {
    return fs
      .readdirSync(path.join(root, "public", rel))
      .filter((f) => f.toLowerCase().endsWith(ext))
      .sort();
  } catch {
    return [];
  }
};

// 画像の上下端の透過余白を割合で返す { top, bottom }。
//   top    = 上端〜最初の不透明行 / 高さ
//   bottom = 最後の不透明行〜下端 / 高さ (下側の透過余白の割合)
// sharp で RGBA raw を読むので PNG/WebP どちらでも動く。
// 失敗時は null (呼び出し側で既定挙動にフォールバック)。
async function alphaMargins(file) {
  try {
    const { data, info } = await sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels } = info;
    const stride = w * channels;
    let firstOpaque = -1;
    let lastOpaque = -1;
    for (let y = 0; y < h; y++) {
      const rowOff = y * stride;
      // ノイズ除け: alpha>20 のピクセルが 4 つ以上ある行を「絵のある行」とみなす
      let opaque = 0;
      for (let x = 0; x < w; x++) {
        const a = data[rowOff + x * channels + (channels - 1)];
        if (a > 20 && ++opaque >= 4) break;
      }
      if (opaque >= 4) {
        if (firstOpaque === -1) firstOpaque = y;
        lastOpaque = y;
      }
    }
    if (firstOpaque === -1) return { top: 1, bottom: 1 };
    return {
      top: Math.round((firstOpaque / h) * 1000) / 1000,
      bottom: Math.round(((h - 1 - lastOpaque) / h) * 1000) / 1000,
    };
  } catch {
    return null;
  }
}

const cut = listDir("characters/cut");
const cutTopMargin = {};
const cutBottomMargin = {};
for (const f of cut) {
  const m = await alphaMargins(
    path.join(root, "public", "characters", "cut", f),
  );
  if (m !== null) {
    cutTopMargin[f] = m.top;
    cutBottomMargin[f] = m.bottom;
  }
}

const manifest = {
  cut,
  scenes: listDir("characters/scenes"),
  // 顔ズーム版 (16P の顔アバター風・/aisho のキャラカード用)。
  // public/characters/face/<slug>.webp を置くだけで次のビルドから自動使用。
  face: listDir("characters/face"),
  // 相性ランク画像 (S/A/B/C)。public/aisho/ranks/<S|A|B|C>.webp を置くだけで
  // 結果ページの主役表示に使われる (無いランクは文字バッジにフォールバック)。
  ranks: listDir("aisho/ranks", ".webp").map((f) => f.replace(/\.webp$/, "")),
  cutTopMargin,
  cutBottomMargin,
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
