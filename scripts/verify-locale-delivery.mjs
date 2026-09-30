// Run against a local production build: node scripts/verify-locale-delivery.mjs
// No analytics, checkout, or database requests leave the browser.
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3036").origin;
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname), "Use a local production server");
const locales = {
  ja: { prefix: "", price: "499", question: "グループで意見が割れたとき、自分の考えをはっきり伝える方だ。" },
  en: { prefix: "/en", price: "4.99", question: "When opinions differ in a group, I clearly express what I think.", marker: "The friend test is still locked" },
  ko: { prefix: "/ko", price: "4,900", question: "그룹에서 의견이 갈릴 때 내 생각을 분명하게 말하는 편이다.", marker: "친구 진단은 아직 잠겨 있어요" },
  id: { prefix: "/id", price: "49.000", question: "Saat pendapat dalam kelompok berbeda, saya menyampaikan pikiran saya dengan jelas.", marker: "Tes teman masih terkunci" },
};
const routes = Object.entries(locales).flatMap(([locale, copy]) => [
  { locale, path: copy.prefix || "/", paywall: true },
  { locale, path: `${copy.prefix}/diagnosis`, diagnosis: true },
]);
routes.push({ locale: "ja", path: "/preview/ambition-lion__N" });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  for (const route of routes) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      const scripts = new Map();
      const pending = [];
      const errors = [];
      const failures = [];
      const extraJs = [];
      let blockNewJavaScript = false;
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin !== origin) return;
        if (response.status() >= 400) failures.push(`${url.pathname}: ${response.status()}`);
        if (url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js")) {
          pending.push(response.text().then((body) => scripts.set(url.pathname, body)));
        }
      });
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) {
          return request.respond({ status: 204 });
        }
        if (url.pathname.startsWith("/api/")) {
          return request.respond({ status: 200, contentType: "application/json", body: "{}" });
        }
        if (blockNewJavaScript && url.pathname.endsWith(".js")) {
          extraJs.push(url.pathname);
          return request.respond({ status: 404, body: "Blocked by eager payment regression check" });
        }
        return request.continue();
      });
      const response = await page.goto(origin + route.path, { waitUntil: "networkidle0" });
      assert.equal(response.status(), 200, route.path);
      await Promise.all(pending);
      const source = [...scripts.values()].join("\n");
      assert(source.includes("/api/checkout/create-full-access-session"), `${route.path}: checkout code must be eager`);
      for (const [locale, copy] of Object.entries(locales)) {
        if (locale === "ja" || locale === route.locale) continue;
        assert(!source.includes(copy.marker), `${route.path}: unexpected ${locale} UI dictionary`);
        assert(!source.includes(copy.question), `${route.path}: unexpected ${locale} diagnosis dictionary`);
      }
      if (route.diagnosis) {
        const body = await page.$eval("main", (element) => element.innerText);
        assert(body.includes(locales[route.locale].question), `${route.path}: localized first question is missing`);
      }
      if (route.paywall) {
        blockNewJavaScript = true;
        const clicked = await page.evaluate(() => {
          const button = [...document.querySelectorAll("header button")]
            .find((element) => element.textContent.includes("Alice") && element.getClientRects().length);
          button?.click();
          return Boolean(button);
        });
        assert(clicked, `${route.path}: purchase entry is missing`);
        await page.waitForSelector('[role="dialog"]');
        const dialog = await page.$eval('[role="dialog"]', (element) => element.innerText);
        assert(dialog.includes(locales[route.locale].price), `${route.path}: incorrect payment price`);
        assert.deepEqual(extraJs, [], `${route.path}: opening payment must not request JavaScript`);
        await page.keyboard.press("Escape");
        assert.equal(await page.$('[role="dialog"]'), null);
      }
      assert.deepEqual(errors, [], `${route.path}: browser errors`);
      assert.deepEqual(failures, [], `${route.path}: failed responses`);
      console.log(JSON.stringify({
        path: route.path,
        scriptCount: scripts.size,
        decodedJsBytes: [...scripts.values()].reduce((total, text) => total + Buffer.byteLength(text), 0),
        paywallOpenedWithoutExtraJs: Boolean(route.paywall),
      }));

      // Ensure the new Suspense boundary did not turn the page into an empty
      // client-rendered shell. Check the actual visible body with JS disabled.
      await page.setJavaScriptEnabled(false);
      await page.reload({ waitUntil: "domcontentloaded" });
      const serverBody = await page.$eval("main", (element) => element.innerText);
      assert(serverBody.length > 100, `${route.path}: server-rendered content is missing`);
    } finally {
      await context.close();
    }
  }
  console.log("Locale delivery and eager payment checks passed (9 routes, 4 languages).");
} finally {
  await browser.close();
}
