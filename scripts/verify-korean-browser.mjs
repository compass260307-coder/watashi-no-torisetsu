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
  "/ko/types",
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
          lang: document.documentElement.lang,
          hasKoLangContainer: Boolean(document.querySelector('[lang="ko"]')),
          hasLoginCopy: bodyText.includes("로그인"),
          hasKoreanBottomNav: Boolean(bottomNav),
          rawJapaneseRouteHrefs: rawJapaneseRouteAnchors.map((a) => ({
            href: a.getAttribute("href"),
            text: a.textContent?.trim().slice(0, 80) ?? "",
          })),
          hasQrInviteCopy: bodyText.includes("친구 진단 초대 QR 코드"),
          overflowX:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      const routeLabel = `${viewport.name} ${route}`;
      results.push({
        viewport: viewport.name,
        route,
        status,
        ...state,
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
      if (viewport.name === "mobile" && !state.hasKoreanBottomNav) {
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
