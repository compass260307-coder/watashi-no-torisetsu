// Derive a tiny preload lookup from the existing classifiers and image helper.
// Type text, character biographies and the full asset manifest stay build-only.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { getImageProps } = require("next/image");
const root = process.cwd();
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file, "utf8"));
  const compiledModule = { exports: {} };
  cache.set(file, compiledModule);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const localRequire = id => {
    if (!id.startsWith(".") && !id.startsWith("@/")) return require(id);
    let resolved = id.startsWith("@/") ? path.join(root, "src", id.slice(2)) : path.resolve(path.dirname(file), id);
    if (!path.extname(resolved)) resolved += ".ts";
    return load(resolved);
  };
  vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { process: { env: {} } })(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { classifyThirtyTwoType, thirtyTwoImagePath } = load(path.join(root, "src/lib/thirty-two-types.ts"));
const { preferCutImage } = load(path.join(root, "src/lib/character-image.ts"));
const dimensions = ["O", "C", "E", "A", "N"];
const hints = {};
for (let mask = 0; mask < 32; mask++) {
  const scores = Object.fromEntries(dimensions.map((dimension, index) => [dimension, mask & (1 << index) ? 6 : 4]));
  const key = dimensions.map(dimension => scores[dimension] >= 5 ? "+" : "-").join("");
  const src = preferCutImage(thirtyTwoImagePath(classifyThirtyTwoType(scores)));
  const { props } = getImageProps({ src, alt: "", width: 960, height: 960, sizes: "(min-width: 768px) 600px, 100vw" });
  hints[key] = { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}
// Keep one shared native-image recipe, not 32 repeated srcSet strings.
const first = Object.values(hints)[0];
const firstUrl = new URL(first.src, "http://local.invalid");
const widths = first.srcSet.split(", ").map(item => Number(item.slice(item.lastIndexOf(" ") + 1, -1)));
const recipe = { endpoint: firstUrl.pathname, quality: firstUrl.searchParams.get("q"), deploymentId: firstUrl.searchParams.get("dpl"), widths, sizes: first.sizes, sources: {} };
function imageUrl(source, width) {
  return `${recipe.endpoint}?url=${encodeURIComponent(source)}&w=${width}&q=${recipe.quality}${recipe.deploymentId ? `&dpl=${recipe.deploymentId}` : ""}`;
}
for (const [key, props] of Object.entries(hints)) {
  const source = new URL(props.src, "http://local.invalid").searchParams.get("url");
  if (!source) throw new Error("Missing canonical result image source");
  const src = imageUrl(source, widths[widths.length - 1]);
  const srcSet = widths.map(width => `${imageUrl(source, width)} ${width}w`).join(", ");
  // Fail at build time if a future image-loader/config change cannot be represented.
  if (props.src !== src || props.srcSet !== srcSet || props.sizes !== recipe.sizes) throw new Error("Result image preload recipe differs from getImageProps");
  recipe.sources[key] = source;
}
fs.writeFileSync(path.join(root, "src/generated/result-image-preload.json"), `${JSON.stringify(recipe)}\n`);
console.log("Result image preload: 32 canonical native recipes verified.");
