// Verify the actual deployment traces after either production build command.
// A successful compilation alone does not guarantee Chromium's binaries ship.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binaryDirectory = path.join(root, "node_modules/@sparticuz/chromium/bin");
const binaries = ["al2023.tar.br", "chromium.br", "fonts.tar.br", "swiftshader.tar.br"];

const routes = ["report/[token]/pdf", "tako-report/[token]/pdf"];
for (const route of routes) {
  const tracePath = path.join(root, ".next/server/app", route, "route.js.nft.json");
  const trace = JSON.parse(readFileSync(tracePath, "utf8"));
  const tracedFiles = new Set(
    trace.files.map((file) => path.resolve(path.dirname(tracePath), file)),
  );

  for (const binary of binaries) {
    const binaryPath = path.join(binaryDirectory, binary);
    assert(
      tracedFiles.has(binaryPath),
      `/${route}: deployment trace is missing Chromium's ${binary}`,
    );
    assert(statSync(binaryPath).size > 0, `Chromium's ${binary} is empty`);
  }
}

console.log(
  `PDF runtime verified: ${binaries.length} Chromium binaries in each of ${routes.length} PDF route traces.`,
);
