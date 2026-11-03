import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { newLoginCode, normalizeLoginEmail, validLoginCodeInput, loginCodeToken } from "../src/lib/login-code.ts";
import { renderLoginEmailHtml } from "../src/lib/login-email.ts";
const pair = newLoginCode();
assert.match(pair.code, /^\d{6}$/);
assert.ok(validLoginCodeInput(pair.challenge, pair.code));
assert.equal(validLoginCodeInput(pair.challenge, "12345"), false);
assert.equal(validLoginCodeInput("bad", "123456"), false);
assert.equal(normalizeLoginEmail(" Member@Example.Test "), "member@example.test");
assert.equal(normalizeLoginEmail("bad"), null);
const token = loginCodeToken("member@example.test", pair.challenge, pair.code, "test-secret");
assert.match(token, /^otp_[a-f0-9]{64}$/);
assert.notEqual(token, loginCodeToken("other@example.test", pair.challenge, pair.code, "test-secret"));
assert.notEqual(token, loginCodeToken("member@example.test", newLoginCode().challenge, pair.code, "test-secret"));
assert.throws(()=>loginCodeToken("a", "b", "123456", ""));
for (const locale of ["ja", "en", "ko", "id"]) {
 const html=renderLoginEmailHtml("https://example.com/?a=1&b=2",locale,{code:"012345",kind:"login"});
 assert.ok(html.includes("012345")); assert.ok(html.includes("10")); assert.ok(html.includes("&amp;b=2"));
 const welcome=renderLoginEmailHtml("https://example.com/diagnosis",locale,{kind:"welcome"});
 assert.ok(!welcome.includes("012345")); assert.ok(welcome.includes("/diagnosis"));
}
assert.throws(()=>renderLoginEmailHtml("https://example.com", "ja", {code:"<evil>"}));
// Compile only the local mock, avoiding app aliases and any remote services.
let source=await readFile(new URL("../src/lib/login-mail-preview.ts",import.meta.url),"utf8");
source=source.replace('"./login-code"',JSON.stringify(new URL("../src/lib/login-code.ts",import.meta.url).href));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const mock=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const oldNow=Date.now; let now=oldNow(); Date.now=()=>now;
const oldEnv=process.env.NODE_ENV; process.env.NODE_ENV="development";
try {
 const m=mock.issuePreviewMail("member@example.test"); assert.ok(m.code);
 assert.equal(mock.issuePreviewMail(m.email),null);
 const wrong=m.code==="000000"?"999999":"000000";
 for(let i=0;i<5;i++) assert.equal(mock.verifyPreviewCode(m.id,wrong),null);
 assert.equal(mock.verifyPreviewCode(m.id,m.code),null);
 now+=61000;
 const fresh=mock.issuePreviewMail(m.email); assert.ok(fresh);
 assert.equal(mock.consumePreviewLink(m.token),false);
 assert.equal(mock.consumePreviewLink(fresh.token),true);
 assert.equal(mock.verifyPreviewCode(fresh.id,fresh.code),null);
 const another=mock.issuePreviewMail("another@example.test");
 assert.ok(mock.verifyPreviewCode(another.id,another.code));
 assert.equal(mock.consumePreviewLink(another.token),false);
 const expired=mock.issuePreviewMail("expired@example.test"); now+=600001;
 assert.equal(mock.verifyPreviewCode(expired.id,expired.code),null);
 const unknown=mock.issuePreviewMail("new@example.test"); assert.equal(unknown.code,null);
 assert.equal(mock.verifyPreviewCode(unknown.id,"123456"),null);
 process.env.NODE_ENV="production";
 assert.deepEqual(mock.previewMails(),[]);
 assert.equal(mock.isLoginMailPreview(new Request("http://127.0.0.1:3000")),false);
} finally { Date.now=oldNow; process.env.NODE_ENV=oldEnv; }
console.log("Login code checks passed: 6 digits, keyed digest, expiry, attempt limit, resend, one-time code/link, unknown-email mail and production preview isolation.");
