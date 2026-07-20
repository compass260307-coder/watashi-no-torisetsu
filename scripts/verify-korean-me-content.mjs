import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const problems = [];
const lengthOutliers = [];

function unwrap(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return node.text;
  throw new Error(`Unsupported property name: ${node.getText()}`);
}

function evaluateLiteral(rawNode) {
  const node = unwrap(rawNode);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(evaluateLiteral);
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`Unsupported object property: ${property.getText()}`);
      }
      result[propertyName(property.name)] = evaluateLiteral(property.initializer);
    }
    return result;
  }
  throw new Error(`Unsupported literal: ${node.getText().slice(0, 120)}`);
}

function readExport(file, exportName) {
  const absolute = path.join(ROOT, file);
  const source = ts.createSourceFile(
    absolute,
    fs.readFileSync(absolute, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer
      ) {
        return evaluateLiteral(declaration.initializer);
      }
    }
  }
  throw new Error(`${exportName} was not found in ${file}`);
}

function compareKeys(label, japanese, korean) {
  const jpKeys = Object.keys(japanese).toSorted();
  const koKeys = Object.keys(korean).toSorted();
  if (JSON.stringify(jpKeys) !== JSON.stringify(koKeys)) {
    problems.push(`${label}: key mismatch (${jpKeys.length} vs ${koKeys.length})`);
  }
}

function inspectPair(label, japanese, korean) {
  if (typeof japanese === "string") {
    if (typeof korean !== "string") {
      problems.push(`${label}: Korean value is not a string`);
      return;
    }
    if (japanese.trim() && !korean.trim()) problems.push(`${label}: empty Korean text`);
    if (/[ぁ-んァ-ヶ一-龯]/u.test(korean)) {
      problems.push(`${label}: Japanese script remains`);
    }
    if (/<unk>|\[\[\[|【イベント】/u.test(korean)) {
      problems.push(`${label}: model artifact remains`);
    }
    const jpParagraphs = japanese.split("\n\n");
    const koParagraphs = korean.split("\n\n");
    if (jpParagraphs.length !== koParagraphs.length) {
      problems.push(
        `${label}: paragraph mismatch (${jpParagraphs.length} vs ${koParagraphs.length})`,
      );
    }
    jpParagraphs.forEach((paragraph, index) => {
      const translated = koParagraphs[index] ?? "";
      const ratio = translated.length / Math.max(1, paragraph.length);
      if (paragraph.length >= 24 && (ratio < 0.48 || ratio > 2.2)) {
        lengthOutliers.push({
          label: `${label}#${index + 1}`,
          ratio,
          japanese: paragraph,
          korean: translated,
        });
      }
    });
    return;
  }
  if (Array.isArray(japanese)) {
    if (!Array.isArray(korean) || japanese.length !== korean.length) {
      problems.push(
        `${label}: array length mismatch (${japanese.length} vs ${korean?.length ?? "n/a"})`,
      );
      return;
    }
    japanese.forEach((value, index) => inspectPair(`${label}[${index}]`, value, korean[index]));
    return;
  }
  if (japanese && typeof japanese === "object") {
    if (!korean || typeof korean !== "object") {
      problems.push(`${label}: Korean object is missing`);
      return;
    }
    compareKeys(label, japanese, korean);
    for (const [key, value] of Object.entries(japanese)) {
      inspectPair(`${label}.${key}`, value, korean[key]);
    }
  }
}

const mappings = [
  [
    "self",
    readExport("src/lib/thirty-two-content/self-result-32.ts", "selfResultContent32"),
    readExport("src/i18n/ko/me-content-32.ts", "KO_SELF_RESULT_CONTENT_32"),
  ],
  [
    "love",
    readExport("src/lib/love-by-type-32.ts", "LOVE_BY_TYPE_32"),
    readExport("src/i18n/ko/me-content-32.ts", "KO_LOVE_BY_TYPE_32"),
  ],
  [
    "career",
    readExport("src/lib/career-by-type-32.ts", "CAREER_BY_TYPE_32"),
    readExport("src/i18n/ko/me-content-32.ts", "KO_CAREER_BY_TYPE_32"),
  ],
  [
    "perceived",
    readExport(
      "src/lib/thirty-two-content/perceived-by-type-32.ts",
      "perceivedByType32",
    ),
    readExport("src/i18n/ko/me-content-32.ts", "KO_PERCEIVED_BY_TYPE_32"),
  ],
];

for (const [label, japanese, korean] of mappings) {
  compareKeys(label, japanese, korean);
  inspectPair(label, japanese, korean);
}

const shared = [
  ["loveFailProse", "src/lib/deep-dive-resolve.ts", "LOVE_FAIL_PROSE", "KO_LOVE_FAIL_PROSE"],
  ["likableProse", "src/lib/part-two-resolve.ts", "LIKABLE_PROSE", "KO_LIKABLE_PROSE"],
];
for (const [label, jpFile, jpExport, koExport] of shared) {
  inspectPair(
    label,
    readExport(jpFile, jpExport),
    readExport("src/i18n/ko/me-content-32.ts", koExport),
  );
}

for (const name of ["FRIEND", "LOVER", "FAMILY", "BOSS", "JUNIOR", "FIRST"]) {
  inspectPair(
    `relation.${name}`,
    readExport("src/lib/part-two-resolve.ts", `RELATION_${name}`),
    readExport("src/i18n/ko/me-content-32.ts", "KO_RELATION_RULES")[name],
  );
}
for (const name of ["FRIEND", "LOVER", "CAREER", "FAMILY"]) {
  inspectPair(
    `scene.${name}`,
    readExport("src/lib/part-two-resolve.ts", `SCENE_${name}`),
    readExport("src/i18n/ko/me-content-32.ts", "KO_SCENE_RULES")[name],
  );
}

lengthOutliers.sort((left, right) => left.ratio - right.ratio);
console.log(
  JSON.stringify(
    {
      problems,
      lengthOutlierCount: lengthOutliers.length,
      lengthOutliers: lengthOutliers.slice(0, 120),
    },
    null,
    2,
  ),
);
if (problems.length > 0) process.exitCode = 1;
