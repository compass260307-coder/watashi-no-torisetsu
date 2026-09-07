import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE_URL = (
  process.env.KO_VERIFY_BASE_URL ?? "https://www.watashi-torisetsu.com"
).replace(/\/+$/, "");
const OUTPUT_DIR =
  process.env.KO_VERIFY_SCREENSHOT_DIR ??
  path.join(os.tmpdir(), "watashi-ko-browser-qa");
const CHROME_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const ROUTES = [
  "/ko",
  "/ko/login",
  "/ko/diagnosis",
  "/ko/tako",
  "/ko/aisho",
  "/ko/unmei",
  "/ko/hoshiyomi",
  "/ko/tarot",
  "/ko/tarot/one",
  "/ko/types",
  "/ko/privacy",
  "/ko/terms",
  "/ko/legal/commerce",
  "/ko/articles/tako-bunseki",
  "/ko/tako/preview?previewLocked=1&fromPreview=1&friends=1",
  "/ko/tako/preview/friend/preview-friend?previewType=sparkle-dolphin__N&fromPreview=1",
  "/ko/evaluate/result/preview?previewType=sparkle-dolphin__N&fromPreview=1",
  "/ko/me/preview?previewType=sparkle-dolphin__N&fromPreview=1",
  "/ko/preview/sparkle-dolphin__N",
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1200 },
  { name: "mobile", width: 390, height: 844 },
];

function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

if (!fs.existsSync(CHROME_PATH)) {
  console.error(
    JSON.stringify(
      {
        problems: [
          `Chrome executable was not found: ${CHROME_PATH}. Set PUPPETEER_EXECUTABLE_PATH.`,
        ],
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: "new",
  args: [
    "--lang=ko-KR",
    "--no-first-run",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ],
});

const results = [];
const problems = [];

try {
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const page = await browser.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const requestFailures = [];

      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        const failure = request.failure();
        requestFailures.push({
          url: request.url(),
          errorText: failure?.errorText ?? "unknown",
        });
      });

      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.name === "mobile" ? 2 : 1,
        isMobile: viewport.name === "mobile",
      });
      await page.setExtraHTTPHeaders({
        "accept-language": "ko-KR,ko;q=0.9,ja;q=0.5,en;q=0.3",
      });

      if (viewport.name === "mobile" && ["/ko", "/ko/types"].includes(route)) {
        // localStorage を確実に対象originへ保存してから検証ルートを開く。
        await page.goto(`${BASE_URL}/ko`, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        await page.evaluate((fixtureRoute) => {
          const ownerKey = "torisetsu_owner_token";
          const friendKey = "wt_tako_attention_pending_owner_v1";
          const destinyKey = "wt_unmei_attention_pending_owner_v1";
          const selfKey = "wt_me_attention_pending_v1";
          for (const key of [ownerKey, friendKey, destinyKey, selfKey]) {
            localStorage.removeItem(key);
          }
          if (fixtureRoute === "/ko") {
            localStorage.setItem(selfKey, "1");
          } else {
            const token = "ko-browser-notification-fixture";
            localStorage.setItem(ownerKey, token);
            localStorage.setItem(friendKey, token);
            localStorage.setItem(destinyKey, token);
          }
        }, route);
      }

      const url = `${BASE_URL}${route}`;
      const response = await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 45000,
      });
      const status = response?.status() ?? 0;
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${viewport.name}${slug(route)}.png`),
        fullPage: false,
      });

      const state = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const bottomNav = document.querySelector(
          'nav[aria-label="전역 내비게이션"]',
        );
        const rawJapaneseRouteAnchors = [
          ...document.querySelectorAll('a[href="/diagnosis"], a[href="/tako"]'),
        ].filter((a) => !a.textContent?.includes("日本語"));
        return {
          pathname: window.location.pathname,
          lang: document.documentElement.lang,
          hasKoLangContainer: Boolean(document.querySelector('[lang="ko"]')),
          hasLoginCopy: bodyText.includes("로그인"),
          hasKoreanBottomNav: Boolean(bottomNav),
          rawJapaneseRouteHrefs: rawJapaneseRouteAnchors.map((a) => ({
            href: a.getAttribute("href"),
            text: a.textContent?.trim().slice(0, 80) ?? "",
          })),
          hasQrInviteCopy: bodyText.includes("친구 진단 초대 QR 코드"),
          hasKoreanFriendProof:
            bodyText.includes("1,458명 이상") &&
            bodyText.includes("의 친구가 친구 진단에 답했어요"),
          hasKoreanUnmeiPromo:
            bodyText.includes("운명의 설계도") &&
            Boolean(document.querySelector('a[href="/ko/unmei"]')),
          hasKoreanTarotLanding:
            bodyText.includes("Alice와 타로") &&
            Boolean(document.querySelector('a[href="/ko/tarot/one"]')),
          hasKoreanTarotDraw:
            bodyText.includes("오늘의 한 장") &&
            bodyText.includes("카드 섞기"),
          hasKoreanHoshiyomiHome:
            bodyText.includes("별자리 상담사와 대화하기") &&
            Boolean(document.querySelector('input[placeholder="지금 무엇이 마음에 걸리나요?"]')),
          notificationLabels: [
            ...document.querySelectorAll('[data-notification-badge="true"]'),
          ].map((badge) => badge.closest("a")?.textContent?.trim() ?? ""),
          hasResetAction: [...document.querySelectorAll("header button")].some(
            (button) => button.textContent?.includes("데이터 초기화"),
          ),
          hasLoginModalTrigger: [...document.querySelectorAll("header button")].some(
            (button) => button.textContent?.trim() === "로그인",
          ),
          footerArticleHrefs: [
            ...document.querySelectorAll('footer a[href^="/ko/articles/"]'),
          ].map((anchor) => anchor.getAttribute("href")),
          hasTakoFooterLink: Boolean(
            document.querySelector('footer a[href="/ko/articles/tako-bunseki"]'),
          ),
          hasKoreanTakoArticle:
            bodyText.includes(
              "타인 분석은 어떻게 할까? 자기 분석만으로는 알 수 없는 ‘나’를 발견하는 법",
            ) && bodyText.includes("타인 분석 방법 3단계"),
          hasKoreanFriendIndividual:
            bodyText.includes("관점 일치도") &&
            bodyText.includes("친구들이 본 나로 돌아가기"),
          hasKoreanEvaluationResult:
            bodyText.includes("관점 일치도") &&
            bodyText.includes("사용설명서로 돌아가기") &&
            !bodyText.includes("친구들이 본 나로 돌아가기"),
          hasKoreanPrivacyDetails:
            bodyText.includes(
              "개인정보처리자: 후타미 류노스케(나의 사용설명서 운영팀)",
            ) &&
            bodyText.includes("국외 이전") &&
            bodyText.includes("Meta Platforms, Inc.") &&
            bodyText.includes("처리정지"),
          hasKoreanTermsDetails:
            bodyText.includes("법정대리인의 동의 없이 체결한 유료 서비스 계약") &&
            bodyText.includes("시행 30일 전") &&
            bodyText.includes("운영자의 고의 또는 과실"),
          hasKoreanCommerceDetails:
            bodyText.includes("후타미 류노스케(나의 사용설명서 운영팀)") &&
            bodyText.includes("3영업일 이내에 Stripe를 통한 환불 절차") &&
            bodyText.includes("미성년자의 계약 취소"),
          hasKoreanPurchaseLegalNotice:
            bodyText.includes("구매 버튼을 누르면") &&
            bodyText.includes("미성년자는 법정대리인의 동의를 받아야 하며") &&
            Boolean(document.querySelector('a[href="/ko/legal/commerce"]')),
          footerSocialHrefs: [
            ...document.querySelectorAll(
              'footer a[href*="instagram.com"], footer a[href*="x.com/"], footer a[href*="tiktok.com"]',
            ),
          ].map((anchor) => anchor.getAttribute("href")),
          overflowX:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      let hasKoreanLoginModal = false;
      if (route === "/ko") {
        if (viewport.name === "mobile") {
          await page.click('button[aria-label="메뉴 열기"]');
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
        const clickedLogin = await page.evaluate(() => {
          const buttons = [...document.querySelectorAll("header button")];
          const target = buttons.find((button) => {
            const box = button.getBoundingClientRect();
            return (
              button.textContent?.trim() === "로그인" &&
              box.width > 0 &&
              box.height > 0
            );
          });
          if (!target) return false;
          target.click();
          return true;
        });
        if (clickedLogin) {
          try {
            await page.waitForSelector('[role="dialog"][aria-label="로그인"]', {
              timeout: 3000,
            });
            hasKoreanLoginModal = await page.evaluate(() => {
              const dialog = document.querySelector(
                '[role="dialog"][aria-label="로그인"]',
              );
              return Boolean(
                dialog?.textContent?.includes("로그인 링크 받기") &&
                  dialog?.textContent?.includes("이메일 주소"),
              );
            });
            await page.keyboard.press("Escape");
          } catch {
            hasKoreanLoginModal = false;
          }
        }
      }

      let hasKoreanPurchaseLegalNotice =
        state.hasKoreanPurchaseLegalNotice;
      if (
        route.startsWith("/ko/me/preview?") &&
        !hasKoreanPurchaseLegalNotice
      ) {
        const clickedUpgrade = await page.evaluate(() => {
          const controls = [...document.querySelectorAll("a, button")];
          const target = controls.find((control) => {
            const box = control.getBoundingClientRect();
            return (
              control.textContent?.includes("결과 업그레이드") &&
              box.width > 0 &&
              box.height > 0
            );
          });
          if (!target) return false;
          target.click();
          return true;
        });
        if (clickedUpgrade) {
          try {
            await page.waitForSelector('[role="dialog"][aria-label="잠금 해제"]', {
              timeout: 3000,
            });
            hasKoreanPurchaseLegalNotice = await page.evaluate(() => {
              const dialog = document.querySelector(
                '[role="dialog"][aria-label="잠금 해제"]',
              );
              return Boolean(
                dialog?.textContent?.includes("구매 버튼을 누르면") &&
                  dialog?.textContent?.includes(
                    "미성년자는 법정대리인의 동의를 받아야 하며",
                  ) &&
                  dialog.querySelector('a[href="/ko/legal/commerce"]'),
              );
            });
            await page.keyboard.press("Escape");
          } catch {
            hasKoreanPurchaseLegalNotice = false;
          }
        }
      }

      const routeLabel = `${viewport.name} ${route}`;
      results.push({
        viewport: viewport.name,
        route,
        status,
        ...state,
        hasKoreanPurchaseLegalNotice,
        hasKoreanLoginModal,
        rawJapaneseRouteHrefCount: state.rawJapaneseRouteHrefs.length,
        consoleErrorCount: consoleErrors.length,
        pageErrorCount: pageErrors.length,
        requestFailureCount: requestFailures.length,
      });

      if (status < 200 || status >= 400) {
        problems.push(`${routeLabel}: expected 2xx/3xx, got ${status}`);
      }
      if (state.lang !== "ko") {
        problems.push(`${routeLabel}: documentElement.lang is ${state.lang}`);
      }
      if (!state.hasKoLangContainer) {
        problems.push(`${routeLabel}: missing lang=ko container`);
      }
      if (route === "/ko" && !state.hasLoginCopy) {
        problems.push(`${routeLabel}: missing Korean login copy`);
      }
      if (route === "/ko" && !state.hasLoginModalTrigger) {
        problems.push(`${routeLabel}: Korean login is not a modal trigger`);
      }
      if (route === "/ko" && !hasKoreanLoginModal) {
        problems.push(`${routeLabel}: Korean login modal did not open`);
      }
      if (route === "/ko" && !state.hasResetAction) {
        problems.push(`${routeLabel}: missing Korean data reset action`);
      }
      if (route === "/ko" && state.footerArticleHrefs.length < 4) {
        problems.push(`${routeLabel}: missing direct Korean article links`);
      }
      if (route === "/ko" && !state.hasTakoFooterLink) {
        problems.push(`${routeLabel}: missing direct Korean tako-bunseki footer link`);
      }
      if (
        route === "/ko/articles/tako-bunseki" &&
        !state.hasKoreanTakoArticle
      ) {
        problems.push(`${routeLabel}: Korean tako-bunseki article copy is missing`);
      }
      if (
        route.startsWith("/ko/tako/preview/friend/") &&
        (!state.hasKoreanFriendIndividual ||
          state.pathname !== "/ko/tako/preview/friend/preview-friend")
      ) {
        problems.push(`${routeLabel}: Korean friend detail did not render on its dedicated route`);
      }
      if (
        route.startsWith("/ko/evaluate/result/preview?") &&
        (!state.hasKoreanEvaluationResult ||
          state.pathname !== "/ko/evaluate/result/preview")
      ) {
        problems.push(
          `${routeLabel}: Korean evaluation result did not render the evaluate variant on its dedicated route`,
        );
      }
      if (route === "/ko/privacy" && !state.hasKoreanPrivacyDetails) {
        problems.push(`${routeLabel}: Korean privacy disclosures are incomplete`);
      }
      if (route === "/ko/terms" && !state.hasKoreanTermsDetails) {
        problems.push(`${routeLabel}: Korean terms disclosures are incomplete`);
      }
      if (
        route === "/ko/legal/commerce" &&
        !state.hasKoreanCommerceDetails
      ) {
        problems.push(`${routeLabel}: Korean commerce disclosures are incomplete`);
      }
      if (route === "/ko" && state.footerSocialHrefs.length < 3) {
        problems.push(`${routeLabel}: missing Korean social links`);
      }
      if (
        viewport.name === "mobile" &&
        route === "/ko" &&
        !state.notificationLabels.some((label) => label.includes("자기 진단"))
      ) {
        problems.push(`${routeLabel}: missing Korean self-diagnosis notification badge`);
      }
      if (
        viewport.name === "mobile" &&
        route === "/ko/types" &&
        !state.notificationLabels.some((label) => label.includes("친구 진단"))
      ) {
        problems.push(`${routeLabel}: missing Korean friend/destiny notification badges`);
      }
      if (
        viewport.name === "mobile" &&
        !route.startsWith("/ko/evaluate/result/") &&
        !state.hasKoreanBottomNav
      ) {
        problems.push(`${routeLabel}: missing Korean bottom navigation`);
      }
      if (state.rawJapaneseRouteHrefs.length > 0) {
        problems.push(
          `${routeLabel}: contains raw Japanese route href ${JSON.stringify(
            state.rawJapaneseRouteHrefs,
          )}`,
        );
      }
      if (
        route === "/ko/preview/sparkle-dolphin__N" &&
        state.hasQrInviteCopy
      ) {
        problems.push(`${routeLabel}: self preview includes QR invite copy`);
      }
      if (
        route.startsWith("/ko/me/preview?") &&
        !state.hasKoreanUnmeiPromo
      ) {
        problems.push(`${routeLabel}: Korean unmei promo is missing or links outside /ko`);
      }
      if (route === "/ko/tarot" && !state.hasKoreanTarotLanding) {
        problems.push(`${routeLabel}: Korean tarot landing content or links are missing`);
      }
      if (route === "/ko/tarot/one" && !state.hasKoreanTarotDraw) {
        problems.push(`${routeLabel}: Korean tarot draw experience is missing`);
      }
      if (
        route === "/ko/hoshiyomi" &&
        (state.pathname !== "/ko/hoshiyomi" || !state.hasKoreanHoshiyomiHome)
      ) {
        problems.push(`${routeLabel}: Korean Alice home redirected or did not render`);
      }
      if (state.overflowX > 4) {
        problems.push(`${routeLabel}: horizontal overflow ${state.overflowX}px`);
      }
      if (consoleErrors.length > 0) {
        problems.push(
          `${routeLabel}: console errors: ${consoleErrors.slice(0, 3).join(" | ")}`,
        );
      }
      if (pageErrors.length > 0) {
        problems.push(
          `${routeLabel}: page errors: ${pageErrors.slice(0, 3).join(" | ")}`,
        );
      }
      const meaningfulFailures = requestFailures.filter(
        (failure) =>
          !failure.url.includes("_rsc=") &&
          !failure.url.includes("googletagmanager.com") &&
          !failure.url.includes("google-analytics.com") &&
          !failure.url.includes("analytics.google.com") &&
          !failure.url.includes("connect.facebook.net//log/error") &&
          !failure.url.includes("/rest/v1/events"),
      );
      if (meaningfulFailures.length > 0) {
        problems.push(
          `${routeLabel}: request failures: ${meaningfulFailures
            .slice(0, 3)
            .map((failure) => `${failure.errorText} ${failure.url}`)
            .join(" | ")}`,
        );
      }

      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(
  JSON.stringify(
    {
      baseUrl: BASE_URL,
      outputDir: OUTPUT_DIR,
      results,
      problems,
    },
    null,
    2,
  ),
);
if (problems.length > 0) process.exitCode = 1;
