import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

const source=fs.readFileSync(new URL('../src/lib/hyper-ad-spend.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({pages,info={advertiser_id:'123',currency:'JPY',timezone:'Asia/Tokyo'},rpcError=false}={}) {
  const exports={},calls=[],rpc=[];
  const env={TIKTOK_MARKETING_ACCESS_TOKEN:'secret-test-token',VERCEL_ENV:'production',HYPER_AD_SPEND_ENABLED:'1',HYPER_TIKTOK_AD_ACCOUNTS:'[{"advertiserId":"123","country":"jp"}]'};
  const sandbox={exports,process:{env},URL,URLSearchParams,AbortSignal,Intl,Date,fetch:async(url,options)=>{
    calls.push([url,options]);assert.equal(options.headers['Access-Token'],'secret-test-token');assert(!url.toString().includes('secret-test-token'));
    if(url.pathname.includes('advertiser/info'))return {ok:true,json:async()=>({code:0,data:{list:[info]}})};
    const page=Number(url.searchParams.get('page'));return {ok:true,json:async()=>pages?.[page-1] ?? {code:0,data:{list:[],page_info:{page,total_page:1}}}};
  },require:name=>{
    if(name==='server-only')return {};
    if(name==='node:crypto')return crypto;
    if(name==='@/lib/supabase-server')return {supabaseAdmin:{rpc:async(name,args)=>{rpc.push([name,args]);return {data:name==='hyper_ad_spend_claim'?true:null,error:rpcError?{message:'private'}:null};}}};
    throw new Error(name);
  }};
  vm.runInNewContext(compiled,sandbox);
  return {exports,calls,rpc,env};
}
const baseRow=(id='987')=>({dimensions:{ad_id:id,stat_time_hour:'2026-10-21 00:00:00'},metrics:{ad_name:'jp_tik_01_test',spend:'100.50',impressions:'1000',clicks:'25'}});
const success=harness({pages:[{code:0,data:{list:[baseRow()],page_info:{page:1,total_page:2}}},{code:0,data:{list:[baseRow('988')],page_info:{page:2,total_page:2}}}]});
const account={advertiserId:'123',country:'jp',source:'tiktok',tokenEnv:'TIKTOK_MARKETING_ACCESS_TOKEN'};
const rows=await success.exports.fetchTikTokAdRows(account,'2026-10-20','2026-10-22',{},Date.now()+10000);
assert.equal(rows.length,2);assert.equal(rows[0].spend_jpy,100.5);assert.equal(rows[0].hour,0);
assert.equal(success.calls[1][0].searchParams.get('data_level'),'AUCTION_AD');
assert.deepEqual(JSON.parse(success.calls[1][0].searchParams.get('dimensions')),['ad_id','stat_time_hour']);
const usd=harness({info:{advertiser_id:'123',currency:'USD',timezone:'America/Los_Angeles'},pages:[{code:0,data:{list:[{...baseRow(),dimensions:{ad_id:'987',stat_time_hour:'2026-10-20 08:00:00'}}],page_info:{page:1,total_page:1}}}]});
assert.equal((await usd.exports.fetchTikTokAdRows(account,'2026-10-20','2026-10-22',{usd:150},Date.now()+10000))[0].spend_jpy,15075);
assert.deepEqual(JSON.parse(JSON.stringify(usd.exports.advertiserHourToJst('2026-10-20 08:00:00','America/Los_Angeles'))),{date:'2026-10-21',hour:0});
assert.throws(()=>usd.exports.advertiserHourToJst('2026-11-01 01:00:00','America/Los_Angeles'),/AMBIGUOUS_TIMEZONE/);
assert.throws(()=>usd.exports.advertiserHourToJst('2026-10-20 08:00:00','Asia/Kolkata'),/UNALIGNED_TIMEZONE/);
const incomplete=harness({pages:[{code:0,data:{list:[baseRow()],page_info:{page:1,total_page:2}}},{code:40001,message:'private auth error'}]});
const result=await incomplete.exports.syncHyperAdSpend(new Date('2026-10-22T04:00:00Z'));
assert.equal(result.failed,1);assert(!incomplete.rpc.some(([n])=>n==='hyper_ad_spend_replace'));assert(incomplete.rpc.some(([n])=>n==='hyper_ad_spend_failed'));assert(incomplete.rpc.some(([n])=>n==='hyper_ad_spend_release'));
const empty=harness();await empty.exports.syncHyperAdSpend(new Date('2026-10-22T04:00:00Z'));
const saved=empty.rpc.find(([n])=>n==='hyper_ad_spend_replace')[1];assert.equal(saved.p_start,'2026-10-20');assert.equal(saved.p_end,'2026-10-22');assert.equal(saved.p_rows.length,0);
const duplicate=harness({pages:[{code:0,data:{list:[baseRow(),baseRow()],page_info:{page:1,total_page:1}}}]});
await assert.rejects(()=>duplicate.exports.fetchTikTokAdRows(account,'2026-10-20','2026-10-22',{},Date.now()+10000),/DUPLICATE_REPORT/);
const disabled=harness();disabled.env.VERCEL_ENV='preview';await disabled.exports.syncHyperAdSpend();assert.equal(disabled.calls.length,0);assert.equal(disabled.rpc.length,0);
disabled.env.VERCEL_ENV='production';disabled.env.HYPER_AD_SPEND_ENABLED='0';await disabled.exports.syncHyperAdSpend();assert.equal(disabled.calls.length,0);
const malformed=harness();malformed.env.HYPER_TIKTOK_AD_ACCOUNTS='[{"advertiserId":"123","country":"xx"}]';await assert.rejects(()=>malformed.exports.syncHyperAdSpend(),/INVALID_CONFIG/);assert.equal(malformed.calls.length,0);
const noFx=harness({info:{advertiser_id:'123',currency:'KRW',timezone:'Asia/Seoul'}});await assert.rejects(()=>noFx.exports.fetchTikTokAdRows(account,'2026-10-20','2026-10-22',{},Date.now()+10000),/FX_MISSING/);

const route=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/cron/ad-spend/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out={};let ran=0;
vm.runInNewContext(route,{exports:out,process:{env:{CRON_SECRET:'test-cron'}},require:n=>n==='node:crypto'?crypto:n==='next/server'?{NextResponse:{json:(body,init)=>({body,...init})}}:{syncHyperAdSpend:async()=>{ran++;return {succeeded:1,failed:0};}}});
assert.equal((await out.GET({headers:new Headers()})).status,401);assert.equal(ran,0);
assert.equal((await out.GET({headers:new Headers({authorization:'Bearer test-cron'})})).status,200);assert.equal(ran,1);
console.log('hyper ads: JST/foreign timezone, DST safety, FX, pages, duplicates, empty replacement, failure retention, disabled Preview, cron auth passed');
