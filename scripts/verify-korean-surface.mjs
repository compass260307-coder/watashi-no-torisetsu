import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const problems = [];

const koreanSourceDirs = [
  "src/app/ko",
  "src/components/ko",
  "src/i18n/ko",
];

const japanesePathPattern =
  /(?:href=|redirect\(|router\.push\()\{?["'`]\/(diagnosis|tako|login|types|about|articles|terms|privacy|legal|purchase-complete|result|share|friend|me|unmei|hoshiyomi|aisho)\b/g;

function walk(dir) {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(child);
    if (!/\.(tsx?|jsx?|mjs)$/.test(entry.name)) return [];
    return [child];
  });
}

for (const file of koreanSourceDirs.flatMap(walk)) {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  for (const match of text.matchAll(japanesePathPattern)) {
    problems.push(`${file}: Japanese route literal "${match[0]}"`);
  }
}

const bottomNav = fs.readFileSync(path.join(ROOT, "src/components/BottomNav.tsx"), "utf8");
if (bottomNav.includes('useState("/diagnosis")')) {
  problems.push("src/components/BottomNav.tsx: torisetsuUrl defaults to /diagnosis");
}
if (bottomNav.includes('useState("/tako")')) {
  problems.push("src/components/BottomNav.tsx: takoUrl defaults to /tako");
}

const friendList = fs.readFileSync(
  path.join(ROOT, "src/components/result/FriendList.tsx"),
  "utf8",
);
if (friendList.includes("href={`/tako/")) {
  problems.push("src/components/result/FriendList.tsx: friend detail link ignores /ko prefix");
}
if (friendList.includes("メッセージあり") && !friendList.includes("메시지 있음")) {
  problems.push("src/components/result/FriendList.tsx: message badge lacks Korean copy");
}

const requiredKoreanFortuneFiles = [
  "src/app/ko/unmei/page.tsx",
  "src/app/ko/hoshiyomi/page.tsx",
  "src/i18n/hoshiyomi.ts",
];
for (const file of requiredKoreanFortuneFiles) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    problems.push(`${file}: required Korean fortune surface is missing`);
  }
}

const localeSwitch = fs.readFileSync(
  path.join(ROOT, "src/lib/locale-switch.ts"),
  "utf8",
);
for (const route of ["/ko/unmei", "/ko/hoshiyomi"]) {
  if (!localeSwitch.includes(route)) {
    problems.push(`src/lib/locale-switch.ts: locale mapping lacks ${route}`);
  }
}

const featureFlags = fs.readFileSync(
  path.join(ROOT, "src/lib/feature-flags.ts"),
  "utf8",
);
if (featureFlags.includes("KO_UNMEI_ENABLED")) {
  problems.push("src/lib/feature-flags.ts: Korean destiny feature is still gated");
}

if (problems.length) {
  console.error(JSON.stringify({ problems }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ problems: [] }, null, 2));
