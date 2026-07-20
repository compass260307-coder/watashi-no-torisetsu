import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, "src/i18n/ko/me-content-32.ts");
const TRANSLATION_CACHE = "/tmp/watashi-ko-papago-cache.json";
const TRANSLATE_URL = "https://papago.naver.com/api/text/translation";

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
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map(evaluateLiteral);
  }
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
  const sourceText = fs.readFileSync(absolute, "utf8");
  const source = ts.createSourceFile(
    absolute,
    sourceText,
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const jpSelf = readExport(
  "src/lib/thirty-two-content/self-result-32.ts",
  "selfResultContent32",
);
const jpLove = readExport("src/lib/love-by-type-32.ts", "LOVE_BY_TYPE_32");
const jpCareer = readExport(
  "src/lib/career-by-type-32.ts",
  "CAREER_BY_TYPE_32",
);
const jpPerceived = readExport(
  "src/lib/thirty-two-content/perceived-by-type-32.ts",
  "perceivedByType32",
);
const jpLoveFailProse = readExport(
  "src/lib/deep-dive-resolve.ts",
  "LOVE_FAIL_PROSE",
);
const jpLoveFailClosing = readExport(
  "src/lib/deep-dive-resolve.ts",
  "LOVE_FAIL_CLOSING",
);
const jpLikableProse = readExport(
  "src/lib/part-two-resolve.ts",
  "LIKABLE_PROSE",
);
const jpLikableClosing = readExport(
  "src/lib/part-two-resolve.ts",
  "LIKABLE_CLOSING",
);
const jpRelationRules = Object.fromEntries(
  ["FRIEND", "LOVER", "FAMILY", "BOSS", "JUNIOR", "FIRST"].map(
    (name) => [
      name,
      readExport("src/lib/part-two-resolve.ts", `RELATION_${name}`),
    ],
  ),
);
const jpSceneRules = Object.fromEntries(
  ["FRIEND", "LOVER", "CAREER", "FAMILY"].map((name) => [
    name,
    readExport("src/lib/part-two-resolve.ts", `SCENE_${name}`),
  ]),
);
const koTypeCopy = readExport("src/i18n/ko/result.ts", "KO_RESULT_TYPES");

// 手作業で校正済みの夢想家は、再生成しても上書きしない。
const manualSelf = readExport(
  "src/i18n/ko/me-content-32.ts",
  "KO_SELF_RESULT_CONTENT_32",
);
const manualLove = readExport(
  "src/i18n/ko/me-content-32.ts",
  "KO_LOVE_BY_TYPE_32",
);
const manualCareer = readExport(
  "src/i18n/ko/me-content-32.ts",
  "KO_CAREER_BY_TYPE_32",
);
const manualPerceived = readExport(
  "src/i18n/ko/me-content-32.ts",
  "KO_PERCEIVED_BY_TYPE_32",
);

const koSelf = clone(jpSelf);
const koLove = clone(jpLove);
const koCareer = clone(jpCareer);
const koPerceived = clone(jpPerceived);
const koLoveFailProse = clone(jpLoveFailProse);
const koLoveFailClosing = { value: jpLoveFailClosing };
const koLikableProse = clone(jpLikableProse);
const koLikableClosing = { value: jpLikableClosing };
const koRelationRules = clone(jpRelationRules);
const koSceneRules = clone(jpSceneRules);
const translationTasks = [];

function queueParagraphs(container, key, prepare = (value) => value) {
  const paragraphs = String(container[key]).split("\n\n");
  const translated = new Array(paragraphs.length);
  paragraphs.forEach((paragraph, index) => {
    translationTasks.push({
      text: prepare(paragraph),
      apply(value) {
        translated[index] = value;
        if (translated.every((part) => typeof part === "string")) {
          container[key] = translated.join("\n\n");
        }
      },
    });
  });
}

function queueAllStrings(value) {
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      queueParagraphs(value, key);
    } else if (child && typeof child === "object") {
      queueAllStrings(child);
    }
  }
}

for (const [typeId, sections] of Object.entries(koSelf)) {
  sections.forEach((section, sectionIndex) => {
    section.title = ["사용설명서", "주의해서 다룰 점", "잘 맞는 사람"][
      sectionIndex
    ] ?? section.title;
    if (section.heading) {
      const separator = section.heading.indexOf("——");
      if (separator >= 0) {
        const officialName = koTypeCopy[typeId]?.name ?? "";
        const tailHolder = { value: section.heading.slice(separator + 2).trim() };
        queueParagraphs(tailHolder, "value");
        Object.defineProperty(section, "__headingTail", {
          enumerable: false,
          value: tailHolder,
        });
        section.heading = officialName;
      } else {
        queueParagraphs(section, "heading");
      }
    }
    queueParagraphs(section, "body");
  });
}

for (const section of Object.values(koLove)) {
  section.title = "연애 성향";
  queueParagraphs(section, "body");
}

for (const section of Object.values(koCareer)) {
  section.title = "커리어 성향";
  queueParagraphs(section, "body");
}

const WEAPON_SUBJECT_WA = [
  "친구는, ",
  "주변 사람들은, ",
  "사실 친구는, ",
  "모두가, ",
  "가까운 친구일수록, ",
  "어느새 주변 사람들은, ",
];
const WEAPON_SUBJECT_NIWA = [
  "친구에게는, ",
  "주변의 눈에는, ",
  "사실 친구에게는, ",
  "모두의 눈에는, ",
  "가까운 친구의 눈에는, ",
  "어느새 주변 사람들에게는, ",
];
const WEAPON_TAIL = [
  "자신에게는 당연해도 주변에서 보면 분명한 재능이에요.",
  "이렇게 할 수 있는 사람은 사실 그리 많지 않아요.",
  "스스로 생각하는 것보다 훨씬 더 큰 무기예요.",
  "당신이 있어 도움받는 사람이 분명히 있어요.",
  "그 사실을 아직 모르는 사람은 아마 당신뿐일 거예요.",
  "이 안도감은 쉽게 흉내 낼 수 없어요.",
];
const DISLIKE_TAIL = [
  "악의가 없다는 건 모두가 알아요. 다만 먼저 한마디만 해도 인상은 완전히 달라져요.",
  "이건 단점이라기보다 장점이 지나치게 강하게 나온 순간이에요. 알아차리기만 해도 다시 무기가 돼요.",
  "직접 말하지는 않지만, 친하기 때문에 더 신경 쓰이는 부분이에요.",
  "숨기고 있다고 생각해도 가까운 사람에게는 제대로 전해지고 있어요.",
  "싫어할 정도의 일은 아니지만, 계속 쌓이면 작은 거리가 될 수 있는 종류의 모습이에요.",
  "알아차린 날부터 바꿀 수 있는 습관이고, 오히려 성장할 여지라고 생각하고 있어요.",
];

function prepareWeaponBody(text) {
  return text
    .replace(/^\{B\}さんには、/u, "")
    .replace(/^\{B\}さんは、/u, "")
    .replaceAll("{B}さん", "友達");
}

function prepareGeneralBody(text) {
  return text.replaceAll("{B}さん", "友達");
}

for (const content of Object.values(koPerceived)) {
  content.strengths.forEach((item) => {
    const subjectCase = item.body.startsWith("{B}さんには、") ? "NIWA" : "WA";
    queueParagraphs(item, "title");
    queueParagraphs(item, "body", prepareWeaponBody);
    Object.defineProperty(item, "__weaponSubjectCase", {
      enumerable: false,
      value: subjectCase,
    });
  });
  content.surprises.forEach((item, index) => {
    queueParagraphs(item, "title");
    queueParagraphs(item, "body", prepareGeneralBody);
    Object.defineProperty(item, "__dislikeIndex", {
      enumerable: false,
      value: index,
    });
  });
}

queueAllStrings(koLoveFailProse);
queueParagraphs(koLoveFailClosing, "value");
queueAllStrings(koLikableProse);
queueParagraphs(koLikableClosing, "value");
queueAllStrings(koRelationRules);
queueAllStrings(koSceneRules);

function normalizeJapanese(text) {
  return text
    .replaceAll("アナタ", "あなた")
    .replaceAll("まわり", "周囲")
    .replaceAll("ノリ", "雰囲気")
    .replaceAll("あいつ", "その人")
    .replaceAll("やつ", "人")
    .replaceAll("株が上がる", "評価が上がる")
    .replaceAll("ツッコミ", "冗談めいた指摘");
}

const tasksBySource = new Map();
for (const task of translationTasks) {
  task.source = normalizeJapanese(task.text);
  const matchingTasks = tasksBySource.get(task.source) ?? [];
  matchingTasks.push(task);
  tasksBySource.set(task.source, matchingTasks);
}

function batchesOf(sources, maxChars = 4400) {
  const batches = [];
  let batch = [];
  let chars = 0;
  for (const source of sources) {
    const next = source.length + 24;
    if (batch.length > 0 && chars + next > maxChars) {
      batches.push(batch);
      batch = [];
      chars = 0;
    }
    batch.push(source);
    chars += next;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

const translationCache = fs.existsSync(TRANSLATION_CACHE)
  ? JSON.parse(fs.readFileSync(TRANSLATION_CACHE, "utf8"))
  : {};
const pendingSources = [...tasksBySource.keys()].filter(
  (source) => typeof translationCache[source] !== "string",
);
const translationBatches = batchesOf(pendingSources);
console.log(
  `Translating ${pendingSources.length}/${tasksBySource.size} unique paragraphs ` +
    `(${translationTasks.length} uses) in ${translationBatches.length} Papago batches...`,
);

async function translateBatch(batch, batchIndex) {
  const joined = batch
    .map((source, index) =>
      index === batch.length - 1
        ? source
        : `${source}\n[[[CUT${String(index).padStart(4, "0")}]]]\n`,
    )
    .join("");
  const body = new URLSearchParams({
    source: "ja",
    target: "ko",
    text: joined,
    dict: "false",
    useGlossary: "false",
    honorific: "true",
  });
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(TRANSLATE_URL, {
        method: "POST",
        headers: {
          "Accept-Language": "ko",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const parts = String(payload.translatedText ?? "")
        .split(/\s*\[\[\[CUT\d{4}\]\]\]\s*/u)
        .map((part) => part.trim());
      if (parts.length !== batch.length) {
        throw new Error(
          `delimiter mismatch: expected ${batch.length}, received ${parts.length}`,
        );
      }
      parts.forEach((translated, index) => {
        translationCache[batch[index]] = translated;
      });
      fs.writeFileSync(TRANSLATION_CACHE, JSON.stringify(translationCache));
      console.log(`translated batch ${batchIndex + 1}/${translationBatches.length}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * (String(error).includes("429") ? 5000 : 1000)),
        );
      }
    }
  }
  throw new Error(`Papago batch ${batchIndex + 1} failed: ${lastError}`);
}

for (const [index, batch] of translationBatches.entries()) {
  await translateBatch(batch, index);
  await new Promise((resolve) => setTimeout(resolve, 450));
}

for (const [source, tasks] of tasksBySource) {
  const translated = translationCache[source];
  if (typeof translated !== "string") {
    throw new Error(`Missing translation for: ${source.slice(0, 80)}`);
  }
  for (const task of tasks) {
    task.apply(translated);
  }
}

for (const sections of Object.values(koSelf)) {
  for (const section of sections) {
    if (section.__headingTail) {
      section.heading = `${section.heading} —— ${section.__headingTail.value}`;
    }
  }
}

for (const content of Object.values(koPerceived)) {
  content.strengths.forEach((item, index) => {
    const subject = item.__weaponSubjectCase === "NIWA"
      ? WEAPON_SUBJECT_NIWA[index]
      : WEAPON_SUBJECT_WA[index];
    item.body = `${subject}${item.body} ${WEAPON_TAIL[index]}`;
  });
  content.surprises.forEach((item, index) => {
    item.body = `${item.body} ${DISLIKE_TAIL[index]}`;
  });
}

const KOREAN_CORRECTIONS = [
  ["싫어하고 싶지 않아서", "미움받고 싶지 않아서"],
  ["귀가 아파도 괜찮습니다", "마음이 뜨끔해도 괜찮습니다"],
  ["그리고 겉과 속이 다르다는 점.", "그리고 겉과 속이 다르지 않은 솔직함."],
  ["이 조합은 상당히 이득인 성격입니다", "이 조합은 꽤 사랑받기 좋은 성격입니다"],
  ["사양하지 않아서 처음에는", "거리낌이 없어서 처음에는"],
  ["주가가 한꺼번에 오릅니다", "평가가 단숨에 올라갑니다"],
  ["가끔 대물감을 내는 존재입니다", "가끔 큰 인물 같은 분위기를 풍기는 존재입니다"],
  ["‘걱정하지 마’라고 생각하는 만큼", "‘걱정하지 않아도 된다’고 여겨지는 만큼"],
  ["처음 만난 사람도 경계하기 어렵습니다", "처음 만난 사람도 경계심을 갖지 않게 됩니다"],
  ["본인은 잊지 않습니다", "상대는 잊지 못할 수 있습니다"],
  ["조금씩 늘려가겠습니다", "조금씩 늘려 가세요"],
  ["말하는 연습을 합니다", "말하는 연습을 해 보세요"],
  ["정기적인 '좋아함'은 유지 관리.", "정기적으로 건네는 '좋아해'는 관계를 위한 유지 관리예요."],
  ["가끔의 '좋아함'이라는 한마디", "가끔 건네는 '좋아해'라는 한마디"],
  ["분위기가 좋고, 선배답지 않은 사람", "분위기를 잘 맞추고, 선배 티를 내지 않는 사람"],
  ["기준을 먼저 정해두겠습니다", "기준을 먼저 정해 두세요"],
  ["정론으로 가족을 채워도", "옳은 말로 가족을 몰아붙여도"],
  ["집에서는 계속 애교를 부리기 쉽습니다", "집에서는 계속 응석을 부리기 쉽습니다"],
  ["날을 가끔 만들어 보겠습니다", "날을 가끔 만들어 보세요"],
];

function polishKorean(value) {
  if (typeof value === "string") {
    return KOREAN_CORRECTIONS.reduce(
      (text, [from, to]) => text.replaceAll(from, to),
      value,
    );
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      value[index] = polishKorean(child);
    });
    return value;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      value[key] = polishKorean(child);
    }
  }
  return value;
}

[
  koSelf,
  koLove,
  koCareer,
  koPerceived,
  koLoveFailProse,
  koLoveFailClosing,
  koLikableProse,
  koLikableClosing,
  koRelationRules,
  koSceneRules,
].forEach(polishKorean);

const manualId = "earnest-elephant__N";
if (manualSelf[manualId]) koSelf[manualId] = manualSelf[manualId];
if (manualLove[manualId]) koLove[manualId] = manualLove[manualId];
if (manualCareer[manualId]) koCareer[manualId] = manualCareer[manualId];
if (manualPerceived[manualId]) koPerceived[manualId] = manualPerceived[manualId];

function stringify(value) {
  return JSON.stringify(value, null, 2);
}

const generated = `import type { DeepDiveSection } from "@/lib/report-data";
import type { SelfSection } from "@/lib/self-result-content";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { PerceivedTypeContent } from "@/lib/mutual-result-content";

/**
 * 일본어판 32타입 원고를 문단 단위로 번역한 한국어 콘텐츠.
 * scripts/generate-korean-me-content.mjs 로 생성하며, 키·문단·항목 수는 일본어판과 일치한다.
 */
export const KO_SELF_RESULT_CONTENT_32: Partial<
  Record<ThirtyTwoTypeId, SelfSection[]>
> = ${stringify(koSelf)};

export const KO_LOVE_BY_TYPE_32: Partial<
  Record<ThirtyTwoTypeId, DeepDiveSection>
> = ${stringify(koLove)};

export const KO_CAREER_BY_TYPE_32: Partial<
  Record<ThirtyTwoTypeId, DeepDiveSection>
> = ${stringify(koCareer)};

export const KO_PERCEIVED_BY_TYPE_32: Partial<
  Record<ThirtyTwoTypeId, PerceivedTypeContent>
> = ${stringify(koPerceived)};

export const KO_LOVE_FAIL_PROSE = ${stringify(koLoveFailProse)} as const;
export const KO_LOVE_FAIL_CLOSING = ${stringify(koLoveFailClosing.value)};
export const KO_LIKABLE_PROSE = ${stringify(koLikableProse)} as const;
export const KO_LIKABLE_CLOSING = ${stringify(koLikableClosing.value)};
export const KO_RELATION_RULES = ${stringify(koRelationRules)} as const;
export const KO_SCENE_RULES = ${stringify(koSceneRules)} as const;
`;

fs.writeFileSync(OUT_FILE, generated);
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
