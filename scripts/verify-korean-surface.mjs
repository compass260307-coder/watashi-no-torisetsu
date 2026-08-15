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
for (const disabledExpression of ["!koreanPath && !navHidden", "!koreanPath &&"]) {
  if (bottomNav.includes(disabledExpression)) {
    problems.push(
      `src/components/BottomNav.tsx: Korean notification badges are disabled by ${disabledExpression}`,
    );
  }
}
if (!bottomNav.includes('data-notification-badge="true"')) {
  problems.push("src/components/BottomNav.tsx: notification badge lacks browser QA marker");
}

const meResultPage = fs.readFileSync(
  path.join(ROOT, "src/components/result/MeResultPage.tsx"),
  "utf8",
);
if (meResultPage.includes("!isKorean && <TakoAttentionOnResult")) {
  problems.push("src/components/result/MeResultPage.tsx: Korean friend badge grant is disabled");
}
if (meResultPage.includes("!isKorean && fullAccessPaid")) {
  problems.push("src/components/result/MeResultPage.tsx: Korean destiny badge grant is disabled");
}
if (/const showUnmeiPromo\s*=\s*!isKorean/.test(meResultPage)) {
  problems.push("src/components/result/MeResultPage.tsx: Korean unmei promo is disabled");
}
if (
  !meResultPage.includes('href={isKorean ? "/ko/unmei" : "/unmei"}') &&
  !meResultPage.includes('href="/ko/unmei"')
) {
  problems.push(
    "src/components/result/MeResultPage.tsx: Korean unmei promo lacks a localized href",
  );
}
for (const required of ["프리미엄에서 잠금 해제", "프리미엄 자세히 보기"]) {
  if (!meResultPage.includes(required)) {
    problems.push(
      `src/components/result/MeResultPage.tsx: Korean unmei promo lacks ${required}`,
    );
  }
}

const friendGuide = fs.readFileSync(
  path.join(ROOT, "src/components/result/FriendIndividualGuide.tsx"),
  "utf8",
);
if (friendGuide.includes("!isKorean && <MeAttentionOnGuide")) {
  problems.push("src/components/result/FriendIndividualGuide.tsx: Korean self badge grant is disabled");
}
if (friendGuide.includes("{!isKorean && (")) {
  problems.push("src/components/result/FriendIndividualGuide.tsx: Korean proof band is disabled");
}
if (!friendGuide.includes('lead={isKorean ? "지금까지" : undefined}')) {
  problems.push("src/components/result/FriendIndividualGuide.tsx: Korean proof band copy is missing");
}

const takoLockedState = fs.readFileSync(
  path.join(ROOT, "src/components/result/TakoLockedState.tsx"),
  "utf8",
);
if (takoLockedState.includes("{!isKo && (")) {
  problems.push("src/components/result/TakoLockedState.tsx: Korean proof band is disabled");
}
for (const required of ["지금까지", "명 이상", "의 친구가 친구 진단에 답했어요"]) {
  if (!takoLockedState.includes(required)) {
    problems.push(`src/components/result/TakoLockedState.tsx: Korean proof band lacks ${required}`);
  }
}

const magicLinkVerification = fs.readFileSync(
  path.join(ROOT, "src/app/api/auth/verify-magic-link/route.ts"),
  "utf8",
);
if (magicLinkVerification.includes('userRow.unmei ? "/unmei"')) {
  problems.push("src/app/api/auth/verify-magic-link/route.ts: Korean unmei buyer returns to Japanese route");
}
if (!magicLinkVerification.includes('userRow.unmei ? `${prefix}/unmei`')) {
  problems.push("src/app/api/auth/verify-magic-link/route.ts: localized unmei return route is missing");
}

const fullAccessCta = fs.readFileSync(
  path.join(ROOT, "src/components/result/FullAccessCta.tsx"),
  "utf8",
);
if (fullAccessCta.includes('unauthHref = "/diagnosis"')) {
  problems.push("src/components/result/FullAccessCta.tsx: unauthenticated fallback is fixed to Japanese diagnosis");
}
if (!fullAccessCta.includes('locale === "ko" ? "/ko/diagnosis" : "/diagnosis"')) {
  problems.push("src/components/result/FullAccessCta.tsx: locale-aware unauthenticated fallback is missing");
}

const japaneseUnmeiPage = fs.readFileSync(
  path.join(ROOT, "src/app/unmei/page.tsx"),
  "utf8",
);
if (!japaneseUnmeiPage.includes("hasUnmeiAccess(userId)")) {
  problems.push("src/app/unmei/page.tsx: access check does not use shared unmei entitlement");
}
if (japaneseUnmeiPage.includes('.select("unmei")')) {
  problems.push("src/app/unmei/page.tsx: access check still reads users.unmei directly");
}

const koreanResultFallback = fs.readFileSync(
  path.join(ROOT, "src/components/ko/result/KoResultPageClient.tsx"),
  "utf8",
);
for (const forbidden of ["readStoredScores", "/ko/me/preview", "isPreviewMode"]) {
  if (koreanResultFallback.includes(forbidden)) {
    problems.push(`src/components/ko/result/KoResultPageClient.tsx: fallback still uses ${forbidden}`);
  }
}
for (const required of ["torisetsu_owner_token", '"/ko/diagnosis"']) {
  if (!koreanResultFallback.includes(required)) {
    problems.push(`src/components/ko/result/KoResultPageClient.tsx: fallback lacks ${required}`);
  }
}

const takoReportSheets = fs.readFileSync(
  path.join(ROOT, "src/lib/tako-report-sheets.ts"),
  "utf8",
);
if (!takoReportSheets.includes('if (locale === "ko" && reopenIdx < manualParas.length)')) {
  problems.push("src/lib/tako-report-sheets.ts: Korean report section reopening is missing");
}

const koreanHeader = fs.readFileSync(
  path.join(ROOT, "src/components/ko/top/KoTopHeader.tsx"),
  "utf8",
);
for (const required of [
  'import { LoginModal }',
  'locale="ko"',
  "데이터 초기화",
  "resetLocalData",
]) {
  if (!koreanHeader.includes(required)) {
    problems.push(`src/components/ko/top/KoTopHeader.tsx: missing ${required}`);
  }
}

const koreanFooter = fs.readFileSync(
  path.join(ROOT, "src/components/ko/top/KoTopFooter.tsx"),
  "utf8",
);
for (const required of [
  "/ko/articles/ocean-shindan",
  "/ko/articles/tako-bunseki",
  "/ko/articles/torisetsu-tsukurikata",
  "/ko/articles/sixteen-types-vs-ocean",
  "https://www.instagram.com/torisetsu_app",
  "https://x.com/torisetsu_app",
  "https://www.tiktok.com/@torisetsu_app",
]) {
  if (!koreanFooter.includes(required)) {
    problems.push(`src/components/ko/top/KoTopFooter.tsx: missing ${required}`);
  }
}

const japaneseArticles = fs.readFileSync(
  path.join(ROOT, "src/lib/articles.ts"),
  "utf8",
);
const koreanArticles = fs.readFileSync(
  path.join(ROOT, "src/lib/articles-ko.ts"),
  "utf8",
);
const articleSlugs = (source) => [
  ...source.matchAll(/\bslug:\s*"([^"]+)"/g),
].map((match) => match[1]);
const japaneseArticleSlugs = new Set(articleSlugs(japaneseArticles));
const koreanArticleSlugs = new Set(articleSlugs(koreanArticles));
for (const slug of japaneseArticleSlugs) {
  if (!koreanArticleSlugs.has(slug)) {
    problems.push(`src/lib/articles-ko.ts: missing Japanese article slug ${slug}`);
  }
}
for (const slug of koreanArticleSlugs) {
  if (!japaneseArticleSlugs.has(slug)) {
    problems.push(`src/lib/articles-ko.ts: unexpected Korean-only article slug ${slug}`);
  }
}

const sitemapSource = fs.readFileSync(path.join(ROOT, "src/app/sitemap.ts"), "utf8");
if (sitemapSource.includes("`${SITE_URL}/unmei`")) {
  problems.push("src/app/sitemap.ts: Japanese /unmei is registered twice");
}

const browserVerification = fs.readFileSync(
  path.join(ROOT, "scripts/verify-korean-browser.mjs"),
  "utf8",
);
for (const route of [
  '"/ko/unmei"',
  '"/ko/hoshiyomi"',
  '"/ko/articles/tako-bunseki"',
  '"/ko/tako/preview?previewLocked=1&fromPreview=1&friends=1"',
  '"/ko/tako/preview/friend/preview-friend?previewType=sparkle-dolphin__N&fromPreview=1"',
  '"/ko/evaluate/result/preview?previewType=sparkle-dolphin__N&fromPreview=1"',
  '"/ko/me/preview?previewType=sparkle-dolphin__N&fromPreview=1"',
]) {
  if (!browserVerification.includes(route)) {
    problems.push(`scripts/verify-korean-browser.mjs: missing browser target ${route}`);
  }
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

const koreanTakoEntry = fs.readFileSync(
  path.join(ROOT, "src/components/friend/KoreanTakoEntryPage.tsx"),
  "utf8",
);
for (const forbidden of ["torisetsu_owner_token", "router.replace(", "확인하는 중..."]) {
  if (koreanTakoEntry.includes(forbidden)) {
    problems.push(`src/components/friend/KoreanTakoEntryPage.tsx: entry still auto-resolves saved result via ${forbidden}`);
  }
}

const koreanFriendIndividual = fs.readFileSync(
  path.join(ROOT, "src/app/ko/tako/[token]/friend/[perceptionId]/page.tsx"),
  "utf8",
);
for (const required of ["FriendIndividualResultPage", 'locale="ko"']) {
  if (!koreanFriendIndividual.includes(required)) {
    problems.push(`src/app/ko/tako/[token]/friend/[perceptionId]/page.tsx: missing ${required}`);
  }
}
if (koreanFriendIndividual.includes("redirect(")) {
  problems.push("src/app/ko/tako/[token]/friend/[perceptionId]/page.tsx: friend detail still redirects to aggregate result");
}

const koreanEvaluationResult = fs.readFileSync(
  path.join(ROOT, "src/app/ko/evaluate/result/[perceptionId]/page.tsx"),
  "utf8",
);
if (koreanEvaluationResult.includes("#friend-")) {
  problems.push("src/app/ko/evaluate/result/[perceptionId]/page.tsx: result still redirects to aggregate result hash");
}
for (const required of [
  "FriendIndividualResultPage",
  'locale="ko"',
  'variant="evaluate"',
  "previewAllowed",
]) {
  if (!koreanEvaluationResult.includes(required)) {
    problems.push(`src/app/ko/evaluate/result/[perceptionId]/page.tsx: missing ${required}`);
  }
}
if (koreanEvaluationResult.includes("/ko/tako/${encodeURIComponent(ownerToken)}/friend/")) {
  problems.push("src/app/ko/evaluate/result/[perceptionId]/page.tsx: result still redirects away from its own URL");
}

const koreanUnmeiPage = fs.readFileSync(
  path.join(ROOT, "src/app/ko/unmei/page.tsx"),
  "utf8",
);
for (const required of [
  "MetaPurchaseDataLayer",
  "verifyPaidMetaPurchaseCheckoutSession",
  "UnmeiChatCheckoutGate",
  'locale="ko"',
  'checkout === "success"',
  '<UnmeiCheckoutConfirming locale="ko" />',
]) {
  if (!koreanUnmeiPage.includes(required)) {
    problems.push(`src/app/ko/unmei/page.tsx: Japanese-parity purchase flow lacks ${required}`);
  }
}
for (const forbidden of ["PaidUnlockWatcher", 'product="full_access"']) {
  if (koreanUnmeiPage.includes(forbidden)) {
    problems.push(`src/app/ko/unmei/page.tsx: legacy Korean purchase flow still uses ${forbidden}`);
  }
}

const koreanUnmeiLanding = fs.readFileSync(
  path.join(ROOT, "src/components/ko/unmei/KoUnmeiLanding.tsx"),
  "utf8",
);
if (!koreanUnmeiLanding.includes("UnmeiPriceCta") ||
    !koreanUnmeiLanding.includes("launchChat")) {
  problems.push("src/components/ko/unmei/KoUnmeiLanding.tsx: CTA does not launch the shared birth chat");
}
if (koreanUnmeiLanding.includes("SelfAccessPlanCarousel")) {
  problems.push("src/components/ko/unmei/KoUnmeiLanding.tsx: direct plan checkout bypasses the birth chat");
}

const checkoutSessionRoute = fs.readFileSync(
  path.join(ROOT, "src/app/api/checkout/create-full-access-session/route.ts"),
  "utf8",
);
if (!checkoutSessionRoute.includes(
  '`${localePrefix}/unmei?checkout=success&session_id={CHECKOUT_SESSION_ID}`',
)) {
  problems.push("src/app/api/checkout/create-full-access-session/route.ts: localized unmei success URL is not shared");
}

const koreanPurchaseComplete = fs.readFileSync(
  path.join(ROOT, "src/app/ko/purchase-complete/page.tsx"),
  "utf8",
);
for (const required of [
  "PurchaseCompleteView",
  "destinyFeaturesIncluded={session.destinyFeaturesIncluded}",
  "friendFeaturesIncluded={session.friendFeaturesIncluded}",
  'locale="ko"',
]) {
  if (!koreanPurchaseComplete.includes(required)) {
    problems.push(`src/app/ko/purchase-complete/page.tsx: shared completion view lacks ${required}`);
  }
}

for (const file of ["src/app/ko/login/page.tsx", "src/app/ko/auth/error/page.tsx"]) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  if (source.includes("robots:")) {
    problems.push(`${file}: robots metadata differs from the Japanese page`);
  }
}

const japaneseTopPage = fs.readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");
if (!japaneseTopPage.includes('<TopViewTracker locale="ja" />')) {
  problems.push("src/app/page.tsx: Japanese top_viewed tracking is missing");
}
const japaneseTopHero = fs.readFileSync(
  path.join(ROOT, "src/components/top/TopHero.tsx"),
  "utf8",
);
if (!japaneseTopHero.includes('onClick={() => trackTopCta("ja")}')) {
  problems.push("src/components/top/TopHero.tsx: Japanese top_cta_clicked tracking is missing");
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
if (localeSwitch.includes('`/ko/tako/${tokenPath}#friend-${perceptionPath}`')) {
  problems.push("src/lib/locale-switch.ts: Korean friend detail still maps to aggregate result hash");
}
if (
  !localeSwitch.includes(
    '`${targetLocale === "ko" ? "/ko" : ""}/tako/${tokenPath}/friend/${perceptionPath}`',
  )
) {
  problems.push("src/lib/locale-switch.ts: localized dedicated friend detail mapping is missing");
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
