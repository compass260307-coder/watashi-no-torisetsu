import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function evaluateStaticNode(node, env) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isIdentifier(node)) {
    if (Object.hasOwn(env, node.text)) return env[node.text];
    throw new Error(`Unknown static identifier: ${node.text}`);
  }
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node))
    return node.elements.map((entry) => evaluateStaticNode(entry, env));
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property))
        throw new Error(`Unsupported static property: ${property.getText()}`);
      const key = ts.isComputedPropertyName(property.name)
        ? evaluateStaticNode(property.name.expression, env)
        : (property.name.text ?? property.name.getText());
      result[key] = evaluateStaticNode(property.initializer, env);
    }
    return result;
  }
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  )
    return evaluateStaticNode(node.expression, env);
  if (ts.isTemplateExpression(node)) {
    return node.templateSpans.reduce(
      (text, span) =>
        `${text}${evaluateStaticNode(span.expression, env)}${span.literal.text}`,
      node.head.text,
    );
  }
  throw new Error(`Unsupported static node: ${ts.SyntaxKind[node.kind]}`);
}

function extractStaticVariables(relativePath) {
  const source = read(relativePath);
  const file = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const env = {};
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      try {
        env[declaration.name.text] = evaluateStaticNode(
          declaration.initializer,
          env,
        );
      } catch {
        // Runtime-derived declarations are irrelevant to this static parity audit.
      }
    }
  }
  return env;
}

function leafEntries(value, currentPath = [], entries = []) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    entries.push({ path: currentPath.join("."), value });
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      leafEntries(entry, [...currentPath, String(index)], entries),
    );
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) =>
      leafEntries(entry, [...currentPath, key], entries),
    );
  }
  return entries;
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

function articleStructureSignatures(relativePath, variableName) {
  const source = read(relativePath);
  const file = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const signatures = new Map();

  const objectProperty = (object, name) =>
    object.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) && property.name.getText(file) === name,
    )?.initializer;
  const arrayLength = (node) =>
    node && ts.isArrayLiteralExpression(node) ? node.elements.length : 0;
  const addObject = (object, factor = false) => {
    const slugNode = objectProperty(object, "slug");
    if (!slugNode || !ts.isStringLiteral(slugNode)) return;
    if (factor) {
      signatures.set(slugNode.text, "2:4:1/3,1/3,2/0,1/0");
      return;
    }
    const lead = objectProperty(object, "lead");
    const sections = objectProperty(object, "sections");
    if (!sections || !ts.isArrayLiteralExpression(sections)) return;
    const sectionSignature = sections.elements.map((section) => {
      if (!ts.isObjectLiteralExpression(section)) return "0/0";
      return `${arrayLength(objectProperty(section, "paragraphs"))}/${arrayLength(objectProperty(section, "list"))}`;
    });
    signatures.set(
      slugNode.text,
      `${arrayLength(lead)}:${sections.elements.length}:${sectionSignature.join(",")}`,
    );
  };

  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== variableName ||
        !declaration.initializer ||
        !ts.isArrayLiteralExpression(declaration.initializer)
      ) continue;
      for (const element of declaration.initializer.elements) {
        if (ts.isObjectLiteralExpression(element)) addObject(element);
        if (
          ts.isCallExpression(element) &&
          ts.isIdentifier(element.expression) &&
          element.expression.text === "factorArticle" &&
          element.arguments[0] &&
          ts.isObjectLiteralExpression(element.arguments[0])
        ) addObject(element.arguments[0], true);
      }
    }
  }
  return signatures;
}

const jaArticleStructures = articleStructureSignatures(
  "src/lib/articles.ts",
  "ARTICLES",
);
const idArticleStructures = articleStructureSignatures(
  "src/lib/articles-id.ts",
  "ID_ARTICLES",
);
for (const [slug, signature] of jaArticleStructures) {
  if (idArticleStructures.get(slug) !== signature) {
    failures.push(
      `article structure parity: ${slug} Japanese=${signature}, Indonesian=${idArticleStructures.get(slug) ?? "missing"}`,
    );
  }
}

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

const jaSelfData = extractStaticVariables(
  "src/lib/thirty-two-content/self-result-32.ts",
).selfResultContent32;
const jaLoveData = extractStaticVariables(
  "src/lib/love-by-type-32.ts",
).LOVE_BY_TYPE_32;
const jaCareerData = extractStaticVariables(
  "src/lib/career-by-type-32.ts",
).CAREER_BY_TYPE_32;
const jaPerceivedData = extractStaticVariables(
  "src/lib/thirty-two-content/perceived-by-type-32.ts",
).perceivedByType32;
const idMeContent = extractStaticVariables("src/i18n/id/me-content-32.ts");

function assertTranslatedShape(label, japanese, indonesian) {
  if (!japanese || !indonesian) {
    failures.push(`${label}: static source or translation could not be read`);
    return;
  }
  equalSets(
    `${label} keys`,
    new Set(Object.keys(japanese)),
    new Set(Object.keys(indonesian)),
  );
  const japaneseLeaves = leafEntries(japanese);
  const indonesianLeaves = leafEntries(indonesian);
  const translatedByPath = new Map(
    indonesianLeaves.map((entry) => [entry.path, entry.value]),
  );
  equalSets(
    `${label} item structure`,
    new Set(japaneseLeaves.map((entry) => entry.path)),
    new Set(indonesianLeaves.map((entry) => entry.path)),
  );
  for (const source of japaneseLeaves) {
    const translated = translatedByPath.get(source.path);
    if (typeof source.value !== "string" || typeof translated !== "string")
      continue;
    if (!translated.trim()) failures.push(`${label}: empty ${source.path}`);
    if (/[぀-ヿ㐀-鿿]/u.test(translated))
      failures.push(`${label}: Japanese remains in ${source.path}`);
    if (
      source.value.split("\n\n").length !==
      translated.split("\n\n").length
    )
      failures.push(`${label}: paragraph mismatch at ${source.path}`);
    if (
      (source.value.match(/\{B\}/g) ?? []).length !==
      (translated.match(/\{B\}/g) ?? []).length
    )
      failures.push(`${label}: placeholder mismatch at ${source.path}`);
    if (
      (source.value.match(/\{name\}/g) ?? []).length !==
      (translated.match(/\{name\}/g) ?? []).length
    )
      failures.push(`${label}: name placeholder mismatch at ${source.path}`);
  }
}

assertTranslatedShape(
  "32-type self copy",
  jaSelfData,
  idMeContent.ID_SELF_RESULT_CONTENT_32,
);
assertTranslatedShape(
  "32-type love copy",
  jaLoveData,
  idMeContent.ID_LOVE_BY_TYPE_32,
);
assertTranslatedShape(
  "32-type career copy",
  jaCareerData,
  idMeContent.ID_CAREER_BY_TYPE_32,
);
assertTranslatedShape(
  "32-type perceived copy",
  jaPerceivedData,
  idMeContent.ID_PERCEIVED_BY_TYPE_32,
);

const jaPartRules = extractStaticVariables("src/lib/part-two-resolve.ts");
const jaDeepRules = extractStaticVariables("src/lib/deep-dive-resolve.ts");
const jaRuleCopy = {
  WEAPON_SUBJECT_WA: jaPartRules.WEAPON_SUBJECT_WA,
  WEAPON_SUBJECT_NIWA: jaPartRules.WEAPON_SUBJECT_NIWA,
  WEAPON_TAIL: jaPartRules.WEAPON_TAIL,
  DISLIKE_TAIL: jaPartRules.DISLIKE_TAIL,
  LIKABLE_PROSE: jaPartRules.LIKABLE_PROSE,
  LIKABLE_CLOSING: jaPartRules.LIKABLE_CLOSING,
  RELATION_FRIEND: jaPartRules.RELATION_FRIEND,
  RELATION_LOVER: jaPartRules.RELATION_LOVER,
  RELATION_FAMILY: jaPartRules.RELATION_FAMILY,
  RELATION_BOSS: jaPartRules.RELATION_BOSS,
  SCENE_FRIEND: jaPartRules.SCENE_FRIEND,
  SCENE_LOVER: jaPartRules.SCENE_LOVER,
  SCENE_CAREER: jaPartRules.SCENE_CAREER,
  SCENE_FAMILY: jaPartRules.SCENE_FAMILY,
  LOVE_HEADINGS: jaDeepRules.LOVE_HEADINGS,
  LOVE_ENDURE_HEADING: jaDeepRules.LOVE_ENDURE_HEADING,
  LOVE_ENDURE_PROSE: jaDeepRules.LOVE_ENDURE_PROSE,
  LOVE_ENDURE_CLOSING: jaDeepRules.LOVE_ENDURE_CLOSING,
  CAREER_HEADINGS: jaDeepRules.CAREER_HEADINGS,
  CAREER_RELATIONS_HEADING: jaDeepRules.CAREER_RELATIONS_HEADING,
  CAREER_RELATIONS_PROSE: jaDeepRules.CAREER_RELATIONS_PROSE,
  CAREER_RELATIONS_CLOSING: jaDeepRules.CAREER_RELATIONS_CLOSING,
  LOVE_SPLITS: jaDeepRules.LOVE_SPLITS,
};
assertTranslatedShape("shared result copy", jaRuleCopy, idMeContent.ID_ME_RULES);
if (
  JSON.stringify(jaDeepRules.LOVE_SPLITS) !==
  JSON.stringify(idMeContent.ID_ME_RULES?.LOVE_SPLITS)
)
  failures.push("love split parity: Indonesian paragraph gates differ from Japanese");

const jaFriendLove = extractStaticVariables("src/lib/friend-love-content.ts");
const idFriendResult = extractStaticVariables(
  "src/i18n/id/friend-result-content.ts",
);
for (const [label, jaKey, idKey] of [
  ["friend love headline copy", "MOTE_BY_AXIS", "ID_MOTE_BY_AXIS"],
  ["friend love checklist copy", "MOTE_CHECK_BY_AXIS", "ID_MOTE_CHECK_BY_AXIS"],
  ["friend love extra checklist copy", "MOTE_CHECK_EXTRA_BY_AXIS", "ID_MOTE_CHECK_EXTRA_BY_AXIS"],
  ["friend love hint copy", "MOTE_HINT_CHECKS_BY_AXIS", "ID_MOTE_HINT_CHECKS_BY_AXIS"],
  ["friend love scene copy", "LOVE_SCENE_BY_AXIS", "ID_LOVE_SCENE_BY_AXIS"],
]) {
  assertTranslatedShape(label, jaFriendLove[jaKey], idFriendResult[idKey]);
}

const jaTakoDeepDive = extractStaticVariables("src/lib/tako-deepdive.ts");
const JA_AXIS_TO_KEY = {
  開放性: "O",
  誠実性: "C",
  外向性: "E",
  協調性: "A",
  神経症傾向: "N",
};
const normalizeJaAxisKeys = (table) =>
  Object.fromEntries(
    Object.entries(table ?? {}).map(([key, value]) => [JA_AXIS_TO_KEY[key], value]),
  );
assertTranslatedShape(
  "friend compatibility axis copy",
  normalizeJaAxisKeys(jaTakoDeepDive.AXIS_INSIGHT_COPY),
  idFriendResult.ID_AXIS_INSIGHT_COPY,
);
assertTranslatedShape(
  "friend compatibility tips",
  normalizeJaAxisKeys(jaTakoDeepDive.KOTSU_COPY),
  idFriendResult.ID_KOTSU_COPY,
);
assertTranslatedShape(
  "friend compatibility warnings",
  normalizeJaAxisKeys(jaTakoDeepDive.WANA_COPY),
  idFriendResult.ID_WANA_COPY,
);

const friendLoveSource = read("src/lib/friend-love-content.ts");
const takoDeepDiveSource = read("src/lib/tako-deepdive.ts");
const takoResultSource = read("src/components/result/TakoResultPage.tsx");
const reportSheetSource = read("src/lib/tako-report-sheets.ts");
const perceptionViewSource = read("src/lib/perception-view.ts");
const minnaTypeProseSource = read("src/components/result/MinnaTypeProse.tsx");
for (const [label, source, marker] of [
  ["friend headline resolver", friendLoveSource, "locale === \"id\" ? ID_MOTE_BY_AXIS"],
  ["friend checklist resolver", friendLoveSource, "? ID_MOTE_CHECK_BY_AXIS"],
  ["friend hint resolver", friendLoveSource, "? ID_MOTE_HINT_CHECKS_BY_AXIS"],
  ["friend scene resolver", friendLoveSource, "? ID_LOVE_SCENE_BY_AXIS"],
  ["compatibility axis resolver", takoDeepDiveSource, "? ID_AXIS_INSIGHT_COPY[g.key]"],
  ["compatibility tip resolver", takoDeepDiveSource, "? ID_KOTSU_COPY[ax.key].off"],
  ["compatibility warning resolver", takoDeepDiveSource, "? ID_WANA_COPY[ax.key].off"],
  ["Tako love body", takoResultSource, "? ID_LOVE_BY_TYPE_32[type32]"],
  ["Tako perceived body", takoResultSource, "? ID_PERCEIVED_BY_TYPE_32[type32]"],
  ["PDF love checklist", reportSheetSource, "resolveFriendLoveChecklist(f.perceivedScores, locale)"],
  ["PDF love hints", reportSheetSource, "resolveMoteHints(f.perceivedScores, locale)"],
  ["perception result body", perceptionViewSource, "? ID_PERCEIVED_BY_TYPE_32[perceived32Id]"],
  ["Tako manual body", minnaTypeProseSource, "? (ID_SELF_RESULT_CONTENT_32[type32] ?? []).slice(0, 2)"],
]) {
  if (!source.includes(marker)) failures.push(`${label}: missing ${marker}`);
}
if (reportSheetSource.includes("buildIdLoveItems"))
  failures.push("PDF love parity: generic Indonesian fallback still exists");
if (minnaTypeProseSource.includes("Hal-hal yang terasa biasa bagi Anda"))
  failures.push("Tako manual parity: generic Indonesian fallback still exists");
if (/if \(locale === "id"\) \{[\s\S]{0,1600}slice\(0, 5\)/.test(takoDeepDiveSource))
  failures.push("compatibility parity: Indonesian result still limits tips to five items");

const idMe = read("src/i18n/id/me.ts");
const jaMoshimoScenes = extractStaticVariables(
  "src/lib/moshimo-resolve.ts",
).SCENES;
const normalizedJaMoshimo = jaMoshimoScenes?.map((scene) => ({
  title: scene.title,
  chipLabel:
    scene.short ?? scene.title.replace(/(で)?のあなた$/, ""),
  color: scene.color,
  gated: scene.gated,
  main: {
    dim: scene.main.dim,
    high: scene.main.prose.H,
    low: scene.main.prose.L,
  },
  spice: {
    dim: scene.spice.dim,
    high: scene.spice.prose.H,
    low: scene.spice.prose.L,
  },
}));
const idMoshimoScenes = idMeContent.ID_MOSHIMO_SCENES;
if (idMoshimoScenes?.length !== 12) {
  failures.push("what-if parity: Indonesian must define 12 scenarios");
}
assertTranslatedShape(
  "what-if scene copy",
  normalizedJaMoshimo,
  idMoshimoScenes,
);
const sceneSignatures = (scenes = []) =>
  scenes.map(
    (scene) =>
      `${scene.gated}:${scene.color}:${scene.main.dim}:${scene.spice.dim}`,
  );
const jaSceneSignatures = sceneSignatures(normalizedJaMoshimo);
const idSceneSignatures = sceneSignatures(idMoshimoScenes);
if (
  jaSceneSignatures.length !== 12 ||
  idSceneSignatures.length !== 12 ||
  jaSceneSignatures.some(
    (signature, index) => signature !== idSceneSignatures[index],
  )
) {
  failures.push(
    "what-if scoring parity: gate, color, main dimension, or spice dimension differs from Japanese",
  );
}
for (const marker of [
  "likable: idLikable(scores)",
  "ID_PERCEIVED_BY_TYPE_32[typeId]",
  "WEAPON_SUBJECTS",
  "ID_ME_RULES.WEAPON_TAIL",
  "idPerceivedItems(perceived.surprises, ID_ME_RULES.DISLIKE_TAIL)",
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
    "friend gap prose",
    "src/components/result/FriendGapSection.tsx",
    "ID_SELF_RESULT_CONTENT_32",
  ],
  [
    "relationship-specific copy",
    "src/lib/perception-view.ts",
    "idRelationFact(maxGap.key, maxGapDir)",
  ],
  [
    "relationship axis detail",
    "src/components/result/PerceptionResultBody.tsx",
    "idGapDetail(g.key, dir)",
  ],
  [
    "Johari window scoring parity",
    "src/components/result/JohariWindow.tsx",
    'if (locale === "id")',
  ],
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
  [
    "destiny landing parity",
    "src/app/id/unmei/page.tsx",
    "Yang dapat Anda temukan dalam Peta Takdir",
  ],
  [
    "self-report shared layout",
    "src/app/id/report/[token]/print/page.tsx",
    'locale: "id"',
  ],
  [
    "self-report detailed content",
    "src/app/report/[token]/print/page.tsx",
    "buildIdDetailedReport(t32, scores)",
  ],
  [
    "self-report complete PDF output",
    "src/app/report/[token]/pdf/route.ts",
    'pageRanges: isKo || isEn ? "1-16" : undefined',
  ],
  ["home structured data", "src/app/id/page.tsx", '"@type": "WebApplication"'],
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

if (
  /if \(locale === "en" \|\| locale === "id"\)/.test(
    read("src/components/result/FriendGapSection.tsx"),
  )
) {
  failures.push("friend gap parity: Indonesian still uses the abbreviated English branch");
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
