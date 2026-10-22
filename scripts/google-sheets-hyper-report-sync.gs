// Add this file to the EXISTING Apps Script project. Do not create a trigger.
// HYPER_REPORT_ACTIVE=1 opts in. Existing raw jobs/cursors stay independent.
var HYPER_REPORT_BOOK_ = '177UacI6un8hb2B01O0xkiFtPm9-IoSxMBn3gxIi-sLg';
var HYPER_DAILY_COLUMNS_ = ['date','country','source','medium','campaign','diagnoses','purchases_full','purchases_upsell','purchases_total','revenue_jpy','line_follows','sub_starts','ad_spend_jpy','impressions','clicks','updated_at'];
var HYPER_HOURLY_COLUMNS_ = ['date','hour','country','source','medium','campaign','diagnoses','purchases_total','revenue_jpy','ad_spend_jpy','updated_at'];

function hyperFetch_(query) {
  var response = metricsAuthorizedFetch_(RAW_SYNC_BASE_URL + 'hyper-report?' + query);
  if (response.getResponseCode() !== 200) throw new Error('集計API HTTP ' + response.getResponseCode());
  var data = JSON.parse(response.getContentText());
  if (data.version !== 1) throw new Error('集計APIのバージョンが不一致');
  return data;
}

function hyperDate_(value) {
  return value instanceof Date ? Utilities.formatDate(value, 'Asia/Tokyo', 'yyyy-MM-dd') : String(value);
}

function hyperShiftDate_(day, delta) {
  return new Date(Date.parse(day + 'T00:00:00Z') + delta * 86400000).toISOString().slice(0,10);
}

function hyperKey_(row, width) {
  return JSON.stringify([hyperDate_(row[0])].concat(row.slice(1,width)));
}

function hyperSerial_(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || hyperShiftDate_(day,0) !== day) throw new Error('日付形式が不正');
  return Date.parse(day + 'T00:00:00Z') / 86400000 + 25569;
}

function hyperCell_(value) {
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('集計値が数値ではありません');
    return {userEnteredValue:{numberValue:value}};
  }
  // stringValue prevents campaign/source values beginning with '=' becoming formulas.
  return {userEnteredValue:{stringValue:String(value == null ? '' : value)}};
}

function hyperRows_(rows, columns, date) {
  var keys = {};
  return rows.map(function (row) {
    if (row.date !== date || !/^(jp|kr|us)$/.test(row.country)) throw new Error('集計キーが不正');
    var values = columns.map(function (column, index) {
      if (index === 0) return hyperSerial_(row.date);
      var value = row[column];
      if (['source','medium','campaign','country','updated_at'].indexOf(column) >= 0) {
        if (typeof value !== 'string') throw new Error('集計列が不正');
        return value;
      }
      if (typeof value !== 'number' || !isFinite(value) || value < 0) throw new Error('集計値が不正');
      if (column === 'hour' && (!Number.isInteger(value) || value > 23)) throw new Error('時間が不正');
      return value;
    });
    var key = JSON.stringify(values.slice(0,columns === HYPER_DAILY_COLUMNS_ ? 5 : 6));
    if (keys[key]) throw new Error('集計キーが重複');
    keys[key] = true;
    return values;
  });
}

function hyperWrite_(id, startRow, rows, width) {
  return {updateCells:{range:{sheetId:id,startRowIndex:startRow,endRowIndex:startRow+rows.length,startColumnIndex:0,endColumnIndex:width},
    rows:rows.map(function (r) { return {values:r.map(hyperCell_)}; }),fields:'userEnteredValue'}};
}

function hyperSheetsRequest_(body) {
  var response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + HYPER_REPORT_BOOK_ + ':batchUpdate', {
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
    payload:JSON.stringify(body),muteHttpExceptions:true
  });
  if (response.getResponseCode() !== 200) throw new Error('Sheets API HTTP '+response.getResponseCode());
}

function hyperStatusError_() {
  // Safe, fixed message: exception bodies can contain credentials or raw API data.
  hyperSheetsRequest_({requests:[{updateCells:{start:{sheetId:13,rowIndex:4,columnIndex:1},
    rows:[{values:[hyperCell_('同期失敗。集計API・円換算設定・シートの列と権限を確認してください')]}],fields:'userEnteredValue'}}]});
}

function syncHyperReportUnlocked_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('HYPER_REPORT_ACTIVE') !== '1') return;
  try {
    var deadline = Date.now()+45000;
    var book = SpreadsheetApp.openById(HYPER_REPORT_BOOK_);
    if (book.getSpreadsheetTimeZone() !== 'Asia/Tokyo') throw new Error('シートのタイムゾーンが不一致');
    var daily = book.getSheetByName('data_daily'), hourly = book.getSheetByName('data_hourly'), status = book.getSheetByName('同期状態');
    if (!daily || !hourly || !status || status.getSheetId() !== 13) throw new Error('同期タブが不一致');
    [ [daily,HYPER_DAILY_COLUMNS_], [hourly,HYPER_HOURLY_COLUMNS_] ].forEach(function (entry) {
      if (JSON.stringify(entry[0].getRange(1,1,1,entry[1].length).getValues()[0]) !== JSON.stringify(entry[1])) throw new Error('列順が不一致');
    });
    var since = props.getProperty('HYPER_REPORT_SINCE') || '';
    var plan = hyperFetch_('since=' + encodeURIComponent(since));
    if (!Array.isArray(plan.dates) || !Number.isFinite(Date.parse(plan.as_of))) throw new Error('同期計画が不正');
    hyperSerial_(plan.today);
    var versions = {};
    var queue = plan.dates.filter(function (entry) {
      hyperSerial_(entry.date);
      if (!Number.isFinite(Date.parse(entry.version))) throw new Error('更新バージョンが不正');
      versions[entry.date] = entry.version;
      return props.getProperty('HYPER_REPORT_DAY_VERSION_'+entry.date) !== entry.version;
    }).map(function (entry) { return entry.date; }).sort();
    var backfill = props.getProperty('HYPER_REPORT_BACKFILL_NEXT') || props.getProperty('HYPER_REPORT_START_DATE') || (plan.today.slice(0,4)+'-01-01');
    hyperSerial_(backfill);
    var dates = [plan.today,hyperShiftDate_(plan.today,-1),hyperShiftDate_(plan.today,-2)].concat(queue.slice(0,3));
    var next = backfill;
    for (var i=0;i<3 && next<=plan.today;i++) { dates.push(next); next=hyperShiftDate_(next,1); }
    dates = Array.from(new Set(dates));
    var incoming = [], hourRows = [], ads = null;
    dates.forEach(function (date) {
      if (Date.now()>deadline) throw new Error('集計同期の実行時間制限');
      var payload = hyperFetch_('date='+date);
      if (!Array.isArray(payload.daily) || !Array.isArray(payload.hourly) || payload.date !== date) throw new Error('集計応答が不正');
      incoming = incoming.concat(hyperRows_(payload.daily,HYPER_DAILY_COLUMNS_,date));
      if (date >= hyperShiftDate_(plan.today,-1) && date <= plan.today) hourRows = hourRows.concat(hyperRows_(payload.hourly,HYPER_HOURLY_COLUMNS_,date));
      if (ads === null) ads = payload.ad_status;
      // All days must use the same ad status; freshness is provider fetch time, never now.
      else if (JSON.stringify(ads) !== JSON.stringify(payload.ad_status)) throw new Error('広告同期が更新中のため再試行');
    });
    var old = daily.getLastRow()>1 ? daily.getRange(2,1,daily.getLastRow()-1,16).getValues() : [];
    var index = {}, requests = [], used = {}, lastRow = old.length+1;
    old.forEach(function (r,i) {
      if (r[0] === '') return;
      var key = hyperKey_(r,5);
      if (index[key] !== undefined) throw new Error('既存の集計キーが重複');
      index[key] = i+1;
    });
    incoming.forEach(function (r) {
      // Sheets serials are numeric on write, Dates on SpreadsheetApp read.
      var key = JSON.stringify([new Date((r[0]-25569)*86400000).toISOString().slice(0,10)].concat(r.slice(1,5)));
      var at = index[key] === undefined ? lastRow++ : index[key];
      used[key] = true;
      requests.push(hyperWrite_(daily.getSheetId(),at,[r],16));
    });
    // Zero disappeared keys in refreshed days (refund/deletion/attribution correction).
    old.forEach(function (r,i) {
      if (r[0] === '' || dates.indexOf(hyperDate_(r[0])) < 0 || used[hyperKey_(r,5)]) return;
      requests.push(hyperWrite_(daily.getSheetId(),i+1,[[hyperSerial_(hyperDate_(r[0]))].concat(r.slice(1,5),[0,0,0,0,0,0,0,0,0,0,plan.as_of])],16));
    });
    var neededDaily = lastRow, neededHourly = hourRows.length+1;
    if (neededDaily>daily.getMaxRows()) requests.unshift({appendDimension:{sheetId:daily.getSheetId(),dimension:'ROWS',length:neededDaily-daily.getMaxRows()}});
    if (neededHourly>hourly.getMaxRows()) requests.unshift({appendDimension:{sheetId:hourly.getSheetId(),dimension:'ROWS',length:neededHourly-hourly.getMaxRows()}});
    // A:P only. Never clear, format, insert columns, or write data_daily Q.
    if (lastRow>1) requests.push({repeatCell:{range:{sheetId:daily.getSheetId(),startRowIndex:1,endRowIndex:lastRow,startColumnIndex:0,endColumnIndex:1},cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'yyyy/mm/dd'}}},fields:'userEnteredFormat.numberFormat'}});
    var clearEnd = Math.max(hourly.getLastRow(),neededHourly);
    if (clearEnd>1) requests.push({updateCells:{range:{sheetId:hourly.getSheetId(),startRowIndex:1,endRowIndex:clearEnd,startColumnIndex:0,endColumnIndex:11},fields:'userEnteredValue'}});
    if (hourRows.length) {
      requests.push(hyperWrite_(hourly.getSheetId(),1,hourRows,11));
      requests.push({repeatCell:{range:{sheetId:hourly.getSheetId(),startRowIndex:1,endRowIndex:neededHourly,startColumnIndex:0,endColumnIndex:1},cell:{userEnteredFormat:{numberFormat:{type:'DATE',pattern:'yyyy/mm/dd'}}},fields:'userEnteredFormat.numberFormat'}});
    }
    var remaining = queue.filter(function (day) { return dates.indexOf(day)<0; });
    if (remaining.length) console.log('hyper-report: 過去更新の残り'+remaining.length+'日');
    requests.push({updateCells:{range:{sheetId:status.getSheetId(),startRowIndex:1,endRowIndex:5,startColumnIndex:1,endColumnIndex:2},
      rows:[plan.as_of,ads && ads.synced_at || '',ads && ads.source || '未接続（段階1）',''].map(function (v) {return {values:[hyperCell_(v)]};}),fields:'userEnteredValue'}});
    // Atomic publish: daily, hourly, status either all apply or none apply.
    hyperSheetsRequest_({requests:requests});
    // Ambiguous/failed HTTP never advances checkpoints. Repeating is idempotent.
    var checkpoints = {HYPER_REPORT_BACKFILL_NEXT:next,HYPER_REPORT_SINCE:plan.as_of};
    dates.forEach(function (day) { if (versions[day]) checkpoints['HYPER_REPORT_DAY_VERSION_'+day] = versions[day]; });
    props.setProperties(checkpoints);
  } catch (error) {
    try { hyperStatusError_(); } catch (_) { /* Preserve existing jobs even if status cannot be written. */ }
    console.warn('hyper-report: 同期失敗（既存同期を継続）');
  }
}

function syncHyperReportOnce() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { syncHyperReportUnlocked_(); } finally { lock.releaseLock(); }
}
