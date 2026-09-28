// No network calls or real Kakao messages. Run: node scripts/kakao-share-test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function moduleUrl(path, replacements = {}) {
  let source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  for (const [specifier, url] of Object.entries(replacements)) {
    source = source.replaceAll(`"${specifier}"`, `"${url}"`);
  }
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}

const kakaoModule = await import(moduleUrl("../src/lib/kakao-share.ts", {
  "./acquisition-link": moduleUrl("../src/lib/acquisition-link.ts"),
  "./og-images": moduleUrl("../src/lib/og-images.ts"),
}));
const { shareToKakaoTalk, kakaoShareFeedback, kakaoShareMetadata } = kakaoModule;
const originalKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const url = "https://www.watashi-torisetsu.com/ko/friend/test-invite?ref=kakao&campaign=friend#start";
const args = { url, text: kakaoModule.KO_FRIEND_INVITE_TEXT };
let passed = 0;

async function check(name, fn) {
  delete globalThis.window;
  Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
  delete process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  await fn();
  console.log(`PASS ${name}`);
  passed++;
}

try {
  await check("initialized SDK opens synchronously and preserves the invitation URL", async () => {
    let payload;
    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY = "test-key";
    globalThis.window = { Kakao: { init() {}, isInitialized: () => true,
      Share: { sendDefault: value => { payload = value; } } } };
    const result = shareToKakaoTalk(args);
    assert.ok(payload, "must call SDK before yielding the click handler");
    assert.equal(await result, "kakao");
    assert.equal(payload.objectType, "feed");
    assert.equal(payload.content.link.webUrl, url);
    assert.equal(payload.buttons[0].link.mobileWebUrl, url);
    assert.equal(payload.content.imageUrl, "https://www.watashi-torisetsu.com/ogp-ko-v1.jpg");
    assert.equal(payload.buttons[0].title, "친구 진단 시작하기");
  });
  await check("self-diagnosis sharing retains the text-only template", async () => {
    let payload;
    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY = "test-key";
    globalThis.window = { Kakao: { init() {}, isInitialized: () => true,
      Share: { sendDefault: value => { payload = value; } } } };
    await shareToKakaoTalk({ url: "https://www.watashi-torisetsu.com/ko/diagnosis", text: "link only" });
    assert.equal(payload.objectType, "text");
    assert.equal(payload.text, "link only");
  });
  await check("missing key immediately opens native sharing with native attribution", async () => {
    let payload;
    navigator.share = value => { payload = value; return Promise.resolve(); };
    const result = shareToKakaoTalk({ text: url, url });
    assert.ok(payload, "native share must retain click activation");
    assert.equal(await result, "native");
    const sharedUrl = new URL(payload.url);
    assert.equal(sharedUrl.searchParams.get("ref"), "native");
    assert.equal(sharedUrl.searchParams.get("campaign"), "friend");
    assert.equal(sharedUrl.hash, "#start");
    assert.equal(payload.text, payload.url);
  });
  await check("cold SDK does not block native sharing on script loading", async () => {
    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY = "test-key";
    globalThis.window = {};
    let called = false;
    navigator.share = () => { called = true; return Promise.resolve(); };
    const result = shareToKakaoTalk(args);
    assert.equal(called, true);
    assert.equal(await result, "native");
  });
  await check("native cancellation does not copy or show an error", async () => {
    navigator.share = () => Promise.reject(new DOMException("cancel", "AbortError"));
    let copied = false;
    const result = await shareToKakaoTalk({ ...args, fallbackCopy: () => { copied = true; return true; } });
    assert.equal(result, "cancelled");
    assert.equal(copied, false);
    assert.equal(kakaoShareFeedback(result), "");
  });
  await check("SDK errors fall back to copy with copy attribution", async () => {
    process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY = "test-key";
    globalThis.window = { Kakao: { init() {}, isInitialized: () => true,
      Share: { sendDefault() { throw Error("unregistered domain"); } } } };
    let copiedUrl;
    const result = await shareToKakaoTalk({ ...args, fallbackCopy: value => { copiedUrl = value; return true; } });
    assert.equal(result, "copy");
    assert.equal(new URL(copiedUrl).searchParams.get("ref"), "copy");
    assert.equal(new URL(copiedUrl).pathname, "/ko/friend/test-invite");
    assert.match(kakaoShareFeedback(result), /붙여 넣어/);
  });
  await check("clipboard rejection returns actionable unavailable feedback", async () => {
    const result = await shareToKakaoTalk({ ...args, fallbackCopy: () => Promise.reject(Error("denied")) });
    assert.equal(result, "unavailable");
    assert.match(kakaoShareFeedback(result), /QR/);
  });
  await check("unavailable sharing never claims delivery", async () => {
    assert.equal(await shareToKakaoTalk(args), "unavailable");
    assert.equal(kakaoShareMetadata("kakao").share_status, "requested");
    assert.equal(kakaoShareMetadata("copy").share_method, "copy");
    assert.equal(kakaoShareMetadata("native").requested_channel, "kakao");
  });
  console.log(`${passed} Kakao share regression checks passed.`);
} finally {
  delete globalThis.window;
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete globalThis.navigator;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  else process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY = originalKey;
}
