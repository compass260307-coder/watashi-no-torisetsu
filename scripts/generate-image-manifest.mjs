// public/characters/{cut,scenes} のファイル一覧をビルド前に JSON 化する。
// /me/[token] がランタイム fs.existsSync で画像の有無を判定していたところ、
// 動的パスのせいでトレーサーが public/ 全体 (約350MB) を Vercel Function に
// 同梱し 250MB 上限を超えたため、存在チェックをビルド時に前倒しする。
// 「画像を置くだけで自動表示」の運用はこのスクリプトが吸収する
// (追加したら次のビルドで反映)。
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const listDir = (rel) => {
  try {
    return fs.readdirSync(path.join(root, "public", rel)).filter((f) => f.endsWith(".png")).sort();
  } catch {
    return [];
  }
};

const manifest = {
  cut: listDir("characters/cut"),
  scenes: listDir("characters/scenes"),
};

const outDir = path.join(root, "src", "generated");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "character-images.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `character-images.json: cut=${manifest.cut.length} scenes=${manifest.scenes.length}`,
);
