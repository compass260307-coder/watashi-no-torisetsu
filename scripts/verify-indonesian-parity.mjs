import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function walkPages(directory, route = "") {
  return fs
    .readdirSync(path.join(ROOT, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const childDirectory = path.join(directory, entry.name);
      const childRoute = `${route}/${entry.name}`;
      if (entry.isDirectory()) return walkPages(childDirectory, childRoute);
      return entry.name === "page.tsx" ? [route || "/"] : [];
    });
}

function equalSets(label, left, right) {
  const leftOnly = [...left].filter((item) => !right.has(item)).sort();
  const rightOnly = [...right].filter((item) => !left.has(item)).sort();
  if (leftOnly.length || rightOnly.length) {
    failures.push(
      `${label}: Japanese-only [${leftOnly.join(", ") || "none"}], Indonesian-only [${rightOnly.join(", ") || "none"}]`,
    );
  }
}

const japaneseRoutes = new Set(
  walkPages("src/app").filter(
    (route) =>
      !["/api", "/dev", "/en", "/ko", "/id", "/line", "/liff"].some(
        (prefix) => route === prefix || route.startsWith(`${prefix}/`),
      ),
  ),
);
const indonesianRoutes = new Set(walkPages("src/app/id"));
equalSets("route parity", japaneseRoutes, indonesianRoutes);

const jaQuestions = read("src/lib/questions.ts");
const idQuestions = read("src/i18n/id/diagnosis.ts");
const jaQuestionIds = [
  ...jaQuestions.matchAll(/\{\s*id:\s*(\d+),\s*text:/g),
].map((match) => Number(match[1]));
const idQuestionIds = [
  ...idQuestions.matchAll(/\{\s*id:\s*(\d+),\s*text:/g),
].map((match) => Number(match[1]));
if (
  jaQuestionIds.length !== 50 ||
  idQuestionIds.length !== 50 ||
  jaQuestionIds.some((id, index) => id !== idQuestionIds[index])
) {
  failures.push(
    `diagnosis parity: Japanese=${jaQuestionIds.length}, Indonesian=${idQuestionIds.length}`,
  );
}

function questionScoringSignature(source) {
  return [
    ...source.matchAll(
      /\{\s*id:\s*(\d+),\s*text:[\s\S]*?facetId:\s*"([^"]+)",\s*dimension:\s*"([^"]+)",\s*reversed:\s*(true|false)\s*\}/g,
    ),
  ].map((match) =>
    [Number(match[1]), match[2], match[3], match[4]].join(":"),
  );
}
const jaQuestionScoring = questionScoringSignature(jaQuestions);
const idQuestionScoring = questionScoringSignature(idQuestions);
if (
  jaQuestionScoring.length !== 50 ||
  idQuestionScoring.length !== 50 ||
  jaQuestionScoring.some(
    (signature, index) => signature !== idQuestionScoring[index],
  )
) {
  failures.push(
    "diagnosis scoring parity: Indonesian facet, dimension, or reverse-scoring metadata differs from Japanese",
  );
}

const jaArticleSlugs = new Set(
  [...read("src/lib/articles.ts").matchAll(/^\s*slug:\s*"([^"]+)"/gm)].map(
    (match) => match[1],
  ),
);
const idArticleSlugs = new Set(
  [...read("src/lib/articles-id.ts").matchAll(/\bslug:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  ),
);
equalSets("article parity", jaArticleSlugs, idArticleSlugs);

const idResult = read("src/i18n/id/result.ts");
const idTypeIds = new Set(
  [...idResult.matchAll(/^\s*"([a-z-]+__[NR])":\s*\{/gm)].map(
    (match) => match[1],
  ),
);
const jaTypeIds = new Set(
  [
    ...read("src/lib/thirty-two-content/self-result-32.ts").matchAll(
      /^\s*"([a-z-]+__[NR])":\s*\[/gm,
    ),
  ].map((match) => match[1]),
);
const idTypeCount = idTypeIds.size;
if (idTypeCount !== 32)
  failures.push(
    `type parity: expected 32 Indonesian types, found ${idTypeCount}`,
  );
equalSets("result type parity", jaTypeIds, idTypeIds);

const idMe = read("src/i18n/id/me.ts");
if ((idMe.match(/\bgated:\s*(?:true|false)/g) ?? []).length !== 12) {
  failures.push("what-if parity: Indonesian must define 12 scenarios");
}
function sceneSignatures(source) {
  const start = source.indexOf("const SCENES");
  const end = source.indexOf("export function build", start);
  if (start < 0 || end < 0) return [];
  return [
    ...source
      .slice(start, end)
      .matchAll(
        /gated:\s*(true|false),[\s\S]*?main:\s*\{\s*dim:\s*"([A-Z])"[\s\S]*?spice:\s*\{\s*dim:\s*"([A-Z])"/g,
      ),
  ].map((match) => `${match[1]}:${match[2]}:${match[3]}`);
}
const jaSceneSignatures = sceneSignatures(read("src/lib/moshimo-resolve.ts"));
const idSceneSignatures = sceneSignatures(idMe);
if (
  jaSceneSignatures.length !== 12 ||
  idSceneSignatures.length !== 12 ||
  jaSceneSignatures.some(
    (signature, index) => signature !== idSceneSignatures[index],
  )
) {
  failures.push(
    "what-if scoring parity: gate, main dimension, or spice dimension differs from Japanese",
  );
}
for (const marker of [
  "likable: idLikable(scores)",
  "...DIMS.map((dim) => ({ title: `Kekuatan",
  "...DIMS.map((dim) => ({ title: `Saat",
  "relations: unlocked ? idRelations(scores) : null",
  "sceneCautions: unlocked ? idSceneCautions(scores) : null",
]) {
  if (!idMe.includes(marker))
    failures.push(`result structure parity: missing ${marker}`);
}

const idBirthRegions = read("src/lib/unmei/id-birth-regions.ts");
const idBirthRegionCount = (idBirthRegions.match(/\{ value:/g) ?? []).length;
if (idBirthRegionCount !== 38) {
  failures.push(
    `birth-region parity: expected 38 Indonesian provinces, found ${idBirthRegionCount}`,
  );
}

const localeSwitch = read("src/lib/locale-switch.ts");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const suffix of [
  "/about",
  "/diagnosis",
  "/terms",
  "/privacy",
  "/legal/commerce",
  "/login",
  "/login/confirm",
  "/auth/error",
  "/result",
  "/purchase-complete",
  "/aisho",
  "/types",
  "/articles",
  "/unmei",
  "/hoshiyomi",
  "/tarot",
]) {
  const idTarget = `/id${suffix}`;
  for (const localePrefix of ["", "/ko", "/en", "/id"]) {
    const source = `${localePrefix}${suffix}`;
    const mapping = new RegExp(
      `"${escapeRegex(source)}"\\s*:\\s*\\{[^}]*\\bid\\s*:\\s*"${escapeRegex(idTarget)}"[^}]*\\}`,
      "s",
    );
    if (!mapping.test(localeSwitch)) {
      failures.push(
        `locale-switch parity: ${source} does not map to ${idTarget}`,
      );
    }
  }
}
for (const source of [
  "/tako",
  "/ko/friend",
  "/en/friend",
  "/id/friend",
  "/ko/tako",
  "/en/tako",
  "/id/tako",
]) {
  const mapping = new RegExp(
    `"${escapeRegex(source)}"\\s*:\\s*\\{[^}]*\\bid\\s*:\\s*"/id/tako"[^}]*\\}`,
    "s",
  );
  if (!mapping.test(localeSwitch)) {
    failures.push(`locale-switch parity: ${source} does not map to /id/tako`);
  }
}
if (
  !localeSwitch.includes(
    "${localePrefix(targetLocale)}/tako/${tokenPath}/friend/${perceptionPath}",
  )
) {
  failures.push(
    "locale-switch parity: friend-detail routes do not preserve Indonesian locale",
  );
}

const diagnosisRoute = read("src/app/api/diagnosis/route.ts");
if (
  /postDiagnosisReportEmail\s*&&\s*locale !== "en"\s*&&\s*locale !== "id"/.test(
    diagnosisRoute,
  )
) {
  failures.push(
    "email parity: Indonesian detailed-report delivery is disabled",
  );
}
if (!/postDiagnosisReportEmail\s*&&\s*locale !== "en"/.test(diagnosisRoute)) {
  failures.push(
    "email parity: Indonesian detailed-report delivery guard is missing",
  );
}

const criticalChecks = [
  [
    "friend result",
    "src/components/result/FriendIndividualResultPage.tsx",
    "← Kembali ke semua pandangan teman",
  ],
  ["friend analysis", "src/lib/perception-view.ts", "buildIdSelfSections"],
  [
    "friend paywall",
    "src/components/result/FriendIndividualPaywall.tsx",
    'isId ? "Buka Edisi Lengkap"',
  ],
  [
    "compatibility details",
    "src/lib/aisho-compat.ts",
    'if (locale === "id") return axisCopyId',
  ],
  [
    "compatibility hero",
    "src/components/aisho/AishoPage.tsx",
    'isIndonesian ? "Kecocokan kalian"',
  ],
  [
    "compatibility strengths",
    "src/components/aisho/AishoPage.tsx",
    'isIndonesian ? "Hal baik dari hubungan kalian"',
  ],
  [
    "compatibility result heading",
    "src/components/aisho/AishoPage.tsx",
    'isIndonesian ? "Kecocokan dalam empat situasi"',
  ],
  [
    "compatibility caution",
    "src/components/aisho/AishoPage.tsx",
    'isIndonesian ? "Hal yang perlu dijaga"',
  ],
  ["compatibility scenes", "src/lib/aisho-scene-copy.ts", "const LOVE_ID"],
  [
    "compatibility API",
    "src/app/api/aisho/scenes/route.ts",
    'localeParam === "id"',
  ],
  [
    "diagnosis share band",
    "src/components/diagnosis/DiagnosisPageContent.tsx",
    'locale !== "en"',
  ],
  [
    "result share controls",
    "src/components/diagnosis/DiagnosisShareBand.tsx",
    'isId ? "Bagikan di LINE"',
  ],
  [
    "result sharing",
    "src/components/result/MeStickyHeader.tsx",
    'const isId = locale === "id"',
  ],
  [
    "destiny confirmation",
    "src/components/uranai/UnmeiCheckoutConfirming.tsx",
    'locale === "id"',
  ],
  [
    "destiny checkout excludes JPY-only PayPay for IDR",
    "src/components/uranai/UnmeiEmbeddedCheckout.tsx",
    'const supportsPayPay = locale === "ja";',
  ],
  [
    "destiny birth regions",
    "src/components/uranai/UnmeiBirthChat.tsx",
    "INDONESIAN_BIRTH_REGIONS",
  ],
  [
    "destiny chart labels",
    "src/lib/unmei/chart-view.ts",
    'locale === "id" ? BODY_ID : BODY_JA',
  ],
  ["metadata isolation", "src/app/id/layout.tsx", "title: { absolute: TITLE"],
  [
    "not-found fallback",
    "src/components/LocalizedNotFound.tsx",
    'homeHref: "/id"',
  ],
];
for (const [label, file, marker] of criticalChecks) {
  if (!read(file).includes(marker))
    failures.push(`${label}: missing Indonesian branch in ${file}`);
}

for (const requiredFile of [
  "src/app/id/tarot/dev-preview/page.tsx",
  "src/app/id/unmei/dev-preview/page.tsx",
  "src/app/id/tako-report/[token]/pdf/route.ts",
  "src/app/id/report/[token]/pdf/route.ts",
  "supabase/migrations/20260918120000_add_indonesian_locale.sql",
]) {
  if (!fs.existsSync(path.join(ROOT, requiredFile)))
    failures.push(`missing parity file: ${requiredFile}`);
}

const catalog = read("docs/COMMERCE_CATALOG.md");
for (const marker of [
  "### インドネシア語版",
  "Edisi Lengkap",
  "Rp129.000",
  "Rp49.000",
]) {
  if (!catalog.includes(marker))
    failures.push(`commerce parity: catalog is missing ${marker}`);
}

if (failures.length) {
  console.error("Indonesian parity verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Indonesian parity verified: ${japaneseRoutes.size} routes, 50 scoring-identical questions, 32 result types, ${jaArticleSlugs.size} articles, 12 scoring-identical what-if scenarios, 38 birth regions, localized result/email/PDF/checkout flows.`,
);
