import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({Date,Number,JSON,String,Object,Array,Math,Set,console});
vm.runInContext(fs.readFileSync(new URL('./google-sheets-three-file-sync.gs',import.meta.url),'utf8'),context);
const plain=v=>JSON.parse(JSON.stringify(v));
const row=(source,campaign,channel)=>['',46277,23,'ref','type','ko',source,campaign,'',channel];
for(const [source,campaign,channel,want] of [
 ['tiktok','Carousel_KR','広告','広告'],['tiktok','Carousel_KR','自然流入','広告'],
 ['tiktok','CarouselTest','','広告'],['tiktok','other','','不明'],
 ['meta','Carousel_KR','','不明'],['tiktok','other','自然流入','自然流入'],
 ['tiktok','','不明','不明'],['','other','','不明'],
]) assert.equal(context.dailyChannel_(row(source,campaign,channel)),want);
const mixed=[row('tiktok','Carousel_KR','広告'),row('tiktok','other','自然流入'),row('tiktok','other','')];
const counts=mixed.reduce((a,r)=>(a[context.dailyChannel_(r)]++,a),{'広告':0,'自然流入':0,'不明':0});
assert.deepEqual(counts,{'広告':1,'自然流入':1,'不明':1});
assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),mixed.length);
assert.deepEqual(plain(context.dailyCell_('=IMPORTXML("x")')),{userEnteredValue:{stringValue:'=IMPORTXML("x")'}});
assert.deepEqual(plain(context.dailyCell_(4900)),{userEnteredValue:{numberValue:4900}});
assert.deepEqual(plain(context.dailyCell_(false)),{userEnteredValue:{boolValue:false}});
assert.throws(()=>context.dailyCell_(NaN));
assert.throws(()=>context.dailyWrite_(1,0,0,[[1],[1,2]]));
assert.throws(()=>context.dailyWrite_(1,0,0,[]));
const jp=row('','', '');jp[5]='ja';
assert.equal(context.dailyCountryRows_('diagnoses',[jp,...mixed],'kr').length,3);
assert.equal(context.dailyCountryRows_('diagnoses',[jp,...mixed],'jp').length,4);
assert.equal(context.dailyCountryRows_('lineFollowEvents',mixed,'kr').length,0);
assert.match(context.dailyError_(new Error('Service timed out: Spreadsheets')),/処理時間超過/);
assert.doesNotMatch(context.dailyError_(new Error('Import Range internal error.')),/権限|アクセス未許可/);
assert.match(context.dailyError_(new Error('Sheets write failed (HTTP 403)')),/権限/);
let requests=[];
context.ScriptApp={getOAuthToken:()=> 'test-token'};
context.UrlFetchApp={fetch:(url,args)=>{
 requests.push({url,args});
 return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({replies:[]})};
}};
const id='13uBekL9JZfzNWFxqiCQHOxTalFxBhx3scWFfdj6cGoU';
context.dailyBatch_(id,[context.dailyWrite_(842556864,1,0,[mixed[0]])]);
assert.equal(requests.length,1);
assert.ok(requests[0].url.startsWith('https://sheets.googleapis.com/'));
assert.equal(JSON.parse(requests[0].args.payload).requests[0].updateCells.fields,'userEnteredValue');
assert.throws(()=>context.dailyBatch_('unapproved-id',[]));
context.UrlFetchApp.fetch=()=>({getResponseCode:()=>503,getContentText:()=> 'private-body-not-to-log'});
assert.throws(()=>context.dailyBatch_(id,[]),e=>e.message.includes('503')&&!e.message.includes('private-body'));
const sheet=(id,rows,cols)=>({getSheetId:()=>id,getMaxRows:()=>rows,getMaxColumns:()=>cols});
assert.throws(()=>context.dailyAssertCellBudget_({getSheets:()=>[sheet(1,500000,20)]},[]));
context.dailyAssertCellBudget_({getSheets:()=>[sheet(1,117687,10),sheet(2,307428,14)]},[]);
const capacity=[];context.dailyEnsureCapacity_(capacity,sheet(1,10,10),11,10);
assert.equal(capacity[0].updateSheetProperties.properties.gridProperties.rowCount,11);
console.log('PASS: disjoint Carousel classification, locale filtering, currency/date value preservation, formula injection, error categories, destination allowlist, cell budget, minimal growth.');
console.log('NOT TESTED: live migration, transaction rollback/retry, Apps Script authorization, trigger execution, full numeric reconciliation.');
