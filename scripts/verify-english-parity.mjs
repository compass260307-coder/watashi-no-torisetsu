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

function equalSets(label, japanese, english) {
  const japaneseOnly = [...japanese].filter((item) => !english.has(item)).sort();
  const englishOnly = [...english].filter((item) => !japanese.has(item)).sort();
  if (japaneseOnly.length || englishOnly.length) {
    failures.push(
      `${label}: Japanese-only [${japaneseOnly.join(", ") || "none"}], English-only [${englishOnly.join(", ") || "none"}]`,
    );
  }
}

function requireText(relativePath, expected, label) {
  if (!read(relativePath).includes(expected)) {
    failures.push(`${label}: ${relativePath} is missing ${JSON.stringify(expected)}`);
  }
}

function forbidText(relativePath, forbidden, label) {
  if (read(relativePath).includes(forbidden)) {
    failures.push(`${label}: ${relativePath} still contains ${JSON.stringify(forbidden)}`);
  }
}

const excludedRoutePrefixes = [
  "/result-upgrade",
  "/tarot/dev-preview",
  "/unmei/dev-preview",
  "/unmei/reading-preview",
];
const isComparableRoute = (route) =>
  !excludedRoutePrefixes.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`),
  );

const japaneseRoutes = new Set(
  walkPages("src/app").filter(
    (route) =>
      isComparableRoute(route) &&
      !["/api", "/dev", "/en", "/ko", "/id", "/line", "/liff"].some(
        (prefix) => route === prefix || route.startsWith(`${prefix}/`),
      ),
  ),
);
const englishRoutes = new Set(
  walkPages("src/app/en").filter(isComparableRoute),
);
equalSets("public route parity", japaneseRoutes, englishRoutes);

const japaneseArticleSlugs = new Set(
  [...read("src/lib/articles.ts").matchAll(/^\s*slug:\s*"([^"]+)"/gm)].map(
    (match) => match[1],
  ),
);
const englishArticleSlugs = new Set(
  [...read("src/lib/articles-en.ts").matchAll(/\bslug:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  ),
);
equalSets("article parity", japaneseArticleSlugs, englishArticleSlugs);

for (const [route, component] of [
  ["about", "AboutPageContent"],
  ["aisho", "AishoPage"],
  ["diagnosis", "DiagnosisPageContent"],
  ["login", "LoginPageContent"],
  ["result", "ResultRedirect"],
  ["types", "TypesGalleryPage"],
]) {
  requireText(
    `src/app/${route}/page.tsx`,
    `<${component} locale="ja" />`,
    `${route} Japanese shared component`,
  );
  requireText(
    `src/app/en/${route}/page.tsx`,
    `<${component} locale="en" />`,
    `${route} English shared component`,
  );
}

for (const [file, locale, label] of [
  ["src/app/purchase-complete/page.tsx", "ja", "Japanese purchase fallback"],
  ["src/app/en/purchase-complete/page.tsx", "en", "English purchase fallback"],
]) {
  requireText(
    file,
    `<PurchaseUnverifiedView locale="${locale}" />`,
    label,
  );
}

requireText(
  "src/app/page.tsx",
  '<TopPage locale="ja" />',
  "Japanese home shell",
);
requireText(
  "src/components/en/EnTopPage.tsx",
  '<TopPage locale="en" />',
  "English home shell",
);
for (const component of [
  "TopHeader",
  "TopHero",
  "TopStats",
  "TopFooter",
]) {
  requireText(
    "src/components/top/TopPage.tsx",
    `<${component}`,
    `shared home ${component}`,
  );
}
forbidText(
  "src/components/top/TopPage.tsx",
  "TopSeoContent",
  "removed home information blocks",
);
forbidText(
  "src/app/globals.css",
  'html[lang="en"] {\n  --font-noto-sans:',
  "English/Japanese font-family parity",
);
requireText(
  "src/app/globals.css",
  '--font-noto-sans: "Noto Sans", "Noto Sans JP",',
  "shared Noto Sans font stack",
);

forbidText(
  "src/components/diagnosis/DiagnosisPageContent.tsx",
  'locale !== "en"',
  "English diagnosis share-band exclusion",
);
forbidText(
  "src/components/diagnosis/DiagnosisPageContent.tsx",
  "By viewing your result, you agree",
  "removed English diagnosis consent note",
);
requireText(
  "src/components/diagnosis/DiagnosisShareBand.tsx",
  "shareUrl && !isKo && !isEn",
  "English diagnosis share-band LINE exclusion",
);
requireText(
  "src/components/result/MeStickyHeader.tsx",
  "activeShareUrl && !isKo && !isEn",
  "English result share-dialog LINE exclusion",
);
requireText(
  "src/components/result/LockedInviteShare.tsx",
  "isKorean || isEnglish",
  "English friend-invite LINE exclusion",
);
forbidText(
  "src/app/api/diagnosis/route.ts",
  'postDiagnosisReportEmail && locale !== "en"',
  "English detailed-report email exclusion",
);
for (const [locale, label] of [
  ["ja", "Japanese diagnosis progress persistence"],
  ["en", "English diagnosis progress persistence"],
]) {
  requireText(
    "src/i18n/diagnosis.ts",
    `${locale}: {\n    locale: "${locale}",`,
    label,
  );
}
const diagnosisLocaleSource = read("src/i18n/diagnosis.ts");
for (const locale of ["ja", "en"]) {
  const localeBlock = diagnosisLocaleSource.match(
    new RegExp(`${locale}: \\{[\\s\\S]*?\\n  \\},`),
  )?.[0];
  if (!localeBlock?.includes("persistProgress: false")) {
    failures.push(`${locale} diagnosis must not persist partial answers`);
  }
}
forbidText(
  "src/components/result/MeResultPage.tsx",
  'cardMode={isEnglish ? "legacy" : undefined}',
  "English-only result paywall mode",
);
forbidText(
  "src/lib/email.ts",
  'locale === "en" ? "/en/tako"',
  "English friend email result-link mismatch",
);
requireText(
  "src/components/aisho/AishoPage.tsx",
  'href={`${localePrefix}/types`}',
  "localized compatibility fallback links",
);
requireText(
  "src/components/aisho/AishoPage.tsx",
  '"32タイプを見る"',
  "Japanese compatibility fallback CTA",
);
requireText(
  "src/components/aisho/AishoPage.tsx",
  '"Browse 32 personality types"',
  "English compatibility fallback CTA",
);

for (const [file, locale, label] of [
  ["src/app/friend/[inviteCode]/page.tsx", "ja", "Japanese friend invite"],
  ["src/app/en/friend/[inviteCode]/page.tsx", "en", "English friend invite"],
  ["src/app/share/[code]/page.tsx", "ja", "Japanese shared result"],
  ["src/app/en/share/[code]/page.tsx", "en", "English shared result"],
  [
    "src/app/tako/[token]/friend/[perceptionId]/page.tsx",
    "ja",
    "Japanese individual friend result",
  ],
  [
    "src/app/en/tako/[token]/friend/[perceptionId]/page.tsx",
    "en",
    "English individual friend result",
  ],
]) {
  requireText(file, `locale="${locale}"`, label);
}

for (const [file, component, label] of [
  ["src/app/auth/error/page.tsx", "AuthErrorContent", "Japanese auth error"],
  ["src/app/en/auth/error/page.tsx", "AuthErrorContent", "English auth error"],
  [
    "src/app/login/confirm/page.tsx",
    "LoginConfirmPageContent",
    "Japanese login confirmation",
  ],
  [
    "src/app/en/login/confirm/page.tsx",
    "LoginConfirmPageContent",
    "English login confirmation",
  ],
  [
    "src/app/evaluate/sent/[perceptionId]/page.tsx",
    "FriendIndividualGuide",
    "Japanese evaluation completion",
  ],
  [
    "src/app/en/evaluate/sent/[perceptionId]/page.tsx",
    "FriendIndividualGuide",
    "English evaluation completion",
  ],
]) {
  requireText(file, component, label);
}

for (const [file, localePath, label] of [
  ["src/app/about/page.tsx", '"/en/about"', "Japanese about English alternate"],
  ["src/app/en/about/page.tsx", '"/id/about"', "English about complete alternates"],
  ["src/app/articles/[slug]/page.tsx", "`/id/articles/${article.slug}`", "Japanese article complete alternates"],
  ["src/app/en/articles/[slug]/page.tsx", "`/id/articles/${article.slug}`", "English article complete alternates"],
]) {
  requireText(file, localePath, label);
}

requireText(
  "src/app/tako/page.tsx",
  "<TakoEntryPage />",
  "Japanese friend-feedback entry",
);
requireText(
  "src/components/en/EnTakoEntryPage.tsx",
  '<TakoEntryPage locale="en" />',
  "English friend-feedback entry",
);
requireText(
  "src/app/me/[token]/page.tsx",
  'locale="ja"',
  "Japanese result shell",
);
requireText(
  "src/app/en/me/[token]/page.tsx",
  'locale="en"',
  "English result shell",
);
for (const [file, label] of [
  ["src/app/me/[token]/loading.tsx", "Japanese result loading shell"],
  ["src/app/en/me/[token]/loading.tsx", "English result loading shell"],
]) {
  requireText(file, "<MeResultLoading />", label);
}
requireText(
  "src/components/result/MeResultPage.tsx",
  "<EnSiteFooter topBorder={false} />",
  "English result footer border parity",
);

for (const expected of [
  "TakoViewTracker",
  "MetaPurchaseDataLayer",
  "verifyPaidFullAccessCheckoutSession",
  "createMetaPurchaseClaimToken",
]) {
  requireText(
    "src/components/en/EnTakoResultPage.tsx",
    expected,
    `English friend-result ${expected}`,
  );
}
forbidText(
  "src/components/en/EnTakoResultPage.tsx",
  "ResultViewTracker",
  "English friend-result tracker mismatch",
);
requireText(
  "src/app/en/tako/[token]/page.tsx",
  "sessionId={query.session_id}",
  "English friend-result purchase restoration",
);

for (const [file, locale, label] of [
  ["src/app/tarot/[mode]/page.tsx", "ja", "Japanese tarot mode alternates"],
  ["src/app/en/tarot/[mode]/page.tsx", "en", "English tarot mode alternates"],
]) {
  requireText(file, `"${locale}"`, label);
  requireText(file, "`/id/tarot/${mode}`", label);
}
for (const expected of [
  '<TopHeader locale="en" />',
  '<TopFooter locale="en" />',
]) {
  requireText("src/app/en/tarot/layout.tsx", expected, "English tarot shared chrome");
}
forbidText(
  "src/app/en/layout.tsx",
  '<div lang="en"',
  "English-only root layout wrapper",
);
requireText(
  "src/components/LegalDocument.tsx",
  '<TopHeader locale={isEnglish ? "en" : isIndonesian ? "id" : "ja"} />',
  "shared legal header",
);
requireText(
  "src/components/LegalDocument.tsx",
  '<TopFooter locale={isEnglish ? "en" : isIndonesian ? "id" : "ja"} />',
  "shared legal footer",
);

if (failures.length) {
  console.error("English/Japanese parity verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `English/Japanese parity verified: ${japaneseRoutes.size} public routes, ${japaneseArticleSlugs.size} article slugs, shared core page shells.`,
);
