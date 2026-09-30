// Run against a local production build, never next dev (which disables caching).
// node scripts/verify-background-cache.mjs http://127.0.0.1:3036
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:3036").origin;
assert(["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname), "Use a local production server");
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

try {
  for (const javaScriptEnabled of [true, false]) {
    // The shared JA/EN/ID component and separate KO component also work without JS.
    const routes = javaScriptEnabled ? ["/", "/en", "/ko", "/id"] : ["/", "/ko"];
    for (const width of [390, 1440]) {
      for (const route of routes) {
        const context = await browser.createBrowserContext();
        try {
          const visits = [];
          for (const revisit of [false, true]) {
            // A new tab prevents a back/forward page snapshot from masquerading
            // as reuse of the browser's actual image cache.
            const page = await context.newPage();
            await page.setViewport({ width, height: 1000 });
            await page.setJavaScriptEnabled(javaScriptEnabled);
            const images = [];
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("response", (response) => {
              if (!response.url().includes("keyvisual")) return;
              images.push({
                url: response.url(),
                status: response.status(),
                cached: response.fromCache(),
                cacheControl: response.headers()["cache-control"],
              });
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
              return request.continue();
            });
            await page.setCacheEnabled(true);
            const response = await page.goto(origin + route, { waitUntil: "networkidle0" });
            // HTML can revalidate independently of the immutable background.
            assert(revisit ? [200, 304].includes(response.status()) : response.status() === 200);
            const rendered = await page.evaluate(() => {
              const hero = document.querySelector(".top-hero-bg");
              const background = getComputedStyle(hero).backgroundImage;
              const preload = [...document.querySelectorAll('link[rel="preload"][as="image"]')]
                .filter((link) => link.href.includes("keyvisual") && matchMedia(link.media).matches)
                .map((link) => link.href);
              const resources = performance.getEntriesByType("resource")
                .filter((entry) => entry.name.includes("keyvisual"))
                .map((entry) => ({ url: entry.name, transferSize: entry.transferSize, bytes: entry.decodedBodySize }));
              return { background, preload, resources };
            });
            const label = `${route} ${width}px JS=${javaScriptEnabled} revisit=${revisit}`;
            assert.equal(images.length, 1, `${label}: preload and CSS must fetch only one selected image`);
            const image = images[0];
            const prefix = width < 640 ? "keyvisual-mobile." : "keyvisual.";
            assert(new URL(image.url).pathname.startsWith(`/_next/static/media/${prefix}`), `${label}: missing content hash`);
            assert.equal(image.status, 200, label);
            assert.match(image.cacheControl, /max-age=31536000/, label);
            assert.match(image.cacheControl, /immutable/, label);
            assert.equal(image.cached, revisit, `${label}: unexpected browser cache behavior`);
            // React can hoist identical link elements during streamed hydration;
            // their URL must agree, and the actual request count above stays one.
            assert.deepEqual([...new Set(rendered.preload)], [image.url], `${label}: preload mismatch`);
            assert.equal(rendered.background, `url("${image.url}")`, `${label}: background mismatch`);
            assert.equal(rendered.resources.length, 1, label);
            assert(rendered.resources[0].bytes > 0, `${label}: empty image`);
            if (revisit) assert.equal(rendered.resources[0].transferSize, 0, `${label}: revisit transferred image data`);
            assert.deepEqual(errors, [], `${label}: browser errors`);
            visits.push({ cached: image.cached, ...rendered.resources[0] });
            await page.close();
          }
          console.log(JSON.stringify({ route, width, javaScriptEnabled, visits }));
        } finally {
          await context.close();
        }
      }
    }
  }
  console.log("Background cache checks passed: 4 languages, desktop/mobile, repeat visits, and server rendering.");
} finally {
  await browser.close();
}
