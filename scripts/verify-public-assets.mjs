// Fail builds when source literals or the character catalogue reference missing files.
// This checks source references, not reachability; dynamic URLs need catalogue checks.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export function verifyPublicAssets(root = process.cwd()) {
  const references = new Map();
  const add = (url, from) => {
    if (!/^\/(?!\/)/.test(url) || url.startsWith("/api/")) return;
    const pathname = url.split(/[?#]/, 1)[0];
    if (!/\.(?:png|webp|jpe?g|gif|svg|ico|avif|mp4|webm|mov|woff2?|ttf|otf|pdf|css|js)$/i.test(pathname)) return;
    references.set(pathname, from);
  };
  function visitFile(file) {
    const source = fs.readFileSync(file, "utf8");
    if (file.endsWith(".css")) {
      for (const match of source.matchAll(/url\(\s*["']?(\/[^\s"')]+)["']?\s*\)/g)) add(match[1], file);
      return;
    }
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text, file);
      // The 32-type catalogue drives template URLs that have no literal full path.
      if (file.endsWith("/thirty-two-content/character-32.ts") &&
          ts.isPropertyAssignment(node) && node.name.getText(ast) === "slug" && ts.isStringLiteral(node.initializer)) {
        add(`/characters/v3/${node.initializer.text}.webp`, file);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:tsx?|jsx?|mjs|css)$/.test(entry.name)) visitFile(file);
    }
  }
  walk(path.join(root, "src"));
  const manifestPath = path.join(root, "src/generated/character-images.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const kind of ["cut", "face", "scenes"]) {
    for (const file of manifest[kind]) add(`/characters/${kind}/${file}`, manifestPath);
  }
  for (const rank of manifest.ranks) add(`/aisho/ranks/${rank}.webp`, manifestPath);
  const missing = [...references].filter(([url]) => !fs.existsSync(path.join(root, "public", decodeURIComponent(url))));
  if (missing.length) {
    throw new Error(`Missing public assets:\n${missing.map(([url, from]) => `${url} (${path.relative(root, from)})`).join("\n")}`);
  }
  console.log(`Public asset references: ${references.size} paths verified`);
  return references.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) verifyPublicAssets();
