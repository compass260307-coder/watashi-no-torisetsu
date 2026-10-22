import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server.js';
function compileSource(source,imports={},globals={}) {
 const exports={};const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,console,Buffer,Date,URL,URLSearchParams,Response,AbortSignal,process:{env:{}},require(name){if(name in imports)return imports[name];throw new Error(`Unexpected import ${name}`);},...globals});return exports;
}
const compile=(path,imports={},globals={})=>compileSource(readFileSync(path,'utf8'),imports,globals);
let now=Date.now();
class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const globals={Date:Clock,process:{env:{ALICE_TRANSFER_CODE_SECRET:'isolated-fulfillment-test-secret'}}};
const tokens=compile('src/lib/line-upgrade-image-token.ts',{'node:crypto':crypto},globals);
const readingTokens=compile('src/lib/line-result-upgrade-token.ts',{'node:crypto':crypto},globals);
const copy=compile('src/lib/line-upgrade-delivery-copy.ts');
const result=compile('src/lib/result-upgrade.ts');
const policy=compile('src/lib/access-products.ts');
const eventId=(name,key)=>crypto.createHash('sha256').update(`${name}:${key}`).digest('hex').slice(0,32);
const clone=value=>value===undefined?undefined:structuredClone(value);
const purchase={id:'cs_isolated',payment_status:'paid',amount_total:899,currency:'jpy',metadata:{product:'premium_bundle',locale:'ja',sales_channel:'line',paywall_source:'result_upgrade_after_answers',line_user_id:'line-owner',user_id:'owner'}};
const readyRow=()=>({locale:'ja',answers:['散歩','読書','落ち着いている','尊重','好きな仕事'],state:'ready',attempts:0,personalized_type_name:'専用タイプ',personalized_intro:'本人の紹介',reading:{sections:[{title:'章',body:'私的な鑑定本文'}]},character_storage_path:'owner/character.webp',generated_at:new Date(now).toISOString()});
function flow({ready=false}={}) {
 const events=new Map();let row=ready?readyRow():{...readyRow(),state:'answers_ready',personalized_type_name:null,character_storage_path:null};
 let linkedUser='owner';let premium=true;let pushOk=true;let generateOk=true;let generated=0;let failSentSave=false;let spend=null;let duringGeneration;const pushes=[];
 const value=(candidate,key)=>key.startsWith('metadata->>')?candidate.metadata?.[key.slice(11)]:candidate[key];
 function query(table){let action='select',data;const conditions=[];let count=Infinity;let descending=false;
  const execute=()=>{
   const all=table==='events'?[...events.values()]:table==='line_accounts'?[{user_id:linkedUser,line_user_id:'line-owner'}]:[];
   const matched=all.filter(candidate=>conditions.every(fn=>fn(candidate)));
   if(action==='insert'){if(events.has(data.id))return {error:{code:'23505'}};events.set(data.id,clone(data));return {data:clone(data),error:null};}
   if(action==='update'){
    if(failSentSave&&data.metadata.status==='sent'){failSentSave=false;return {error:{message:'audit write failed'}};}
    for(const candidate of matched)events.set(candidate.id,{...candidate,...clone(data)});
    return {data:matched.map(candidate=>events.get(candidate.id)),error:null};
   }
   if(descending)matched.reverse();return {data:matched.slice(0,count).map(clone),error:null};
  };
  const q={select(){return this;},eq(key,expected){conditions.push(c=>value(c,key)===expected);return this;},in(key,values){conditions.push(c=>values.includes(value(c,key)));return this;},lte(key,expected){conditions.push(c=>value(c,key)<=expected);return this;},order(_key,opts){descending=opts?.ascending===false;return this;},limit(n){count=n;return this;},insert(input){action='insert';data=input;return this;},update(input){action='update';data=input;return this;},maybeSingle:async()=>{const r=execute();return {...r,data:Array.isArray(r.data)?r.data[0]??null:r.data};},then(resolve,reject){return Promise.resolve().then(execute).then(resolve,reject);}};return q;
 }
 const service=compile('src/lib/line-upgrade-fulfillment.ts',{
  'server-only':{},'node:crypto':crypto,'@/lib/entitlements':{hasPremiumBundleAccess:async()=>premium},
  '@/lib/line-events':{deterministicLineEventId:eventId},'@/lib/line':{pushLineMessages:async(to,messages,key)=>{pushes.push(clone({to,messages,key}));return pushOk;}},
  '@/lib/line-upgrade-delivery-copy':copy,'@/lib/line-upgrade-image-token':tokens,'@/lib/line-result-upgrade-token':readingTokens,
  '@/lib/result-upgrade':result,'@/lib/result-upgrade-server':{loadResultUpgradeForUser:async()=>clone(row)},
  '@/lib/ai-spend-guard':{resultUpgradeSpendBlock:()=>spend},'@/lib/access-products':policy,
  '@/lib/site-url':{resolveSiteUrl:()=> 'https://example.test'},'@/lib/supabase-server':{supabaseAdmin:{from:query}},
  '@/lib/result-upgrade/generate':{generateResultUpgradeForUser:async()=>{generated++;if(duringGeneration)await duringGeneration();if(generateOk)row=readyRow();else row={...row,state:'failed',attempts:(row.attempts??0)+1};return generateOk?{ok:true}:{error:'generation failure'};}},
 },globals);
 return {service,events,pushes,generated:()=>generated,row:()=>row,setRow:v=>{row=v;},link:v=>{linkedUser=v;},paid:v=>{premium=v;},push:v=>{pushOk=v;},generate:v=>{generateOk=v;},failAudit:()=>{failSentSave=true;},spend:v=>{spend=v;},during:fn=>{duringGeneration=fn;}};
}
const base=flow();const id=await base.service.enqueueLineResultUpgrade(purchase,'owner');
assert.equal(await base.service.enqueueLineResultUpgrade(purchase,'owner'),id);assert.equal(base.events.size,1);
base.during(async()=>{assert.equal(base.pushes.length,1);assert.equal(base.pushes[0].messages[0].text,copy.LINE_UPGRADE_PAID_MESSAGE,'Preparation is delivered before real generation starts');});
await base.service.processLineResultUpgrade(id);assert.equal(base.generated(),1);assert.equal(base.pushes.length,2);assert.equal(base.events.get(id).metadata.status,'sent');
assert.equal(base.pushes[0].messages[0].text,copy.LINE_UPGRADE_PAID_MESSAGE);
assert.notEqual(base.pushes[0].key,base.pushes[1].key,'Preparation and final delivery have separate retry keys');
assert.equal(base.pushes[1].to,'line-owner');assert.equal(base.pushes[1].messages[1].type,'image');
assert.match(base.pushes[1].messages[0].text,/ありがとう！できあがったよ/);
const imageToken=new URL(base.pushes[1].messages[1].originalContentUrl).searchParams.get('token');
assert.equal(tokens.verifyLineUpgradeImage(imageToken).userId,'owner');assert.equal(readingTokens.verifyLineResultUpgradeIdentity(imageToken),null);
const readingUrl=base.pushes[1].messages[2].text.split('\n\n').at(-1);
assert.equal(readingTokens.verifyLineResultUpgradeIdentity(new URL(readingUrl).searchParams.get('token')).lineUserId,'line-owner');
await base.service.processLineResultUpgrade(id);assert.equal(base.pushes.length,2);assert.equal(base.generated(),1);
assert(!JSON.stringify([...base.events.values()]).includes('私的な鑑定本文'));assert(!JSON.stringify([...base.events.values()]).includes('owner/character'));
console.log('PASS: paid enqueue, automatic generation and character+reading delivery, replay idempotence and private outbox metadata.');
for(const changed of [{payment_status:'unpaid'},{amount_total:1398},{currency:'usd'},{metadata:{...purchase.metadata,user_id:'other'}}]){await assert.rejects(()=>flow().service.enqueueLineResultUpgrade({...purchase,...changed},'owner'));}
assert.equal(await flow().service.enqueueLineResultUpgrade({...purchase,metadata:{...purchase.metadata,locale:'en'}},'owner'),null);
const revoked=flow();const revokedId=await revoked.service.enqueueLineResultUpgrade(purchase,'owner');revoked.paid(false);await revoked.service.processLineResultUpgrade(revokedId);assert.equal(revoked.pushes.length,0);assert.equal(revoked.generated(),0);
const relinked=flow();const relinkId=await relinked.service.enqueueLineResultUpgrade(purchase,'owner');relinked.during(async()=>relinked.link('another-owner'));await relinked.service.processLineResultUpgrade(relinkId);assert.equal(relinked.pushes.length,1);assert.equal(relinked.pushes[0].messages[0].text,copy.LINE_UPGRADE_PAID_MESSAGE,'No result is delivered after relinking');
const wrongLocale=flow();const wrongId=await wrongLocale.service.enqueueLineResultUpgrade(purchase,'owner');wrongLocale.setRow({...readyRow(),locale:'en'});await wrongLocale.service.processLineResultUpgrade(wrongId);assert.equal(wrongLocale.pushes.length,0);
const blocked=flow();const blockedId=await blocked.service.enqueueLineResultUpgrade(purchase,'owner');blocked.spend({canRetry:false,retryAt:null});await blocked.service.processLineResultUpgrade(blockedId);assert.equal(blocked.generated(),0);assert.equal(blocked.pushes.length,0);
console.log('PASS: unpaid/wrong-amount/other-language purchases, refund, account relink and spend blocks never generate or disclose results.');
revoked.paid(true);await revoked.service.resumeLineResultUpgradeForUser('owner',true);assert.equal(revoked.generated(),1);assert.equal(revoked.pushes.length,2);
const retry=flow({ready:true});const retryId=await retry.service.enqueueLineResultUpgrade(purchase,'owner');retry.push(false);await retry.service.processLineResultUpgrade(retryId);assert.equal(retry.events.get(retryId).metadata.status,'pending');
now+=2*60_000;retry.push(true);await retry.service.processDueLineResultUpgrades();assert.equal(retry.generated(),0);assert.equal(retry.pushes.length,2);assert.deepEqual(retry.pushes[0],retry.pushes[1]);assert.equal(retry.events.get(retryId).metadata.status,'sent');
const audit=flow({ready:true});const auditId=await audit.service.enqueueLineResultUpgrade(purchase,'owner');audit.failAudit();await audit.service.processLineResultUpgrade(auditId);now+=2*60_000;await audit.service.processLineResultUpgrade(auditId);assert.equal(audit.pushes.length,2);assert.deepEqual(audit.pushes[0],audit.pushes[1]);
const expired=flow({ready:true});const expiredId=await expired.service.enqueueLineResultUpgrade(purchase,'owner');expired.push(false);await expired.service.processLineResultUpgrade(expiredId);now+=24*60*60_000;await expired.service.processLineResultUpgrade(expiredId);assert.equal(expired.pushes.length,1);assert.equal(expired.events.get(expiredId).metadata.status,'attention');
const race=flow();const raceId=await race.service.enqueueLineResultUpgrade(purchase,'owner');let release;race.during(()=>new Promise(resolve=>{release=resolve;}));const running=race.service.processLineResultUpgrade(raceId);while(!release)await new Promise(resolve=>setTimeout(resolve,0));await race.service.processLineResultUpgrade(raceId);release();await running;assert.equal(race.generated(),1);assert.equal(race.pushes.length,2);
const interrupted=flow();const interruptedId=await interrupted.service.enqueueLineResultUpgrade(purchase,'owner');const interruptedMeta=interrupted.events.get(interruptedId).metadata;Object.assign(interruptedMeta,{status:'processing',lease_until:new Date(now-1).toISOString(),next_at:new Date(now-1).toISOString()});await interrupted.service.processDueLineResultUpgrades();assert.equal(interrupted.generated(),1);
console.log('PASS: durable retries, fixed message body/retry key, post-send audit failure, expired retry safety, concurrency and interrupted-job recovery.');
const preparationRetry=flow();const preparationId=await preparationRetry.service.enqueueLineResultUpgrade(purchase,'owner');
preparationRetry.push(false);await preparationRetry.service.processLineResultUpgrade(preparationId);
assert.equal(preparationRetry.generated(),0,'Generation cannot overtake a pending preparation notice');
now+=2*60_000;preparationRetry.push(true);await preparationRetry.service.processLineResultUpgrade(preparationId);
assert.deepEqual(preparationRetry.pushes[0],preparationRetry.pushes[1],'Preparation retries reuse the exact body and key');
assert.equal(preparationRetry.pushes.length,3);assert.equal(preparationRetry.generated(),1);
const generationRetry=flow();const generationId=await generationRetry.service.enqueueLineResultUpgrade(purchase,'owner');
generationRetry.generate(false);await generationRetry.service.processLineResultUpgrade(generationId);
assert.equal(generationRetry.pushes.length,1,'Failed generation never sends a completed message');
now+=6*60_000;generationRetry.generate(true);await generationRetry.service.processLineResultUpgrade(generationId);
assert.equal(generationRetry.pushes.length,2,'Generation retry does not duplicate the preparation notice');
const preparationExpired=flow();const preparationExpiredId=await preparationExpired.service.enqueueLineResultUpgrade(purchase,'owner');
preparationExpired.push(false);await preparationExpired.service.processLineResultUpgrade(preparationExpiredId);
now+=24*60*60_000;await preparationExpired.service.processLineResultUpgrade(preparationExpiredId);
assert.equal(preparationExpired.pushes.length,1);assert.equal(preparationExpired.events.get(preparationExpiredId).metadata.status,'attention');
assert.equal(preparationExpired.generated(),0);
console.log('PASS: payment confirmation → preparation notice → real generation → completed delivery; preparation and generation retries preserve message order and never announce incomplete results.');
// Official LINE duplicate acceptance (409) is success only with the accepted-request header.
const lineApi=compile('src/lib/line.ts',{'node:crypto':crypto},{process:{env:{LINE_CHANNEL_ACCESS_TOKEN:'isolated-token'}},fetch:async(_url,input)=>{assert.equal(input.headers['X-Line-Retry-Key'],'same-retry-key');return new Response('',{status:409,headers:{'x-line-accepted-request-id':'accepted'}});}});
assert.equal(await lineApi.pushLineMessages('line-owner',[],'same-retry-key'),true);
// Purpose-bound, expiring image URLs and real JPEG transcoding without cookies.
now=Date.now();const imageIdentity={userId:'owner',lineUserId:'line-owner',generatedAt:new Date(now).toISOString()};const signed=tokens.signLineUpgradeImage(imageIdentity,now);
assert.equal(tokens.verifyLineUpgradeImage(signed+'x'),null);assert.equal(tokens.verifyLineUpgradeImage(readingTokens.signLineResultUpgradeIdentity('line-owner','owner')),null);
let imagePaid=true,imageLinked='owner';const pixels=await sharp({create:{width:64,height:64,channels:3,background:'#06C755'}}).webp().toBuffer();
const imageRoute=compile('src/app/api/line/result-upgrade/image/route.ts',{
 'next/server':{NextResponse},sharp:{default:sharp},'@/lib/entitlements':{hasPremiumBundleAccess:async()=>imagePaid},'@/lib/line-upgrade-image-token':tokens,'@/lib/result-upgrade':result,
 '@/lib/result-upgrade-server':{loadResultUpgradeForUser:async()=>({...readyRow(),generated_at:imageIdentity.generatedAt})},
 '@/lib/supabase-server': {
  supabaseAdmin: {
   from() { return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{user_id:imageLinked}})}; },
   storage: { from() { return {download:async()=>({data:new Blob([pixels],{type:'image/webp'})})}; } },
  },
 },
},{Blob});
const imageRequest=()=>new Request(`https://example.test/image?token=${signed}&size=preview`);
const rendered=await imageRoute.GET(imageRequest());assert.equal(rendered.status,200);assert.equal(rendered.headers.get('content-type'),'image/jpeg');assert.equal((await sharp(Buffer.from(await rendered.arrayBuffer())).metadata()).format,'jpeg');
imagePaid=false;assert.equal((await imageRoute.GET(imageRequest())).status,404);imagePaid=true;imageLinked='other';assert.equal((await imageRoute.GET(imageRequest())).status,404);
now+=24*60*60_000+1;assert.equal(tokens.verifyLineUpgradeImage(signed),null);
console.log('PASS: LINE 409 idempotence; image token purpose/tampering/expiry, private JPEG conversion, refund and relink protection.');
// Exercise the actual premium-bundle webhook branch with safe dependencies.
const webhook=readFileSync('src/app/api/webhook/stripe/route.ts','utf8');const start=webhook.indexOf('async function handleCheckoutPaid(');const end=webhook.indexOf('\nasync function handleTakoUnlockCompleted(',start);
const callbacks=[];const order=[];let legacyGeneration=0;
const handler=compileSource('export '+webhook.slice(start,end),{}, {
 after:fn=>callbacks.push(fn),grantFullAccessByEmailOrId:async()=> 'owner',grantUnmeiByEmailOrId:async()=>{},recordFullAccessPayment:async()=>order.push('payment-recorded'),
 grantHoshiyomiCreditsToTarget:async()=>{},hoshiyomiChatCreditTarget:()=>30,isMissingHoshiyomiStore:()=>false,persistPurchaseLocale:async()=>{},recordPurchaseCompletedEvent:async()=>{},
 queueServerPurchaseConversions:async()=>{},enqueueLineResultUpgrade:async session=>{order.push('queued');return session.metadata.sales_channel==='line'?'job':null;},processLineResultUpgrade:async()=>order.push('generated-and-delivered'),
 isLineResultUpgradePurchase:session=>session.metadata.sales_channel==='line',triggerUnmeiGeneration:async()=>{legacyGeneration++;},purchaseLocale:()=> 'ja',sendDetailedReportEmailBestEffort:async()=>{},
});
await handler.handleCheckoutPaid(purchase,new Date().toISOString());assert.deepEqual(order,['payment-recorded','queued']);assert.equal(callbacks.length,1);await callbacks.shift()();assert.equal(legacyGeneration,0);assert.equal(order.at(-1),'generated-and-delivered');
await handler.handleCheckoutPaid({...purchase,metadata:{...purchase.metadata,sales_channel:'web'}},new Date().toISOString());await callbacks.shift()();assert.equal(legacyGeneration,1);
console.log('PASS: verified payment branch persists job before response and schedules auto fulfillment; legacy generation remains unchanged. No Stripe, LINE, database or AI calls.');

let cronRuns=0;
const cron=compile('src/app/api/cron/purchase-conversions/route.ts',{
 'node:crypto':crypto,'next/server':{NextResponse},
 '@/lib/server-purchase-conversions':{processDueServerPurchaseConversions:async()=>{cronRuns++;return {delivered:0};}},
 '@/lib/line-upgrade-fulfillment':{processDueLineResultUpgrades:async limit=>{assert.equal(limit,1);cronRuns++;return {checked:1};}},
},{process:{env:{CRON_SECRET:'isolated-cron-secret'}}});
assert.equal((await cron.GET(new NextRequest('https://example.test/cron'))).status,401);assert.equal(cronRuns,0);
const cronResult=await cron.GET(new NextRequest('https://example.test/cron',{headers:{authorization:'Bearer isolated-cron-secret'}}));
assert.equal(cronResult.status,200);assert.equal(cronRuns,2);assert.equal((await cronResult.json()).lineUpgrades.checked,1);
console.log('PASS: existing authenticated cron recovers fulfillment while preserving purchase-conversion processing.');
