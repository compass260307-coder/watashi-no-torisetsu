import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(path, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, console, URL, AbortSignal,
    require(name) { if (name in imports) return imports[name]; throw new Error(`Unexpected import: ${name}`); },
    ...globals,
  }, {filename:path});
  return exports;
}
const policy = compile('src/lib/access-products.ts');
const results = compile('src/lib/result-upgrade.ts');
const dialogue = compile('src/lib/line-upgrade-dialogue.ts', {
  '@/i18n/result-upgrade': compile('src/i18n/result-upgrade.ts'),
  '@/lib/access-products': policy, '@/lib/result-upgrade': results,
});
const checkoutUrl = 'https://www.watashi-torisetsu.com/api/line/result-upgrade/enter?token=synthetic-example&checkout=1';
const card = dialogue.lineUpgradePurchaseCard(checkoutUrl);
assert.equal(card.type,'flex');
assert(card.altText.length <= 400);
assert(Buffer.byteLength(JSON.stringify(card.contents)) < 30_000);
assert.equal(card.contents.type,'bubble');
assert.equal(card.contents.header.backgroundColor,'#06C755');
assert.equal(card.contents.header.contents[0].text,'Alice - 結果のアップグレード');
assert.equal(card.contents.header.contents[1].text,'30日間の返金保証付き');
assert.equal(card.contents.body,undefined);
assert.equal(card.contents.footer.contents.length,1);
assert.equal(card.contents.footer.contents[0].color,'#06C755');
assert.equal(card.contents.footer.contents[0].action.uri,checkoutUrl);
assert.equal(card.contents.footer.contents[0].action.label,'購入手続きへ');
const text = dialogue.LINE_UPGRADE_PRICE_MESSAGE;
for(const value of ['¥1398','¥499','¥899','買い切り','30日間']) assert(text.includes(value));
if(process.argv.includes('--write-example')) writeFileSync('flex-card-example.json',JSON.stringify({messages:[card]},null,2));
console.log('PASS: price message contains the fixed offer and guarantee; the compact card identifies Alice and the guarantee with the signed purchase button within LINE limits.');

const callbacks=[];const sends=[];const waits=[];
let failPush=false;
const offer=compile('src/lib/line-upgrade-offer-delivery.ts',{
  'server-only':{},'next/server':{after:callback=>callbacks.push(callback)},
  'node:timers/promises':{setTimeout:async ms=>{waits.push(ms);}},
  '@/lib/line-upgrade-dialogue':dialogue,
  '@/lib/line':{
    replyLineMessages:async(token,messages)=>{sends.push({kind:'reply',token,messages});return true;},
    pushLineMessages:async(to,messages)=>{sends.push({kind:'push',to,messages});return !failPush;},
    startLineLoadingAnimation:async(_user,seconds)=>{assert.equal(seconds,10);throw new Error('Indicator unavailable');},
  },
});
await offer.replyLineUpgradeMessages('one-use-reply','owner',[{type:'text',text:dialogue.LINE_UPGRADE_OFFER_MESSAGE},{type:'text',text:dialogue.LINE_UPGRADE_PRICE_MESSAGE},card]);
assert.equal(sends.length,1);
assert.equal(sends[0].messages[0].text,dialogue.LINE_UPGRADE_PREPARING_MESSAGE);
assert.equal(callbacks.length,1);
await callbacks.shift()();
assert.deepEqual(waits,[6000,1500,3000]);
assert.equal(sends[1].messages[0].text,dialogue.LINE_UPGRADE_OFFER_MESSAGE);
assert.equal(sends[2].messages[0].text,dialogue.LINE_UPGRADE_PRICE_MESSAGE);
assert.equal(sends[3].messages[0],card);
assert(sends.slice(1).every(send=>send.kind==='push' && send.messages.length===1));
assert.equal(sends.filter(item=>item.kind==='reply').length,1,'Reply tokens are used once and never after the delay');
await offer.replyLineUpgradeMessages('question-reply','owner',[{type:'text',text:'質問 1/5'}]);
assert.equal(callbacks.length,0,'Questions never wait for cosmetic preparation');
const before=sends.length;
await offer.pushLineUpgradeMessages('owner',[{type:'text',text:dialogue.LINE_UPGRADE_OFFER_MESSAGE},{type:'text',text:dialogue.LINE_UPGRADE_PRICE_MESSAGE},card]);
failPush=true;
await callbacks.shift()();
assert.equal(sends.length,before+2,'Failed preparation-complete message prevents the price and purchase card from overtaking it');
console.log('PASS: a preparation message precedes the delayed card; indicator failure does not block delivery, and questions do not wait.');

const requests = [];
let responseStatus=200;
let responseBody={url:'https://checkout.stripe.com/c/pay/cs_test_isolated',amount:899,currency:'JPY'};
const client=compile('src/lib/line-upgrade-checkout-client.ts',{
  '@/lib/access-products':policy,'@/lib/checkout-measurement':{createCheckoutAttemptId:()=> 'isolated-attempt'},
},{fetch:async(url,options)=>{
  requests.push({url,options});
  return new Response(JSON.stringify(responseBody),{status:responseStatus});
}});
const checkout=await client.createLineUpgradeCheckout();
assert.equal(checkout.kind,'checkout');
assert.equal(checkout.amount,899);
assert.equal(requests[0].url,'/api/checkout/create-full-access-session');
assert.equal(requests[0].options.method,'POST');
const body=JSON.parse(requests[0].options.body);
assert.equal(body.sales_channel,'line');
assert.equal(body.product,'premium_bundle');
assert.equal(body.locale,'ja');
assert.equal(body.paywall_source,'result_upgrade_after_answers');
assert.equal(body.paywall_version,policy.accessPaywallVersionForLocale('ja'));
assert.equal(body.amount,undefined,'Client never supplies the price');
assert.equal(body.owner_token,undefined,'Buyer comes exclusively from the restricted LINE session');
for(const [status,data,kind] of [
  [401,{},'reauthenticate'],[403,{},'reauthenticate'],
  [409,{code:'already_premium_bundle'},'paid'],
  [409,{code:'result_upgrade_answers_required'},'answers_required'],
]) {
  responseStatus=status;responseBody=data;
  assert.equal((await client.createLineUpgradeCheckout()).kind,kind);
}
for(const [status,data] of [
  [503,{}],[409,{code:'result_upgrade_ineligible'}],
  [200,{url:'https://attacker.example/pay',amount:899,currency:'JPY'}],
  [200,{url:'https://checkout.stripe.com/c/pay/test',amount:899,currency:'USD'}],
]) {responseStatus=status;responseBody=data;await assert.rejects(client.createLineUpgradeCheckout());}
console.log('PASS: checkout uses the existing authenticated POST, server price and current offer; paid, expired, incomplete and failed responses cannot open another payment.');

const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
async function page({session=true,full=true,paid=false,locale='ja',answers=Array(5).fill('回答')}={}) {
  const route=compile('src/app/line/result-upgrade/checkout/page.tsx',{
    'react/jsx-runtime':jsx,'next/navigation':{redirect:href=>{throw new Error(`redirect:${href}`);}},
    '@/components/result-upgrade/LineUpgradeCheckoutRedirect':{LineUpgradeCheckoutRedirect:'checkout'},
    '@/lib/line-result-upgrade':{getLineResultUpgradeSession:async()=>session?{id:'owner'}:null},
    '@/lib/entitlements':{hasFullAccess:async()=>full,hasPremiumBundleAccess:async()=>paid},
    '@/lib/result-upgrade-server':{loadResultUpgradeForUser:async()=>({locale,answers})},
    '@/lib/result-upgrade':results,'@/lib/line-upgrade-dialogue':dialogue,
  });
  try{return await route.default();}catch(error){return error.message;}
}
assert.equal((await page()).props.children.type,'checkout');
assert.match(await page({session:false}),/^redirect:https:\/\/line.me/);
assert.equal(await page({full:false}),'redirect:/line/menu');
assert.equal(await page({paid:true}),'redirect:/line/result-upgrade?paid=1');
assert.match(await page({locale:'en'}),/^redirect:https:\/\/line.me/);
assert.match(await page({answers:['不足']}),/^redirect:https:\/\/line.me/);
console.log('PASS: direct checkout page rejects missing LINE identity, missing full access, incomplete and other-language answers; existing purchasers go to their receipt.');

let effect;let calls=0;let redirects=0;let resolveCheckout;
const promise=new Promise(resolve=>{resolveCheckout=resolve;});
const component=compile('src/components/result-upgrade/LineUpgradeCheckoutRedirect.tsx',{
  'react/jsx-runtime':jsx,
  react:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:fn=>{effect=fn;}},
  '@/lib/line-upgrade-checkout-client':{createLineUpgradeCheckout:()=>{calls++;return promise;}},
  '@/lib/redirect-to-checkout':{redirectToFullAccessCheckout:()=>{redirects++;}},
  '@/lib/line-upgrade-dialogue':dialogue,
});
component.LineUpgradeCheckoutRedirect();
const firstCleanup=effect();firstCleanup();
const secondCleanup=effect();
resolveCheckout({kind:'checkout',url:checkout.url,amount:899,currency:'JPY'});
await promise;await Promise.resolve();
assert.equal(calls,1,'Strict Mode never creates two Checkout Sessions');
assert.equal(redirects,1,'Only the active effect navigates');
secondCleanup();
console.log('PASS: Strict Mode shares one checkout request and performs one redirect. No external requests or payments performed.');
