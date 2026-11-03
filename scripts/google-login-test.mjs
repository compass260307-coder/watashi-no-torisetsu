import assert from "node:assert/strict";
import { googleAuthorizationUrl, googleVerifiedEmail, googleRequestOrigin, newGoogleFlow, readGoogleFlow } from "../src/lib/google-login.ts";

const flow = newGoogleFlow();
assert.ok(readGoogleFlow(JSON.stringify(flow), flow.state));
assert.equal(readGoogleFlow(JSON.stringify(flow), "wrong"), null);
assert.equal(readGoogleFlow(JSON.stringify({ ...flow, expires: 0 }), flow.state), null);
assert.equal(readGoogleFlow("invalid", flow.state), null);
assert.equal(readGoogleFlow(undefined, flow.state), null);
assert.equal(googleRequestOrigin(new Request("http://localhost:3000/api/auth/google", {
  headers: { host: "127.0.0.1:3000" },
})), "http://127.0.0.1:3000");
const url = googleAuthorizationUrl("test", "http://127.0.0.1:3000/api/auth/google/callback", flow);
assert.equal(url.origin, "https://accounts.google.com");
assert.equal(url.searchParams.get("code_challenge_method"), "S256");
assert.equal(url.searchParams.get("code_challenge")?.length, 43);
assert.equal(url.searchParams.get("state"), flow.state);
assert.equal(url.searchParams.get("nonce"), flow.nonce);
assert.equal(url.searchParams.get("scope"), "openid email");
const claims = { sub: "test", email: "Example@gmail.com", email_verified: true, nonce: flow.nonce };
assert.equal(googleVerifiedEmail(claims, flow.nonce), "example@gmail.com");
assert.equal(googleVerifiedEmail({ ...claims, email_verified: false }, flow.nonce), null);
assert.equal(googleVerifiedEmail(claims, "wrong"), null);
assert.equal(googleVerifiedEmail({ ...claims, sub: undefined }, flow.nonce), null);
assert.equal(googleVerifiedEmail({ ...claims, email: "test@example.com" }, flow.nonce), null);
assert.equal(googleVerifiedEmail({ ...claims, email: "test@example.com", hd: "example.com" }, flow.nonce), "test@example.com");
console.log("Google login checks passed: state, expiry, PKCE, nonce, email authority and local origin.");

const { resolveGoogleLoginAccount } = await import("../src/lib/google-login-account.ts");
const operations = [];
const store = {
  async findByEmail() { return null; },
  async claimAnonymous(id) { operations.push("claim"); return { id }; },
  async create() { operations.push("create"); return { id: "new" }; },
};
assert.deepEqual(await resolveGoogleLoginAccount("test@gmail.com", null, store), { id: "new" });
assert.deepEqual(operations.splice(0), ["create"]);
assert.deepEqual(await resolveGoogleLoginAccount("test@gmail.com", { id: "diagnosed", email: null }, store), { id: "diagnosed" });
assert.deepEqual(operations.splice(0), ["claim"]);
assert.deepEqual(await resolveGoogleLoginAccount("test@gmail.com", { id: "other", email: "other@gmail.com" }, store), { id: "new" });
assert.deepEqual(operations.splice(0), ["create"]);
assert.deepEqual(await resolveGoogleLoginAccount("test@gmail.com", { id: "anonymous", email: null }, {
  ...store, async findByEmail() { return { id: "purchased" }; },
}), { id: "purchased" });
assert.deepEqual(operations, []);
await assert.rejects(resolveGoogleLoginAccount("test@gmail.com", { id: "race", email: null }, {
  ...store, async claimAnonymous() { return null; },
}));
await assert.rejects(resolveGoogleLoginAccount("test@gmail.com", null, {
  ...store, async findByEmail() { throw new Error("database unavailable"); },
}));
assert.deepEqual(operations, []);
console.log("Account resolution checks passed: new user, anonymous result, existing purchase, different account and race/failure protection.");

const { requestOrigin } = await import("../src/lib/request-origin.ts");
for (const host of ["127.0.0.1:3000", "localhost:3000", "www.watashi-torisetsu.com"]) {
  const protocol = host.includes(":3000") ? "http:" : "https:";
  const req = new Request(`${protocol}//localhost/api/auth/verify-magic-link`, { headers: { host } });
  assert.equal(requestOrigin(req), `${protocol}//${host}`);
  assert.equal(requestOrigin(req), googleRequestOrigin(req));
}
console.log("Session completion keeps the OAuth host for local and production origins.");

const { loginRecoveryPath, loginNotice } = await import("../src/lib/login-recovery.ts");
for (const locale of ["ja", "en", "ko", "id"]) {
  const prefix = locale === "ja" ? "" : `/${locale}`;
  assert.equal(loginRecoveryPath(locale, `${prefix}/me/example`, { google_error: "cancelled" }),
    `${prefix}/me/example?login=1&login_error=cancelled`);
  assert.equal(loginRecoveryPath(locale, `${prefix}/diagnosis`, { login_error: "invalid_or_expired" }),
    `${prefix}/diagnosis?login=1&login_error=invalid_or_expired`);
  assert.equal(loginRecoveryPath(locale, `${prefix}/me/example`, { google_error: "untrusted" }),
    `${prefix}/me/example?login=1`);
  assert.ok(loginNotice(locale, "invalid_or_expired"));
}
assert.equal(loginNotice("ja", "__proto__"), undefined);
console.log("Recovery checks passed: result-first routing, undiagnosed fallback, locales and allowed notices.");
