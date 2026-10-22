import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('./google-sheets-hyper-report-sync.gs',import.meta.url),'utf8');
const columns=['date','country','source','medium','campaign','diagnoses','purchases_full','purchases_upsell','purchases_total','revenue_jpy','line_follows','sub_starts','ad_spend_jpy','impressions','clicks','updated_at'];
const hourlyColumns=['date','hour','country','source','medium','campaign','diagnoses','purchases_total','revenue_jpy','ad_spend_jpy','updated_at'];
const today='2026-10-22', asOf=today+'T04:00:00Z';
const old = [[new Date('2026-10-21T15:00:00Z'),'jp','tiktok','paid_social','=literal',99,1,0,1,499,0,0,0,0,0,'old'],
  [new Date('2026-10-21T15:00:00Z'),'jp','x','cpc','removed',20,0,0,0,0,0,0,0,0,0,'old'],
  [new Date('2026-10-10T15:00:00Z'),'jp','x','cpc','preserved',20,0,0,0,0,0,0,0,0,0,'old']];
const versions=Array.from({length:8},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,version:asOf}));
function harness({fail=false,invalid=false,inactive=false}={}) {
  const state={HYPER_REPORT_ACTIVE:inactive?'':'1',HYPER_REPORT_START_DATE:today};
  let calls=[],writes=[],rawRuns=0;
  function sheet(id,headers,rows=[]) {return {getSheetId:()=>id,getLastRow:()=>rows.length+1,getMaxRows:()=>1000,
    getRange:r=>({getValues:()=>r===1?[headers]:rows})};}
  const sheets={data_daily:sheet(10,columns,old),data_hourly:sheet(11,hourlyColumns,Array(20).fill([])),同期状態:sheet(13,[])};
  const ctx=vm.createContext({Date,console,Utilities:{formatDate:d=>new Date(d.getTime()+9*3600000).toISOString().slice(0,10)},
    RAW_SYNC_BASE_URL:'https://example.test/api/metrics/',
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>state[k]||'',setProperties:o=>Object.assign(state,o)})},
    SpreadsheetApp:{openById:id=>{assert.equal(id,'177UacI6un8hb2B01O0xkiFtPm9-IoSxMBn3gxIi-sLg');return {getSpreadsheetTimeZone:()=> 'Asia/Tokyo',getSheetByName:n=>sheets[n]};}},
    ScriptApp:{getOAuthToken:()=> 'test-oauth'},
    UrlFetchApp:{fetch:(url,o)=>{assert.match(url,/sheets.googleapis.com/);writes.push(JSON.parse(o.payload));return {getResponseCode:()=>fail?503:200};}},
    metricsAuthorizedFetch_:url=>{
      calls.push(url);const date=new URL(url).searchParams.get('date');
      let data={version:1,today,as_of:asOf,dates:versions};
      if(date){const row=Object.fromEntries(columns.map(c=>[c,['date','country','source','medium','campaign','updated_at'].includes(c)?'':0]));
        Object.assign(row,{date,country:invalid?'xx':'jp',source:'tiktok',medium:'paid_social',campaign:'=literal',diagnoses:3,updated_at:asOf});
        data={version:1,date,daily:date===today?[row]:[],hourly:date===today?[{date,hour:0,country:'jp',source:'tiktok',medium:'paid_social',campaign:'=literal',diagnoses:3,purchases_total:0,revenue_jpy:0,ad_spend_jpy:0,updated_at:asOf}]:[],ad_status:{source:'未接続（段階1）',synced_at:null}};
      }
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(data)};
    }});
  vm.runInContext(source,ctx);
  return {ctx,state,calls,writes,run:()=>ctx.syncHyperReportUnlocked_(),rawRuns:()=>rawRuns};
}
const ok=harness();ok.run();
assert.equal(ok.writes.length,1);
const req=ok.writes[0].requests;
for(const r of req){const range=r.updateCells?.range||r.repeatCell?.range;if(range?.sheetId===10)assert(range.endColumnIndex<=16);}
const dailyWrites=req.filter(r=>r.updateCells?.range?.sheetId===10).map(r=>r.updateCells);
assert.equal(dailyWrites.length,2); // existing upsert + disappeared-key zero, historical row preserved
assert.equal(dailyWrites[0].range.startRowIndex,1);
assert.equal(dailyWrites[0].rows[0].values[0].userEnteredValue.numberValue,46317);
assert.deepEqual(dailyWrites[0].rows[0].values[4].userEnteredValue,{stringValue:'=literal'});
assert.equal(dailyWrites[1].rows[0].values.length,16);
assert.equal(dailyWrites[1].rows[0].values[5].userEnteredValue.numberValue,0);
assert(req.some(r=>r.updateCells?.range?.sheetId===11 && !r.updateCells.rows));
assert.equal(ok.state.HYPER_REPORT_SINCE,asOf);
ok.calls.length=0;ok.run();
assert(ok.calls.some(url=>url.includes('date=2026-09-04'))); // queue advances, doesn't starve on first 3
assert(!ok.calls.some(url=>url.includes('date=2026-09-01')));
const failed=harness({fail:true});failed.run();assert.equal(failed.state.HYPER_REPORT_SINCE,undefined);
const malformed=harness({invalid:true});malformed.run();assert.equal(malformed.state.HYPER_REPORT_SINCE,undefined);assert.equal(malformed.writes.length,1); // status error only
const inactive=harness({inactive:true});inactive.run();assert.equal(inactive.calls.length,0);assert.equal(inactive.writes.length,0);
const expired=harness();expired.ctx.syncHyperReportUnlocked_(Date.now()-1);
assert.equal(expired.calls.length,0);assert.equal(expired.writes.length,0);assert.equal(expired.state.HYPER_REPORT_SINCE,undefined);
const defaults=harness();delete defaults.state.HYPER_REPORT_START_DATE;defaults.run();
assert(defaults.calls.some(url=>url.includes('date=2026-10-01')));

// Execute the actual existing trigger entry point with slow raw job adapters.
// Raw jobs and their flush must finish before any aggregate work starts.
const rawSource=readFileSync(new URL('./google-sheets-diagnosis-sync.gs',import.meta.url),'utf8');
function runRawThenAggregate(rawDuration,hyperThrows=false) {
  let clock=0;const events=[];
  class TestDate extends Date {static now(){return clock;}}
  const context=vm.createContext({Date:TestDate,console,
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>events.push('release')})},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>null})},
    SpreadsheetApp:{flush:()=>{events.push('flush');clock=rawDuration;}}});
  vm.runInContext(rawSource,context);
  context.syncJob_=job=>events.push('raw:'+job.apiPath);
  context.syncHyperReportUnlocked_=deadline=>{assert.equal(deadline,300000);events.push('hyper');if(hyperThrows)throw new Error('optional failure');};
  context.syncMetricsRaw();return events;
}
assert.deepEqual(runRawThenAggregate(0).slice(-3),['flush','hyper','release']);
assert(runRawThenAggregate(239999).includes('hyper'));
assert(!runRawThenAggregate(240000).includes('hyper'));
assert(!runRawThenAggregate(350000).includes('hyper'));
assert.deepEqual(runRawThenAggregate(0,true).slice(-3),['flush','hyper','release']);

// Execute the actual route with RPC-only DB adapter. No raw table reads allowed.
const route=readFileSync(new URL('../src/app/api/metrics/hyper-report/route.ts',import.meta.url),'utf8');
const js=ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let rpcCalls=[],authorized=true,rpcError=false;
const exports={};const sandbox={exports,process:{env:{HYPER_REPORT_FX_JPY_PER_UNIT:'{"usd":150}'}},require:name=>{
  if(name==='next/server')return {NextResponse:{json:(body,init)=>({body,...init})}};
  if(name==='@/lib/metrics-access')return {authorizeSheetsMetricsRequest:()=>authorized?{ok:true}:{ok:false,error:'Unauthorized',status:401},metricsPrivateHeaders:{'Cache-Control':'private, no-store'}};
  if(name==='@/lib/supabase-server')return {supabaseAdmin:{rpc:async(name,args)=>{rpcCalls.push([name,args]);return rpcError?{error:{message:'secret'},data:null}:{data:{daily:[],hourly:[],date:args.p_date},error:null};}}};
  throw new Error(name);
}};
vm.runInNewContext(js,sandbox);
const request=query=>({nextUrl:new URL('https://example.test/api/metrics/hyper-report'+query)});
authorized=false;assert.equal((await exports.GET(request(''))).status,401);assert.equal(rpcCalls.length,0);
authorized=true;assert.equal((await exports.GET(request('?date=2026-02-30'))).status,400);
const response=await exports.GET(request('?date=2026-10-22'));assert.equal(response.body.version,1);assert.equal(rpcCalls[0][0],'hyper_report_day');
rpcError=true;const error=await exports.GET(request(''));assert.equal(error.status,503);assert(!JSON.stringify(error).includes('secret'));
console.log('hyper-report Apps Script + API: atomic A:P writes, date values, idempotency, deletion, hourly replacement, checkpoints, auth passed');
