// DRAFT / NOT ACTIVATED: blocked on sharing approval and live reconciliation.
// See docs/daily-three-file-migration.md before installing or running.
// Companion to google-sheets-diagnosis-sync.gs. Keep the existing script project,
// credentials, job page limits, cursors and its ONE 15-minute trigger.
// Before activation: rawSheet_ must use dailyDataSpreadsheet_(), and
// syncMetricsRaw must delegate to syncThreeFileMetrics_() only when
// DAILY_DATA_SPREADSHEET_ID is set. Never run another fetching trigger.
const DAILY_SPLIT = {
  jp: '1J7257eFLp8nhO6aUtZyML6hoNltbjHKg4D-nLkxoKec',
  kr: '13uBekL9JZfzNWFxqiCQHOxTalFxBhx3scWFfdj6cGoU',
  data: '1BKyHPSJCu0fupyCCEDA6VwdXwWHygMwXspFS0h2ZYJI',
  statusId: 260912,
  jobs: ['diagnoses', 'sales', 'shareEvents', 'lineFollowEvents'],
  chunkRows: 5000,
};

function dailyDataSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('DAILY_DATA_SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

// Explicit CellData avoids formula injection and keeps numeric dates numeric.
function dailyCell_(value) {
  if (value === '' || value == null) return {};
  if (value instanceof Date) return {userEnteredValue:{numberValue:value.getTime()/86400000+25569}};
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite raw value');
    return {userEnteredValue:{numberValue:value}};
  }
  if (typeof value === 'boolean') return {userEnteredValue:{boolValue:value}};
  return {userEnteredValue:{stringValue:String(value)}};
}

function dailyWrite_(sheetId, row, column, values) {
  if (!values.length) throw new Error('Empty write');
  const width = values[0].length;
  if (!width || values.some(r=>r.length!==width)) throw new Error('Non-rectangular write');
  return {updateCells:{start:{sheetId:sheetId,rowIndex:row,columnIndex:column},
    rows:values.map(r=>({values:r.map(dailyCell_)})),fields:'userEnteredValue'}};
}

function dailyBatch_(id, requests) {
  if (![DAILY_SPLIT.jp, DAILY_SPLIT.kr, DAILY_SPLIT.data].includes(id)) throw new Error('Unknown destination');
  const response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+id+':batchUpdate', {
    method:'post',contentType:'application/json',
    headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
    payload:JSON.stringify({requests:requests}),muteHttpExceptions:true,
  });
  if (response.getResponseCode()!==200) {
    // Do not log OAuth tokens, private rows or arbitrary response bodies.
    throw new Error('Sheets write failed (HTTP '+response.getResponseCode()+')');
  }
  return JSON.parse(response.getContentText());
}

function dailyStatus_(success, attempt, error, generation) {
  return dailyWrite_(DAILY_SPLIT.statusId,0,0,[
    ['同期状態',error?'同期失敗：直前の成功データを保持':'正常', '', ''],
    ['最終成功日時',success||'未完了','',''],
    ['最終試行日時',attempt,'',''],
    ['エラー',error||'','',''],
    ['世代',generation||'','',''],
    ['同期頻度','15分（既存トリガー1本）','',''],
    ['データ元',DAILY_SPLIT.data,'',''],
  ]);
}

function dailyError_(error) {
  // Fixed error categories; never mistake a service error for missing sharing.
  const message = String(error && error.message || error);
  if (/HTTP (401|403)|permission|権限/i.test(message)) return '認証または編集権限のエラー。実行アカウントを確認。';
  if (/timed out|timeout|時間/i.test(message)) return 'Google Sheetsの処理時間超過。前回成功データを保持。';
  if (/HTTP 429|quota|limit/i.test(message)) return 'Googleサービスの制限。前回成功データを保持。';
  return '同期処理失敗。Apps Script実行履歴を確認。前回成功データを保持。';
}

function dailyReadRows_(sheet, start, end, width) {
  const values=[];
  for(let r=start;r<=end;r+=DAILY_SPLIT.chunkRows) {
    values.push.apply(values,sheet.getRange(r,1,Math.min(DAILY_SPLIT.chunkRows,end-r+1),width).getValues());
  }
  return values;
}

function dailyCountryRows_(key, rows, country) {
  if(country==='jp') return rows; // Preserve JP's existing optional KR views and joins.
  const index={diagnoses:5,sales:18,shareEvents:8}[key];
  return index==null ? [] : rows.filter(r=>r[index]==='ko');
}

// The reporting formulas already implement this disjoint rule. Do not rewrite
// acq_medium/acq_channel in raw data or add Carousel counts twice.
function dailyChannel_(row) {
  if (String(row[6]).toLowerCase()==='tiktok' && /^carousel/i.test(String(row[7]))) return '広告';
  return ['広告','自然流入'].includes(row[9]) ? row[9] : '不明';
}

function dailyEnsureCapacity_(requests, sheet, lastRow, width) {
  const rows=Math.max(lastRow,sheet.getMaxRows());
  const cols=Math.max(width,sheet.getMaxColumns());
  if(rows!==sheet.getMaxRows() || cols!==sheet.getMaxColumns()) requests.push({updateSheetProperties:{
    properties:{sheetId:sheet.getSheetId(),gridProperties:{rowCount:rows,columnCount:cols}},fields:'gridProperties.rowCount,gridProperties.columnCount'}});
}

// Each destination commits all raw changes and its row watermarks in ONE atomic
// Sheets batch. Retrying an ambiguous response reads the committed watermark.
// No input sheet, advertising cost, shared cost, formula or chart is overwritten.
function dailyPublish_(country, hub, generation, now) {
  const dest=SpreadsheetApp.openById(DAILY_SPLIT[country]);
  const stateSheet=dest.getSheetByName('_同期位置');
  if(!stateSheet || !dest.getSheetByName('同期状態')) throw new Error('Destination not initialized');
  const states=stateSheet.getRange(2,1,4,3).getValues();
  const requests=[];
  const next=[];
  DAILY_SPLIT.jobs.forEach((key,index)=>{
    const job=RAW_SYNC_JOBS[key];
    const source=hub.getSheetByName(job.sheetName);
    const last=source.getLastRow();
    if(JSON.stringify(source.getRange(1,1,1,job.headers.length).getValues()[0])!==JSON.stringify(job.headers)) throw new Error('Source header changed');
    const consumed=Number(states[index][1]);
    const written=Number(states[index][2]);
    if(states[index][0]!==key || !Number.isInteger(consumed) || consumed<1 || consumed>last || written<1) throw new Error('Invalid publish watermark');
    if(country==='kr' && key==='lineFollowEvents') {next.push([key,last,1]);return;}
    const target=dest.getSheetByName(job.sheetName);
    if(!target || target.getRange('A1').getFormula()) throw new Error('Raw destination still has an import formula');
    const header=target.getRange(1,1,1,job.headers.length).getValues()[0];
    if(JSON.stringify(header)!==JSON.stringify(job.headers)) throw new Error('Destination header changed');
    const replacement=job.mode==='upsert';
    const rows=dailyCountryRows_(key,dailyReadRows_(source,replacement?2:consumed+1,last,job.headers.length),country);
    if(replacement && written>1 && !rows.length) throw new Error('Unexpected empty sales data');
    const end=(replacement?1:written)+rows.length;
    dailyEnsureCapacity_(requests,target,Math.max(end,written),job.headers.length);
    if(replacement) requests.push({repeatCell:{range:{sheetId:target.getSheetId(),startRowIndex:1,endRowIndex:Math.max(2,written),startColumnIndex:0,endColumnIndex:job.headers.length},cell:{},fields:'userEnteredValue'}});
    if(rows.length) requests.push(dailyWrite_(target.getSheetId(),replacement?1:written,0,rows));
    next.push([key,last,end]);
  });
  requests.push(dailyWrite_(stateSheet.getSheetId(),1,0,next));
  requests.push(dailyStatus_(now,now,'',generation));
  // Native batchUpdate is atomic per spreadsheet (not across JP and KR).
  dailyAssertCellBudget_(dest,requests);
  dailyBatch_(DAILY_SPLIT[country],requests);
}

function syncThreeFileMetrics_() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) return;
  const properties=PropertiesService.getScriptProperties();
  const now=new Date().toISOString();
  const generation=Utilities.getUuid();
  try {
    const hub=dailyDataSpreadsheet_();
    if(hub.getId()!==DAILY_SPLIT.data) throw new Error('Unexpected data spreadsheet');
    const errors=[];
    DAILY_SPLIT.jobs.forEach(key=>{
      try {syncJob_(RAW_SYNC_JOBS[key]);} catch(error) {errors.push(key+': '+dailyError_(error));}
    });
    SpreadsheetApp.flush();
    if(errors.length) throw new Error(errors.join('; '));
    // Exactly one existing syncJob_ pass; no retry, no cursor reset, no backfill.
    properties.setProperty('DAILY_FETCH_SUCCESS',now);
    dailyBatch_(DAILY_SPLIT.data,[dailyStatus_(now,now,'',generation)]);
    const publishErrors=[];
    ['jp','kr'].forEach(country=>{
      try {dailyPublish_(country,hub,generation,now);}
      catch(error) {
        publishErrors.push(country+': '+dailyError_(error));
        dailyRecordFailure_(country,now,dailyError_(error));
      }
    });
    if(publishErrors.length) throw new Error(publishErrors.join('; '));
    properties.setProperty('DAILY_ALL_SUCCESS',now);
    console.log(JSON.stringify({dailySync:'success',at:now,generation:generation,triggerCount:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='syncMetricsRaw').length}));
  } catch(error) {
    ['jp','kr'].forEach(country=>dailyRecordFailure_(country,now,dailyError_(error)));
    try {dailyBatch_(DAILY_SPLIT.data,[dailyStatus_(properties.getProperty('DAILY_FETCH_SUCCESS'),now,dailyError_(error),'')]);} catch(ignored) { /* Execution history remains authoritative. */ }
    throw new Error(dailyError_(error));
  } finally {lock.releaseLock();}
}

function dailyRecordFailure_(country,now,message) {
  try {
    const sh=SpreadsheetApp.openById(DAILY_SPLIT[country]).getSheetByName('同期状態');
    if(!sh) return;
    const last=sh.getRange('B2').getDisplayValue();
    const generation=sh.getRange('B5').getDisplayValue();
    dailyBatch_(DAILY_SPLIT[country],[dailyStatus_(last,now,message,generation)]);
  } catch(ignored) { /* Service outage: leave data/status untouched; trigger logs report failure. */ }
}

// Run only after review, backups, sharing and live source comparison. This
// function performs NO metrics/Vercel request and does not create any trigger.
// It can be rerun before activation after an interrupted preparation.
function prepareDailySplitOnce() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw new Error('Existing sync is running');
  try {
    const properties=PropertiesService.getScriptProperties();
    if(properties.getProperty('DAILY_DATA_SPREADSHEET_ID')) throw new Error('Already activated: do not reinitialize');
    const jp=SpreadsheetApp.getActiveSpreadsheet();
    if(jp.getId()!==DAILY_SPLIT.jp) throw new Error('Run in the existing JP script project');
    const hub=SpreadsheetApp.openById(DAILY_SPLIT.data);
    const kr=SpreadsheetApp.openById(DAILY_SPLIT.kr);
    const triggers=ScriptApp.getProjectTriggers().filter(t=>['syncMetricsRaw','syncDiagnoses'].includes(t.getHandlerFunction()));
    if(triggers.length!==1 || triggers[0].getHandlerFunction()!=='syncMetricsRaw') throw new Error('Inspect duplicate/legacy triggers before migration');
    const preparationStarted=Date.now();
    const sourceCursors=Object.fromEntries(Object.entries(properties.getProperties()).filter(([key])=>key.includes('CURSOR')));
    const statesJP=[],statesKR=[],krData=[];
    DAILY_SPLIT.jobs.forEach(key=>{
      const job=RAW_SYNC_JOBS[key], source=jp.getSheetByName(job.sheetName), copy=hub.getSheetByName(job.sheetName);
      if(!source || !copy) throw new Error('Missing copied raw sheet: '+job.sheetName);
      const last=source.getLastRow(),width=job.headers.length;
      if(last<1 || copy.getLastRow()>last) throw new Error('Unexpected raw length');
      const header=source.getRange(1,1,1,width).getValues()[0];
      if(JSON.stringify(header)!==JSON.stringify(job.headers)) throw new Error('Source header mismatch');
      const korea=[header];
      ensureRows_(copy,last);ensureColumns_(copy,width);
      // Check every copied cell. Only changed chunks are rewritten. Cursor is
      // retained in the original project and advances only in the normal sync.
      for(let row=1;row<=last;row+=DAILY_SPLIT.chunkRows) {
        if(Date.now()-preparationStarted>240000) throw new Error('Preparation time budget reached; no activation');
        const n=Math.min(DAILY_SPLIT.chunkRows,last-row+1);
        const a=source.getRange(row,1,n,width).getValues();
        const b=copy.getRange(row,1,n,width).getValues();
        if(JSON.stringify(a)!==JSON.stringify(b)) {
          copy.getRange(row,1,n,width).setValues(a.map(r=>r.map(safeCellValue_)));
          if(JSON.stringify(copy.getRange(row,1,n,width).getValues())!==JSON.stringify(a)) throw new Error('Copied data mismatch');
        }
        if(key!=='lineFollowEvents') korea.push.apply(korea,dailyCountryRows_(key,row===1?a.slice(1):a,'kr'));
      }
      statesJP.push([key,last,last]);
      statesKR.push([key,last,korea.length]);
      if(key!=='lineFollowEvents') krData.push({job:job,values:korea});
    });
    const now=new Date().toISOString(), generation='migration-'+Utilities.getUuid();
    const reqJP=dailyInitializeState_(jp,statesJP,now,generation);
    const reqKR=dailyInitializeState_(kr,statesKR,now,generation);
    krData.forEach(item=>{
      const sh=kr.getSheetByName(item.job.sheetName);
      if(!sh) throw new Error('Missing KR raw sheet');
      const formula=sh.getRange('A1').getFormula();
      if(formula && (!formula.includes('IMPORTRANGE') || !formula.includes(DAILY_SPLIT.jp))) throw new Error('Unrecognized KR raw formula');
      const last=Math.max(sh.getLastRow(),item.values.length);
      dailyEnsureCapacity_(reqKR,sh,last,item.job.headers.length);
      reqKR.push({repeatCell:{range:{sheetId:sh.getSheetId(),startRowIndex:0,endRowIndex:last,startColumnIndex:0,endColumnIndex:item.job.headers.length},cell:{},fields:'userEnteredValue'}});
      reqKR.push(dailyWrite_(sh.getSheetId(),0,0,item.values));
    });
    const jpSummary=kr.getSheetByName('_JP集計');
    if(!jpSummary) throw new Error('Missing JP summary mirror');
    reqKR.push(dailyWrite_(jpSummary.getSheetId(),0,0,jp.getSheetByName('日報_JP').getRange('A1:G36').getValues()));
    const connection=kr.getSheetByName('接続設定');
    reqKR.push(dailyWrite_(connection.getSheetId(),0,0,[
      ['Apps Script配信','最終結果は「同期状態」で確認',''],
      ['IMPORTRANGEを使用しません','',''],['同期失敗時は直前の正常データを保持','',''],
      ['共通費はJPで一度だけ計上','',''],['売上のKRW→JPY換算は日報のI2を使用','',''],
      ['広告費はこのファイルの広告日報で入力','',''],['','',''],['作成時点の控えは退避用として保持','',''],
    ]));
    reqKR.push({updateCells:{start:{sheetId:kr.getSheetByName('日報_全体').getSheetId(),rowIndex:2,columnIndex:0},rows:[{values:[{userEnteredValue:{formulaValue:'="同期："&\'同期状態\'!B1&" ／ 最終成功："&\'同期状態\'!B2'}}]}],fields:'userEnteredValue'}});
    // All pre-existing input costs remain outside these requests.
    dailyAssertCellBudget_(jp,reqJP);dailyAssertCellBudget_(kr,reqKR);
    dailyBatch_(DAILY_SPLIT.jp,reqJP);
    dailyBatch_(DAILY_SPLIT.kr,reqKR);
    const after=Object.fromEntries(Object.entries(properties.getProperties()).filter(([key])=>key.includes('CURSOR')));
    if(JSON.stringify(sourceCursors)!==JSON.stringify(after)) throw new Error('Cursor changed unexpectedly');
    // Leave the legacy fetching path active until the separate activation check.
    properties.setProperty('DAILY_PREPARED',JSON.stringify({at:now,generation:generation,cursors:sourceCursors,states:statesJP}));
    console.log(JSON.stringify({dailyPreparation:'complete',at:now,statesJP:statesJP,statesKR:statesKR,triggerId:triggers[0].getUniqueId()}));
  } finally {lock.releaseLock();}
}

function dailyInitializeState_(ss,rows,now,generation) {
  const requests=[];
  let state=ss.getSheetByName('_同期位置');
  const stateId=state?state.getSheetId():260913;
  if(!state) requests.push({addSheet:{properties:{sheetId:stateId,title:'_同期位置',hidden:true,gridProperties:{rowCount:5,columnCount:3}}}});
  let status=ss.getSheetByName('同期状態');
  if(status && status.getSheetId()!==DAILY_SPLIT.statusId) throw new Error('Unexpected status sheet ID');
  if(!status) requests.push({addSheet:{properties:{sheetId:DAILY_SPLIT.statusId,title:'同期状態',gridProperties:{rowCount:12,columnCount:4}}}});
  requests.push(dailyWrite_(stateId,0,0,[['job','source_last_row','destination_last_row']].concat(rows)));
  requests.push(dailyStatus_(now,now,'',generation));
  return requests;
}

function dailyAssertCellBudget_(ss,requests) {
  const sizes={};
  ss.getSheets().forEach(sh=>sizes[sh.getSheetId()]=[sh.getMaxRows(),sh.getMaxColumns()]);
  requests.forEach(r=>{
    const p=r.addSheet?.properties || r.updateSheetProperties?.properties;
    if(p?.gridProperties) sizes[p.sheetId]=[p.gridProperties.rowCount||sizes[p.sheetId]?.[0],p.gridProperties.columnCount||sizes[p.sheetId]?.[1]];
  });
  const cells=Object.values(sizes).reduce((sum,[r,c])=>sum+r*c,0);
  if(!Number.isFinite(cells) || cells>9900000) throw new Error('Spreadsheet cell budget exceeded');
}

// Run immediately after preparation + reconciliation. If an old trigger ran
// between them, repeat preparation to catch up using Sheets data, never refetch.
function activateDailySplit() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) throw new Error('Existing sync is running');
  try {
    const p=PropertiesService.getScriptProperties();
    const saved=JSON.parse(p.getProperty('DAILY_PREPARED')||'null');
    if(!saved || p.getProperty('DAILY_DATA_SPREADSHEET_ID')) throw new Error('Not ready for activation');
    Object.entries(saved.cursors).forEach(([key,value])=>{if(p.getProperty(key)!==value) throw new Error('Source advanced; repeat preparation');});
    const triggers=ScriptApp.getProjectTriggers().filter(t=>['syncMetricsRaw','syncDiagnoses'].includes(t.getHandlerFunction()));
    if(triggers.length!==1 || triggers[0].getHandlerFunction()!=='syncMetricsRaw') throw new Error('Trigger mismatch');
    // Mandatory operator verification marker, set only after numeric reconciliation.
    if(p.getProperty('DAILY_VERIFIED_GENERATION')!==saved.generation) throw new Error('Reconciliation not signed off');
    p.setProperty('DAILY_DATA_SPREADSHEET_ID',DAILY_SPLIT.data);
    console.log('Activated; wait for the existing 15-minute trigger. No extra API run.');
  } finally {lock.releaseLock();}
}
