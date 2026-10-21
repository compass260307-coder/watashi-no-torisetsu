import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server.js';

function compile(path, imports = {}, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { exports, console, Buffer, URL, URLSearchParams, Date,
    process: { env: {} }, require(name) { if (name in imports) return imports[name]; throw new Error(`Unexpected import: ${name}`); }, ...globals }, { filename: path });
  return exports;
}
const upgradeCopy = compile('src/i18n/result-upgrade.ts');
const policy = compile('src/lib/access-products.ts');
const result = compile('src/lib/result-upgrade.ts');
const dialogue = compile('src/lib/line-upgrade-dialogue.ts', { '@/i18n/result-upgrade': upgradeCopy, '@/lib/result-upgrade': result, '@/lib/access-products': policy });
const hashing = code => crypto.createHash('sha256').update(code).digest('hex');
let now = Date.now();
class Clock extends Date { static now() { return now; } }
const intent = compile('src/lib/line-upgrade-intent.ts', { 'node:crypto': crypto, '@/lib/line': { hashLineLinkCode: hashing } }, {
  Date: Clock, process: { env: { ALICE_TRANSFER_CODE_SECRET: 'isolated-signing-key' } },
});
const code = 'c'.repeat(32); const signed = intent.signLineUpgradeIntent(code);
assert(intent.verifyLineUpgradeIntent(code, signed));
assert(!intent.verifyLineUpgradeIntent('d'.repeat(32), signed));
assert(!intent.verifyLineUpgradeIntent(code, signed + 'x'));
assert(!intent.verifyLineUpgradeIntent(code, true));
now += 600_001; assert(!intent.verifyLineUpgradeIntent(code, signed)); now = Date.now();
console.log('PASS: upgrade intent is signed, expires, and cannot be added to another ordinary linking code.');

const clone = value => value == null ? value : structuredClone(value);
const eventId = (name, key) => hashing(`${name}:${key}`);
const quickReplies = (...labels) => ({ items: labels });
function conversation({ full = true, paid = false, initialRow = null } = {}) {
  let row = clone(initialRow); const events = new Map(); let failSave = false;
  function query(table) {
    let mode = 'select'; let value; const filters = new Map();
    function execute() {
      const matches = candidate => candidate && [...filters].every(([k,v]) => candidate[k] === v);
      if (table === 'events') {
        if (mode === 'insert' || mode === 'upsert') {
          if (mode === 'insert' && events.has(value.id)) return { error: { code: '23505' } };
          events.set(value.id, clone(value));return { data: clone(value), error: null };
        }
        const record = events.get(filters.get('id'));
        if (!record) return { data: null, error: null };
        if (mode === 'delete') { events.delete(record.id); return { error: null }; }
        if (mode === 'update') events.set(record.id, { ...record, ...clone(value) });
        return { data: clone(events.get(record.id)), error: null };
      }
      if (mode === 'insert') {
        if (row) return { error: { code: '23505' } };
        row = { ...clone(value), updated_at: new Date().toISOString() };return { data: clone(row), error: null };
      }
      if (mode === 'update') {
        if (failSave) return { data: null, error: { code: 'isolated_failure' } };
        if (!matches(row)) return { data: null, error: null };
        row = { ...row, ...clone(value) };return { data: clone(row), error: null };
      }
      return { data: clone(row), error: null };
    }
    const builder = {
      select() { return this; }, eq(key, val) { filters.set(key,val);return this; },
      insert(data) { mode='insert';value=data;return this; }, upsert(data) { mode='upsert';value=data;return this; },
      update(data) { mode='update';value=data;return this; }, delete() { mode='delete';return this; },
      maybeSingle: async () => execute(), then(resolve, reject) { return Promise.resolve().then(execute).then(resolve,reject); },
    };
    return builder;
  }
  const service = compile('src/lib/line-upgrade-chat.ts', {
    'server-only': {}, '@/lib/entitlements': { hasFullAccess: async () => full, hasPremiumBundleAccess: async () => paid },
    '@/lib/line-events': { deterministicLineEventId: eventId }, '@/lib/line': { quickReplies },
    '@/lib/line-result-upgrade': { buildLineResultUpgradeUrl: () => 'https://example.test/signed-purchase' },
    '@/lib/line-upgrade-dialogue': dialogue, '@/lib/result-upgrade': result,
    '@/lib/result-upgrade-server': { loadResultUpgradeForUser: async () => clone(row), resolveResultUpgradeBase: async () => ({ sourceTypeId: 'type', sourceCharacterPath: '/image.png' }) },
    '@/lib/supabase-server': { supabaseAdmin: { from: query } },
  });
  return { service, events, row: () => clone(row), failSave: value => { failSave=value; } };
}
const flow = conversation();
assert.equal(await flow.service.answerLineUpgradeChat({lineUserId:'line',userId:'owner',text:'普通の会話',messageId:'ordinary'}), null);
const first = await flow.service.startLineUpgradeChat('line','owner');
assert.match(first.at(-1).text, /質問 1\/5/); assert.equal(flow.row().answers.length,0);
assert.equal(await flow.service.answerLineUpgradeChat({lineUserId:'another-line',userId:'owner',text:'無関係',messageId:'other'}),null);
const a = {lineUserId:'line',userId:'owner',text:'散歩をする',messageId:'answer-1'};
assert.match((await flow.service.answerLineUpgradeChat(a))[0].text,/質問 2\/5/);
assert.equal((await flow.service.answerLineUpgradeChat(a)).length,0);assert.equal(flow.row().answers.length,1);
assert.match((await flow.service.startLineUpgradeChat('line','owner')).at(-1).text,/質問 2\/5/);
assert.match((await flow.service.answerLineUpgradeChat({...a,text:'x'.repeat(51),messageId:'long'}))[0].text,/50文字/);
assert.equal(flow.row().answers.length,1);
flow.failSave(true);
assert.match((await flow.service.answerLineUpgradeChat({...a,text:'読書',messageId:'recoverable'}))[0].text,/保存できなかった/);
flow.failSave(false);
assert.match((await flow.service.answerLineUpgradeChat({...a,text:'読書',messageId:'recoverable'}))[0].text,/質問 3\/5/);
for (const [i,text] of ['落ち着いている','お互いを尊重する','好きな仕事を続ける'].entries()) {
 const messages=await flow.service.answerLineUpgradeChat({...a,text,messageId:`remaining-${i}`});
 if (i<2) assert.match(messages[0].text,new RegExp(`質問 ${i+4}/5`));
 else { assert.match(messages[0].text,/¥899/);assert.match(messages[0].text,/signed-purchase/); }
}
assert.equal(flow.row().answers.length,5);
assert.equal((await flow.service.answerLineUpgradeChat({...a,text:'好きな仕事を続ける',messageId:'remaining-2'})).length,0,'Final answer redelivery never falls through to ordinary AI');
assert.equal(await flow.service.answerLineUpgradeChat({...a,text:'通常の会話へ戻る',messageId:'after'}),null);
assert(!JSON.stringify([...flow.events.values()]).includes('散歩をする'),'Analytics/control metadata never stores personal answer text');
console.log('PASS: five native LINE questions, private persistence, retries, length limit, resume, per-account isolation and webhook idempotency through final answer.');
const boundary = conversation();
await boundary.service.startLineUpgradeChat('line','owner');
assert.match((await boundary.service.answerLineUpgradeChat({...a,text:'あ'.repeat(51),messageId:'over-limit'}))[0].text,/50文字/);
assert.equal(boundary.row().answers.length,0);
assert.match((await boundary.service.answerLineUpgradeChat({...a,text:'あ'.repeat(50),messageId:'at-limit'}))[0].text,/質問 2\/5/);
assert.equal(boundary.row().answers[0].length,50);
const cancelled = conversation();await cancelled.service.startLineUpgradeChat('line','owner');
assert.match((await cancelled.service.answerLineUpgradeChat({...a,text:dialogue.LINE_UPGRADE_CANCEL}))[0].text,/中止/);
assert.equal(await cancelled.service.hasLineUpgradeChat('line','owner'),false);
const denied = conversation({full:false});assert.match((await denied.service.startLineUpgradeChat('line','owner'))[0].text,/完全版/);assert.equal(denied.row(),null);
const foreign = conversation({initialRow:{locale:'en',answers:[],state:'answers_ready'}});await foreign.service.startLineUpgradeChat('line','owner');assert.equal(foreign.row().locale,'en');assert.equal(await foreign.service.hasLineUpgradeChat('line','owner'),false);
console.log('PASS: cancel/ordinary chat, purchase restriction and other-language result protection.');

async function link({ token, status = 'linked', force = false } = {}) {
  const sends=[];let starts=0;let consumed=0;
  const route=compile('src/app/api/line/link/route.ts', {
    'next/server': {NextResponse}, '@/lib/api-security': {consumeRateLimit:async()=>({allowed:true}),readJsonObject:async req=>({ok:true,value:await req.json()})},
    '@/lib/line': {pushLineMessages:async(_user,messages)=>{sends.push(messages);return true;},quickReplies},
    '@/lib/line-alice': {lineAliceChatEnabled:()=>true}, '@/lib/line-events': {recordLineEvent:async()=>{}},
    '@/lib/line-linking': {consumeLineLinkCode:async()=>{consumed++;return {status,user:{id:'owner',ownerToken:'owner-token'},switched:force};},lineLinkSuccessMessage:()=> '普通の連携案内'},
    '@/lib/line-upgrade-chat': {startLineUpgradeChat:async()=>{starts++;return first;}}, '@/lib/line-upgrade-intent': intent,
    '@/lib/origin-check': {checkOrigin:()=>({ok:true})},
  }, {process:{env:{LINE_LOGIN_CHANNEL_ID:'test-channel'}},fetch:async()=>new Response(JSON.stringify({iss:'https://access.line.me',aud:'test-channel',sub:'U'+'1'.repeat(32),exp:Math.floor(Date.now()/1000)+3600}))});
  const response=await route.POST(new NextRequest('https://example.test/api/line/link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,idToken:'i'.repeat(40),force,...(token!==undefined?{intentToken:token}:{})})}));
  return {status:response.status,data:await response.json(),starts,consumed,sends};
}
const ordinary=await link();assert.equal(ordinary.status,200);assert.equal(ordinary.starts,0);assert.equal(ordinary.sends[0][0].text,'普通の連携案内');
const upsell=await link({token:signed});assert.equal(upsell.status,200);assert.equal(upsell.starts,1);assert.equal(upsell.data.upgradeChat,true);assert.match(upsell.sends[0].at(-1).text,/質問 1\/5/);
assert.equal((await link({token:signed,status:'already_linked'})).starts,1,'Existing LINE friends also enter the questions');
const forged=await link({token:signed+'bad'});assert.equal(forged.status,400);assert.equal(forged.consumed,0);assert.equal(forged.starts,0);
assert.equal((await link({token:signed,status:'conflict'})).starts,0);
assert.equal((await link({status:'already_linked'})).sends.length,0);
console.log('PASS: ordinary signup stays ordinary; only signed card intent starts native questions after verified linking, including existing friends; forged/conflicting flows never start. No external writes or messages.');

async function issue({ requestedIntent, full = true, kind = 'liff' } = {}) {
  const issued=[];
  const db={from(table){const q={select(){return this;},eq(){return this;},is(){return this;},gt(){return this;},limit(){return this;},
    delete(){return this;},lt(){return this;},insert(value){issued.push(value);return this;},
    maybeSingle:async()=>({data:table==='users'?{id:'owner',scores:{E:5},diagnosis_completed_at:'2026-10-21T00:00:00Z'}:null}),
    then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject);}};return q;}};
  const route=compile('src/app/api/line/link-code/route.ts',{
    'node:crypto':crypto,'next/server':{NextResponse},'@/lib/api-security':{consumeRateLimit:async()=>({allowed:true}),isSafeOpaqueToken:()=>true,readJsonObject:async request=>({ok:true,value:await request.json()})},
    '@/lib/entitlements':{hasFullAccess:async()=>full},'@/lib/line-upgrade-intent':intent,'@/lib/line':{hashLineLinkCode:hashing},
    '@/lib/origin-check':{checkOrigin:()=>({ok:true})},'@/lib/placeholder-user':{isUndiagnosedPlaceholderUser:()=>false},
    '@/lib/session':{getSession:async()=>({id:'owner'})},'@/lib/supabase-server':{supabaseAdmin:db},
  });
  const response=await route.POST(new NextRequest('https://example.test/api/line/link-code',{method:'POST',body:JSON.stringify({kind,owner_token:'owner-token',...(requestedIntent!==undefined?{intent:requestedIntent}:{})})}));
  return {status:response.status,data:await response.json(),issued};
}
const issuedOrdinary=await issue();assert.equal(issuedOrdinary.status,200);assert.equal(issuedOrdinary.data.intent_token,undefined);
const issuedUpgrade=await issue({requestedIntent:'result_upgrade'});assert.equal(issuedUpgrade.status,200);assert(intent.verifyLineUpgradeIntent(issuedUpgrade.data.code,issuedUpgrade.data.intent_token));
assert.equal((await issue({requestedIntent:'result_upgrade',full:false})).status,403);
assert.equal((await issue({requestedIntent:'result_upgrade',kind:'manual'})).status,400);
assert.equal((await issue({requestedIntent:'forged'})).status,400);
console.log('PASS: code issuance signs intent only for eligible purchasers and LIFF, with no effect on ordinary link codes.');
