import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const problems = [];

const koreanSourceDirs = ["src/app/ko", "src/components/ko", "src/i18n/ko"];

const japanesePathPattern =
  /(?:href=|redirect\(|router\.push\()\{?["'`]\/(diagnosis|tako|login|types|about|articles|terms|privacy|legal|purchase-complete|result|share|friend|me|unmei|hoshiyomi|aisho|tarot|alice)\b/g;

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

const koreanCommerce = fs.readFileSync(
  path.join(ROOT, "src/app/ko/legal/commerce/page.tsx"),
  "utf8",
);
for (const required of [
  "잠긴 9개 섹션",
  "Alice 채팅 30회",
  "타로 3종",
  "현재 완전판 코스와 동일한 내용",
]) {
  if (!koreanCommerce.includes(required)) {
    problems.push(
      `src/app/ko/legal/commerce/page.tsx: current offer lacks ${required}`,
    );
  }
}
for (const forbidden of [
  "잠긴 8개 섹션",
  "AI 점성술사 채팅 5회",
  "프리미엄: 완전판의 모든 기능",
]) {
  if (koreanCommerce.includes(forbidden)) {
    problems.push(
      `src/app/ko/legal/commerce/page.tsx: stale offer remains (${forbidden})`,
    );
  }
}

const koreanTerms = fs.readFileSync(
  path.join(ROOT, "src/app/ko/terms/page.tsx"),
  "utf8",
);
for (const required of ["현재 완전판에는", "Alice 채팅 30회", "타로 3종"]) {
  if (!koreanTerms.includes(required)) {
    problems.push(`src/app/ko/terms/page.tsx: current offer lacks ${required}`);
  }
}
if (koreanTerms.includes("프리미엄에만 포함됩니다")) {
  problems.push(
    "src/app/ko/terms/page.tsx: destiny and Alice are still premium-only",
  );
}

const aishoPage = fs.readFileSync(
  path.join(ROOT, "src/components/aisho/AishoPage.tsx"),
  "utf8",
);
if (
  !aishoPage.includes(
    "완전판 코스에서 두 사람의 궁합 결과 전체를 확인할 수 있어요.",
  )
) {
  problems.push(
    "src/components/aisho/AishoPage.tsx: Korean lock does not name the full plan",
  );
}
if (
  aishoPage.includes(
    "프리미엄 코스에서 두 사람의 궁합 결과 전체를 확인할 수 있어요.",
  )
) {
  problems.push(
    "src/components/aisho/AishoPage.tsx: Korean lock still names the premium plan",
  );
}

const bottomNav = fs.readFileSync(
  path.join(ROOT, "src/components/BottomNav.tsx"),
  "utf8",
);
if (bottomNav.includes('useState("/diagnosis")')) {
  problems.push(
    "src/components/BottomNav.tsx: torisetsuUrl defaults to /diagnosis",
  );
}
if (bottomNav.includes('useState("/tako")')) {
  problems.push("src/components/BottomNav.tsx: takoUrl defaults to /tako");
}
for (const disabledExpression of [
  "!koreanPath && !navHidden",
  "!koreanPath &&",
]) {
  if (bottomNav.includes(disabledExpression)) {
    problems.push(
      `src/components/BottomNav.tsx: Korean notification badges are disabled by ${disabledExpression}`,
    );
  }
}
if (!bottomNav.includes('data-notification-badge="true"')) {
  problems.push(
    "src/components/BottomNav.tsx: notification badge lacks browser QA marker",
  );
}

const takoLockPopover = fs.readFileSync(
  path.join(ROOT, "src/components/TakoLockPopover.tsx"),
  "utf8",
);
if (!takoLockPopover.includes("left: LEFT_BY_TARGET[target]")) {
  problems.push(
    "src/components/TakoLockPopover.tsx: lock popover does not share tab positions across locales",
  );
}
if (takoLockPopover.includes('locale === "ko" && target === "friend"')) {
  problems.push(
    "src/components/TakoLockPopover.tsx: Korean friend popover still uses a locale-specific position",
  );
}

const meResultPage = fs.readFileSync(
  path.join(ROOT, "src/components/result/MeResultPage.tsx"),
  "utf8",
);
if (meResultPage.includes("!isKorean && <TakoAttentionOnResult")) {
  problems.push(
    "src/components/result/MeResultPage.tsx: Korean friend badge grant is disabled",
  );
}
if (meResultPage.includes("!isKorean && fullAccessPaid")) {
  problems.push(
    "src/components/result/MeResultPage.tsx: Korean destiny badge grant is disabled",
  );
}
if (/const showUnmeiPromo\s*=\s*!isKorean/.test(meResultPage)) {
  problems.push(
    "src/components/result/MeResultPage.tsx: Korean unmei promo is disabled",
  );
}
for (const required of [
  "MeUnmeiChatLauncher",
  "완전판 코스 혜택",
  "완전판에서 잠금 해제",
  "완전판에는 채팅 30회가 포함됩니다.",
  "프리미엄에서 잠금 해제",
  "Alice의 질문에 답하기",
]) {
  if (!meResultPage.includes(required)) {
    problems.push(
      `src/components/result/MeResultPage.tsx: Korean unmei promo lacks ${required}`,
    );
  }
}
for (const forbidden of [
  "showUnmeiPromo && !isKorean",
  "const cautionAllVisible = isKorean || partTwoUnlocked",
  "...(isKorean\n              ? []",
]) {
  if (meResultPage.includes(forbidden)) {
    problems.push(
      `src/components/result/MeResultPage.tsx: Japanese-only result behavior remains (${forbidden})`,
    );
  }
}

const friendGuide = fs.readFileSync(
  path.join(ROOT, "src/components/result/FriendIndividualGuide.tsx"),
  "utf8",
);
if (friendGuide.includes("!isKorean && <MeAttentionOnGuide")) {
  problems.push(
    "src/components/result/FriendIndividualGuide.tsx: Korean self badge grant is disabled",
  );
}
if (friendGuide.includes("{!isKorean && (")) {
  problems.push(
    "src/components/result/FriendIndividualGuide.tsx: Korean proof band is disabled",
  );
}

const magicLinkVerification = fs.readFileSync(
  path.join(ROOT, "src/app/api/auth/verify-magic-link/route.ts"),
  "utf8",
);
if (magicLinkVerification.includes('userRow.unmei ? "/unmei"')) {
  problems.push(
    "src/app/api/auth/verify-magic-link/route.ts: Korean unmei buyer returns to Japanese route",
  );
}
if (!magicLinkVerification.includes("userRow.unmei ? `${prefix}/unmei`")) {
  problems.push(
    "src/app/api/auth/verify-magic-link/route.ts: localized unmei return route is missing",
  );
}

const fullAccessCta = fs.readFileSync(
  path.join(ROOT, "src/components/result/FullAccessCta.tsx"),
  "utf8",
);
if (fullAccessCta.includes('unauthHref = "/diagnosis"')) {
  problems.push(
    "src/components/result/FullAccessCta.tsx: unauthenticated fallback is fixed to Japanese diagnosis",
  );
}
if (
  !fullAccessCta.includes('locale === "ko" ? "/ko/diagnosis" : "/diagnosis"')
) {
  problems.push(
    "src/components/result/FullAccessCta.tsx: locale-aware unauthenticated fallback is missing",
  );
}

const japaneseUnmeiPage = fs.readFileSync(
  path.join(ROOT, "src/app/unmei/page.tsx"),
  "utf8",
);
if (!japaneseUnmeiPage.includes("hasUnmeiAccess(userId)")) {
  problems.push(
    "src/app/unmei/page.tsx: access check does not use shared unmei entitlement",
  );
}
if (japaneseUnmeiPage.includes('.select("unmei")')) {
  problems.push(
    "src/app/unmei/page.tsx: access check still reads users.unmei directly",
  );
}

const koreanResultFallback = fs.readFileSync(
  path.join(ROOT, "src/components/ko/result/KoResultPageClient.tsx"),
  "utf8",
);
for (const forbidden of [
  "readStoredScores",
  "/ko/me/preview",
  "isPreviewMode",
]) {
  if (koreanResultFallback.includes(forbidden)) {
    problems.push(
      `src/components/ko/result/KoResultPageClient.tsx: fallback still uses ${forbidden}`,
    );
  }
}
for (const required of ["torisetsu_owner_token", '"/ko/diagnosis"']) {
  if (!koreanResultFallback.includes(required)) {
    problems.push(
      `src/components/ko/result/KoResultPageClient.tsx: fallback lacks ${required}`,
    );
  }
}
for (const required of [
  "min-h-screen flex items-center justify-center grid-bg",
  "w-10 h-10 rounded-full border-[3px] border-[#2E2E5C]/20 border-t-[#2E2E5C] animate-spin",
]) {
  if (!koreanResultFallback.includes(required)) {
    problems.push(
      `src/components/ko/result/KoResultPageClient.tsx: Japanese-parity loader lacks ${required}`,
    );
  }
}
for (const forbidden of ["<main className=", "bg-white"]) {
  if (koreanResultFallback.includes(forbidden)) {
    problems.push(
      `src/components/ko/result/KoResultPageClient.tsx: divergent loader remains (${forbidden})`,
    );
  }
}

const takoReportSheets = fs.readFileSync(
  path.join(ROOT, "src/lib/tako-report-sheets.ts"),
  "utf8",
);
if (
  !takoReportSheets.includes(
    'if (locale === "ko" && reopenIdx < manualParas.length)',
  )
) {
  problems.push(
    "src/lib/tako-report-sheets.ts: Korean report section reopening is missing",
  );
}

const koreanHeaderPath = "src/components/ko/top/KoTopHeader.tsx";
const sharedHeaderPath = "src/components/top/TopHeader.tsx";
const koreanHeader = [koreanHeaderPath, sharedHeaderPath]
  .map((file) => fs.readFileSync(path.join(ROOT, file), "utf8"))
  .join("\n");
for (const required of [
  "import { LoginModal }",
  'locale="ko"',
  "데이터 초기화",
  "resetLocalData",
]) {
  if (!koreanHeader.includes(required)) {
    problems.push(`effective Korean TopHeader: missing ${required}`);
  }
}

const koreanFooterPath = "src/components/ko/top/KoTopFooter.tsx";
const sharedFooterPath = "src/components/top/TopFooter.tsx";
const koreanFooter = [koreanFooterPath, sharedFooterPath]
  .map((file) => fs.readFileSync(path.join(ROOT, file), "utf8"))
  .join("\n");
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
    problems.push(`effective Korean TopFooter: missing ${required}`);
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
const koreanArticlePage = fs.readFileSync(
  path.join(ROOT, "src/app/ko/articles/[slug]/page.tsx"),
  "utf8",
);
const articleSlugs = (source) =>
  [...source.matchAll(/\bslug:\s*"([^"]+)"/g)].map((match) => match[1]);
const japaneseArticleSlugs = new Set(articleSlugs(japaneseArticles));
const koreanArticleSlugs = new Set(articleSlugs(koreanArticles));
for (const slug of japaneseArticleSlugs) {
  if (!koreanArticleSlugs.has(slug)) {
    problems.push(
      `src/lib/articles-ko.ts: missing Japanese article slug ${slug}`,
    );
  }
}
for (const slug of koreanArticleSlugs) {
  if (!japaneseArticleSlugs.has(slug)) {
    problems.push(
      `src/lib/articles-ko.ts: unexpected Korean-only article slug ${slug}`,
    );
  }
}
for (const required of [
  "getKoRelatedArticles",
  "const related = getKoRelatedArticles(article.slug)",
  "related.map((relatedArticle)",
  "href={`/ko/articles/${relatedArticle.slug}`}",
  'href="/ko/about"',
]) {
  if (!koreanArticlePage.includes(required)) {
    problems.push(
      `src/app/ko/articles/[slug]/page.tsx: related navigation lacks ${required}`,
    );
  }
}
if (!koreanArticles.includes("export function getKoRelatedArticles")) {
  problems.push(
    "src/lib/articles-ko.ts: Korean related-article helper is missing",
  );
}

const sitemapSource = fs.readFileSync(
  path.join(ROOT, "src/app/sitemap.ts"),
  "utf8",
);
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
  '"/ko/tarot"',
  '"/ko/tarot/one"',
  '"/ko/articles/tako-bunseki"',
  '"/ko/tako/preview?previewLocked=1&fromPreview=1&friends=1"',
  '"/ko/tako/preview/friend/preview-friend?previewType=sparkle-dolphin__N&fromPreview=1"',
  '"/ko/evaluate/result/preview?previewType=sparkle-dolphin__N&fromPreview=1"',
  '"/ko/me/preview?previewType=sparkle-dolphin__N&fromPreview=1"',
]) {
  if (!browserVerification.includes(route)) {
    problems.push(
      `scripts/verify-korean-browser.mjs: missing browser target ${route}`,
    );
  }
}

const friendList = fs.readFileSync(
  path.join(ROOT, "src/components/result/FriendList.tsx"),
  "utf8",
);
if (friendList.includes("href={`/tako/")) {
  problems.push(
    "src/components/result/FriendList.tsx: friend detail link ignores /ko prefix",
  );
}
if (
  friendList.includes("メッセージあり") &&
  !friendList.includes("메시지 있음")
) {
  problems.push(
    "src/components/result/FriendList.tsx: message badge lacks Korean copy",
  );
}

const koreanTakoEntry = fs.readFileSync(
  path.join(ROOT, "src/components/friend/KoreanTakoEntryPage.tsx"),
  "utf8",
);
for (const forbidden of [
  "torisetsu_owner_token",
  "router.replace(",
  "확인하는 중...",
]) {
  if (koreanTakoEntry.includes(forbidden)) {
    problems.push(
      `src/components/friend/KoreanTakoEntryPage.tsx: entry still auto-resolves saved result via ${forbidden}`,
    );
  }
}

const koreanFriendIndividual = fs.readFileSync(
  path.join(ROOT, "src/app/ko/tako/[token]/friend/[perceptionId]/page.tsx"),
  "utf8",
);
for (const required of ["FriendIndividualResultPage", 'locale="ko"']) {
  if (!koreanFriendIndividual.includes(required)) {
    problems.push(
      `src/app/ko/tako/[token]/friend/[perceptionId]/page.tsx: missing ${required}`,
    );
  }
}
if (koreanFriendIndividual.includes("redirect(")) {
  problems.push(
    "src/app/ko/tako/[token]/friend/[perceptionId]/page.tsx: friend detail still redirects to aggregate result",
  );
}

const koreanEvaluationResult = fs.readFileSync(
  path.join(ROOT, "src/app/ko/evaluate/result/[perceptionId]/page.tsx"),
  "utf8",
);
if (koreanEvaluationResult.includes("#friend-")) {
  problems.push(
    "src/app/ko/evaluate/result/[perceptionId]/page.tsx: result still redirects to aggregate result hash",
  );
}
for (const required of [
  "FriendIndividualResultPage",
  'locale="ko"',
  'variant="evaluate"',
  "previewAllowed",
]) {
  if (!koreanEvaluationResult.includes(required)) {
    problems.push(
      `src/app/ko/evaluate/result/[perceptionId]/page.tsx: missing ${required}`,
    );
  }
}
if (
  koreanEvaluationResult.includes(
    "/ko/tako/${encodeURIComponent(ownerToken)}/friend/",
  )
) {
  problems.push(
    "src/app/ko/evaluate/result/[perceptionId]/page.tsx: result still redirects away from its own URL",
  );
}

const koreanUnmeiPage = fs.readFileSync(
  path.join(ROOT, "src/app/ko/unmei/page.tsx"),
  "utf8",
);
for (const required of [
  "MetaPurchaseDataLayer",
  "verifyPaidMetaPurchaseCheckoutSession",
  'checkoutSession.product !== "full_access"',
  'redirect(`${returnPath}#unlock-unmei`)',
  'locale="ko"',
  'checkout === "success"',
  '<UnmeiCheckoutConfirming locale="ko" />',
]) {
  if (!koreanUnmeiPage.includes(required)) {
    problems.push(
      `src/app/ko/unmei/page.tsx: Japanese-parity purchase flow lacks ${required}`,
    );
  }
}
for (const forbidden of ["PaidUnlockWatcher", 'product="full_access"']) {
  if (koreanUnmeiPage.includes(forbidden)) {
    problems.push(
      `src/app/ko/unmei/page.tsx: legacy Korean purchase flow still uses ${forbidden}`,
    );
  }
}

const koreanUnmeiLanding = fs.readFileSync(
  path.join(ROOT, "src/components/ko/unmei/KoUnmeiLanding.tsx"),
  "utf8",
);
if (
  !koreanUnmeiLanding.includes("UnmeiPriceCta") ||
  !koreanUnmeiLanding.includes("launchChat")
) {
  problems.push(
    "src/components/ko/unmei/KoUnmeiLanding.tsx: CTA does not launch the shared birth chat",
  );
}
if (koreanUnmeiLanding.includes("SelfAccessPlanCarousel")) {
  problems.push(
    "src/components/ko/unmei/KoUnmeiLanding.tsx: direct plan checkout bypasses the birth chat",
  );
}
if (
  !koreanUnmeiLanding.includes(
    'product={hasFull ? "premium_bundle" : "full_access"}',
  )
) {
  problems.push(
    "src/components/ko/unmei/KoUnmeiLanding.tsx: analytics product does not match the displayed offer",
  );
}
for (const required of [
  "약 1분 안에 설계도가 완성돼요",
  "bg-[#FFFBF2] px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-10",
  "grid items-center gap-6 md:grid-cols-2 md:gap-10",
  "h-auto w-full max-w-[320px] md:max-w-[480px]",
  "block text-[28px] font-black text-[#2E2E5C] md:text-[34px]",
  "text-[34px] font-black text-white md:text-[42px]",
  "text-[15px] font-bold leading-relaxed text-[#2E2E5C]/70 md:text-[16px]",
  "text-[14px] font-normal leading-relaxed",
]) {
  if (!koreanUnmeiLanding.includes(required)) {
    problems.push(
      `src/components/ko/unmei/KoUnmeiLanding.tsx: Japanese-parity layout lacks ${required}`,
    );
  }
}
for (const forbidden of ["1~2분", '<h3 className="mt-3.5']) {
  if (koreanUnmeiLanding.includes(forbidden)) {
    problems.push(
      `src/components/ko/unmei/KoUnmeiLanding.tsx: stale landing detail remains (${forbidden})`,
    );
  }
}

const checkoutSessionRoute = fs.readFileSync(
  path.join(ROOT, "src/app/api/checkout/create-full-access-session/route.ts"),
  "utf8",
);
if (
  !checkoutSessionRoute.includes(
    "`${localePrefix}/unmei?checkout=success&session_id={CHECKOUT_SESSION_ID}`",
  )
) {
  problems.push(
    "src/app/api/checkout/create-full-access-session/route.ts: localized unmei success URL is not shared",
  );
}
for (const required of [
  'product === "full_access"\n            ? DESTINY_ACCESS_POLICY_FULL_INCLUDED',
  'product === "full_access"\n            ? HOSHIYOMI_CHAT_POLICY_FULL_ALL_INCLUDED',
  'product === "full_access"\n            ? TAROT_ACCESS_POLICY_FULL_INCLUDED',
  "friend_access_policy: FRIEND_ACCESS_POLICY_LITE_INCLUDED",
  'product === "full_access"\n            ? AISHO_ACCESS_POLICY_FULL_INCLUDED',
  "CURRENT_FULL_ACCESS_COPY[checkoutLocale]",
]) {
  if (!checkoutSessionRoute.includes(required)) {
    problems.push(
      `src/app/api/checkout/create-full-access-session/route.ts: shared current offer lacks ${required}`,
    );
  }
}
for (const forbidden of [
  'checkoutLocale === "ja" && product === "full_access"',
  "FRIEND_ACCESS_POLICY_FULL_ONLY",
  "usesCurrentJapaneseOffer",
]) {
  if (checkoutSessionRoute.includes(forbidden)) {
    problems.push(
      `src/app/api/checkout/create-full-access-session/route.ts: Korean checkout still diverges via ${forbidden}`,
    );
  }
}

const fullAccessPromoCard = fs.readFileSync(
  path.join(ROOT, "src/components/result/FullAccessPromoCard.tsx"),
  "utf8",
);
for (const forbidden of [
  "!isKorean && resolvedCardMode",
  "isKorean || legacyPlanStyle",
  "!isKorean && isStandaloneSelfReport",
]) {
  if (fullAccessPromoCard.includes(forbidden)) {
    problems.push(
      `src/components/result/FullAccessPromoCard.tsx: Korean offer still diverges via ${forbidden}`,
    );
  }
}

const selfAccessPlanCarousel = fs.readFileSync(
  path.join(ROOT, "src/components/result/SelfAccessPlanCarousel.tsx"),
  "utf8",
);
for (const required of [
  "const isSingleOffer =",
  "KO_LIGHT_ACCESS_ITEMS",
  "KO_FULL_ACCESS_ITEMS",
  "학생이라면 여기",
]) {
  if (!selfAccessPlanCarousel.includes(required)) {
    problems.push(
      `src/components/result/SelfAccessPlanCarousel.tsx: Korean current offer lacks ${required}`,
    );
  }
}
if (selfAccessPlanCarousel.includes('locale === "ja" &&\n    !legacyStyle')) {
  problems.push(
    "src/components/result/SelfAccessPlanCarousel.tsx: single-offer layout is still Japanese-only",
  );
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
    problems.push(
      `src/app/ko/purchase-complete/page.tsx: shared completion view lacks ${required}`,
    );
  }
}

const japaneseTopPage = fs.readFileSync(
  path.join(ROOT, "src/app/page.tsx"),
  "utf8",
);
if (!japaneseTopPage.includes('<TopViewTracker locale="ja" />')) {
  problems.push("src/app/page.tsx: Japanese top_viewed tracking is missing");
}
const japaneseTopHero = fs.readFileSync(
  path.join(ROOT, "src/components/top/TopHero.tsx"),
  "utf8",
);
if (!japaneseTopHero.includes('onClick={() => trackTopCta("ja")}')) {
  problems.push(
    "src/components/top/TopHero.tsx: Japanese top_cta_clicked tracking is missing",
  );
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

for (const file of [
  "src/app/ko/tarot/page.tsx",
  "src/app/ko/tarot/[mode]/page.tsx",
]) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    problems.push(`${file}: Japanese-parity Korean route is missing`);
  }
}
for (const route of ["/ko/tarot"]) {
  if (!localeSwitch.includes(route)) {
    problems.push(`src/lib/locale-switch.ts: locale mapping lacks ${route}`);
  }
}

for (const [file, required] of [
  ["src/components/top/TopHeader.tsx", 'href: "/ko/tarot"'],
  ["src/components/top/TopFooter.tsx", 'href: "/ko/tarot"'],
  ["src/components/BottomNav.tsx", 'href: "/ko/tarot"'],
]) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  if (!source.includes(required)) {
    problems.push(`${file}: Korean tarot navigation is missing`);
  }
}
if (localeSwitch.includes("`/ko/tako/${tokenPath}#friend-${perceptionPath}`")) {
  problems.push(
    "src/lib/locale-switch.ts: Korean friend detail still maps to aggregate result hash",
  );
}
if (
  !localeSwitch.includes(
    '`${targetLocale === "ko" ? "/ko" : ""}/tako/${tokenPath}/friend/${perceptionPath}`',
  )
) {
  problems.push(
    "src/lib/locale-switch.ts: localized dedicated friend detail mapping is missing",
  );
}

const featureFlags = fs.readFileSync(
  path.join(ROOT, "src/lib/feature-flags.ts"),
  "utf8",
);
if (featureFlags.includes("KO_UNMEI_ENABLED")) {
  problems.push(
    "src/lib/feature-flags.ts: Korean destiny feature is still gated",
  );
}
if (
  !/function isThirtyTwoEnabled\(\): boolean \{\s*return true;\s*\}/s.test(
    featureFlags,
  )
) {
  problems.push(
    "src/lib/feature-flags.ts: 32-type experience is not permanently shared across locales",
  );
}

const koreanHoshiyomiPage = fs.readFileSync(
  path.join(ROOT, "src/app/ko/hoshiyomi/page.tsx"),
  "utf8",
);
for (const required of [
  "hasPremiumBundleAccess",
  "HOSHIYOMI_CHAT_CREDITS_PREMIUM_BUNDLE",
  "canUpgradeToPremium={",
  "hasChatAccess={false}",
]) {
  if (!koreanHoshiyomiPage.includes(required)) {
    problems.push(
      `src/app/ko/hoshiyomi/page.tsx: Japanese-parity Alice flow lacks ${required}`,
    );
  }
}
if (koreanHoshiyomiPage.includes('redirect("/ko/login")')) {
  problems.push(
    "src/app/ko/hoshiyomi/page.tsx: guests are still redirected before seeing Alice",
  );
}

const hoshiyomiClient = fs.readFileSync(
  path.join(ROOT, "src/components/hoshiyomi/HoshiyomiClient.tsx"),
  "utf8",
);
for (const required of [
  'const CHAT_ACCESS_PRODUCTS = ["full_access", "premium_bundle"] as const',
  '(["premium_bundle"] as const)',
  ": CHAT_ACCESS_PRODUCTS",
  'canUpgradeToPremium ? "premium_bundle" : "full_access"',
]) {
  if (!hoshiyomiClient.includes(required)) {
    problems.push(
      `src/components/hoshiyomi/HoshiyomiClient.tsx: shared Alice paywall lacks ${required}`,
    );
  }
}

const unmeiPriceCta = fs.readFileSync(
  path.join(ROOT, "src/components/uranai/UnmeiPriceCta.tsx"),
  "utf8",
);
for (const required of [
  'const purchaseProduct = hasFull ? "premium_bundle" : "full_access"',
  'FULL_ACCESS_PRICE_KRW.toLocaleString("ko-KR")',
]) {
  if (!unmeiPriceCta.includes(required)) {
    problems.push(
      `src/components/uranai/UnmeiPriceCta.tsx: shared destiny offer lacks ${required}`,
    );
  }
}
if (unmeiPriceCta.includes('locale === "ja" && !hasFull')) {
  problems.push(
    "src/components/uranai/UnmeiPriceCta.tsx: Korean buyers still receive a different product tier",
  );
}

if (meResultPage.includes('isKorean || fullAccessPaid ? "premium_bundle"')) {
  problems.push(
    "src/components/result/MeResultPage.tsx: Korean destiny upsell still skips full_access",
  );
}

const entitlements = fs.readFileSync(
  path.join(ROOT, "src/lib/entitlements.ts"),
  "utf8",
);
if (entitlements.includes('preferred_locale !== "ko"')) {
  problems.push(
    "src/lib/entitlements.ts: legacy full-plan destiny access still excludes Korean users",
  );
}

const selfReportPrint = fs.readFileSync(
  path.join(ROOT, "src/app/report/[token]/print/page.tsx"),
  "utf8",
);
for (const required of [
  "const KO_STORY_PAGE_COUNT = 15",
  "const KO_STORY_THEMES = [",
  "const KO_STORY_ART = [",
  "buildKoStoryPages(report)",
  'reportLabel={isKo ? "16-PAGE STORY REPORT"',
]) {
  if (!selfReportPrint.includes(required)) {
    problems.push(
      `src/app/report/[token]/print/page.tsx: Korean 16-page story parity lacks ${required}`,
    );
  }
}

const selfReportPdf = fs.readFileSync(
  path.join(ROOT, "src/app/report/[token]/pdf/route.ts"),
  "utf8",
);
for (const required of [
  "나의 사용설명서 성격 스토리.pdf",
  'pageRanges: isKo ? "1-16" : undefined',
]) {
  if (!selfReportPdf.includes(required)) {
    problems.push(
      `src/app/report/[token]/pdf/route.ts: Korean 16-page PDF delivery lacks ${required}`,
    );
  }
}

if (problems.length) {
  console.error(JSON.stringify({ problems }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ problems: [] }, null, 2));
