// Google Sheets の「拡張機能 > Apps Script」に貼り付けて使う。
// 初回手順:
// 1. スクリプト プロパティ SHEETS_METRICS_KEY を設定する。
// 2. syncMetricsRaw を1回手動実行し、権限を承認する。
// 3. createQuarterHourlyTrigger を1回手動実行する。

const RAW_SYNC_BASE_URL = "https://www.watashi-torisetsu.com/api/metrics/";

const RAW_SYNC_JOBS = {
  diagnoses: {
    apiPath: "diagnoses",
    sheetName: "diagnoses_raw",
    headers: [
      "completed_at",
      "date_jst",
      "hour_jst",
      "diagnosis_ref",
      "type_id",
      "locale",
      "acq_source",
      "acq_campaign",
    ],
    referenceColumn: 4,
    cursorAtProperty: "DIAGNOSIS_CURSOR_AT",
    cursorIdProperty: "DIAGNOSIS_CURSOR_ID",
    initialLookbackDays: 2,
    pageSize: 500,
    maxPagesPerRun: 10,
    recentReferenceWindow: 5000,
    mode: "append",
  },
  sales: {
    apiPath: "sales",
    sheetName: "sales_raw",
    headers: [
      "updated_at",
      "paid_at",
      "date_jst",
      "hour_jst",
      "payment_ref",
      "user_ref",
      "product",
      "payment_kind",
      "currency",
      "gross_jpy",
      "refunded_jpy",
      "net_jpy",
      "status",
      "refunded_at",
      "source",
      "paywall_version",
      "placement",
      "return_to",
      "locale",
      "upgrade_from",
    ],
    referenceColumn: 5,
    cursorAtProperty: "SALES_CURSOR_AT",
    cursorIdProperty: "SALES_CURSOR_ID",
    initialLookbackDays: 3650,
    pageSize: 500,
    maxPagesPerRun: 5,
    mode: "upsert",
  },
  shareEvents: {
    apiPath: "share-events",
    sheetName: "share_events_raw",
    headers: [
      "created_at",
      "date_jst",
      "hour_jst",
      "event_ref",
      "event_name",
      "session_ref",
      "owner_ref",
      "invite_ref",
      "locale",
      "kind",
      "source",
      "channel",
      "type_id",
      "funnel_version",
    ],
    referenceColumn: 4,
    cursorAtProperty: "SHARE_CURSOR_AT",
    cursorIdProperty: "SHARE_CURSOR_ID",
    initialLookbackDays: 30,
    pageSize: 500,
    maxPagesPerRun: 10,
    recentReferenceWindow: 5000,
    mode: "append",
  },
  productEvents: {
    apiPath: "product-events",
    sheetName: "product_events_raw",
    headers: [
      "created_at",
      "date_jst",
      "hour_jst",
      "event_ref",
      "event_name",
      "journey",
      "session_ref",
      "owner_ref",
      "payment_ref",
      "locale",
      "product",
      "page",
      "surface",
      "source",
      "return_to",
      "ui",
      "access_state",
      "payment_method",
      "plan",
      "placement",
      "variant",
    ],
    referenceColumn: 4,
    cursorAtProperty: "PRODUCT_EVENT_CURSOR_AT",
    cursorIdProperty: "PRODUCT_EVENT_CURSOR_ID",
    initialLookbackDays: 30,
    pageSize: 500,
    maxPagesPerRun: 10,
    recentReferenceWindow: 5000,
    mode: "append",
    // Web側のデプロイ前でも既存3同期をエラー扱いにせず、次回また試す。
    ignoreNotFound: true,
  },
};

function metricsAuthorizedFetch_(url) {
  const properties = PropertiesService.getScriptProperties();
  // 新規設定はSheets専用キーを使う。METRICS_KEYは旧設定からの移行期間だけ
  // 互換用として受け付ける。
  const key =
    properties.getProperty("SHEETS_METRICS_KEY") ||
    properties.getProperty("METRICS_KEY");
  if (!key) {
    throw new Error(
      "スクリプト プロパティ SHEETS_METRICS_KEY が未設定です",
    );
  }
  return UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + key },
    muteHttpExceptions: true,
  });
}

function rawSheet_(job) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(job.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(job.sheetName);

  if (sheet.getLastRow() === 0) {
    ensureRows_(sheet, 1);
    sheet.getRange(1, 1, 1, job.headers.length).setValues([job.headers]);
    sheet.setFrozenRows(1);
    sheet
      .getRange(1, 1, 1, job.headers.length)
      .setFontWeight("bold")
      .setBackground("#f3f0ff");
  } else {
    const currentHeaders = sheet
      .getRange(1, 1, 1, job.headers.length)
      .getDisplayValues()[0];
    if (JSON.stringify(currentHeaders) !== JSON.stringify(job.headers)) {
      throw new Error(job.sheetName + " の列定義がAPIと一致しません");
    }
  }

  return sheet;
}

function ensureRows_(sheet, requiredLastRow) {
  const shortage = requiredLastRow - sheet.getMaxRows();
  if (shortage > 0) sheet.insertRowsAfter(sheet.getMaxRows(), shortage);
}

function initialCursor_(job) {
  return new Date(
    Date.now() - job.initialLookbackDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function recentReferences_(sheet, job) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  const firstRow = Math.max(2, lastRow - job.recentReferenceWindow + 1);
  const values = sheet
    .getRange(firstRow, job.referenceColumn, lastRow - firstRow + 1, 1)
    .getDisplayValues();
  return new Set(values.flat().filter(String));
}

function allReferenceRows_(sheet, job) {
  const rowsByReference = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return rowsByReference;
  const values = sheet
    .getRange(2, job.referenceColumn, lastRow - 1, 1)
    .getDisplayValues();
  values.forEach(function (row, index) {
    if (row[0]) rowsByReference.set(row[0], index + 2);
  });
  return rowsByReference;
}

// 先頭が数式として解釈され得る文字列は、生値のまま保存する。
function safeCellValue_(value) {
  if (value == null) return "";
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function rowValues_(row, headers) {
  return headers.map(function (column) {
    return safeCellValue_(row[column]);
  });
}

function fetchPage_(job, cursorAt, cursorId) {
  let url =
    RAW_SYNC_BASE_URL +
    job.apiPath +
    "?after=" +
    encodeURIComponent(cursorAt) +
    "&limit=" +
    job.pageSize;
  if (cursorId) url += "&after_id=" + encodeURIComponent(cursorId);

  const response = metricsAuthorizedFetch_(url);
  if (response.getResponseCode() === 404 && job.ignoreNotFound) {
    return { columns: job.headers, rows: [], nextCursor: null, hasMore: false };
  }
  if (response.getResponseCode() !== 200) {
    throw new Error(
      job.sheetName +
        " sync failed: " +
        response.getResponseCode() +
        " " +
        response.getContentText(),
    );
  }

  const payload = JSON.parse(response.getContentText());
  if (JSON.stringify(payload.columns) !== JSON.stringify(job.headers)) {
    throw new Error(job.sheetName + " の列定義がAPIと一致しません");
  }
  return payload;
}

function saveCursor_(properties, job, cursor) {
  properties.setProperties({
    [job.cursorAtProperty]: cursor.at,
    [job.cursorIdProperty]: cursor.id,
  });
}

function appendRows_(sheet, job, rows, knownReferences) {
  const values = [];
  rows.forEach(function (row) {
    const reference = row[job.headers[job.referenceColumn - 1]];
    if (!reference || knownReferences.has(reference)) return;
    knownReferences.add(reference);
    values.push(rowValues_(row, job.headers));
  });
  if (values.length === 0) return;

  const firstRow = sheet.getLastRow() + 1;
  ensureRows_(sheet, firstRow + values.length - 1);
  sheet
    .getRange(firstRow, 1, values.length, job.headers.length)
    .setValues(values);
}

function upsertRows_(sheet, job, rows, rowsByReference) {
  const newValues = [];
  rows.forEach(function (row) {
    const reference = row[job.headers[job.referenceColumn - 1]];
    if (!reference) return;
    const values = rowValues_(row, job.headers);
    const existingRow = rowsByReference.get(reference);
    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, job.headers.length).setValues([values]);
    } else {
      newValues.push(values);
    }
  });

  if (newValues.length === 0) return;
  const firstRow = sheet.getLastRow() + 1;
  ensureRows_(sheet, firstRow + newValues.length - 1);
  sheet
    .getRange(firstRow, 1, newValues.length, job.headers.length)
    .setValues(newValues);
  newValues.forEach(function (values, index) {
    rowsByReference.set(values[job.referenceColumn - 1], firstRow + index);
  });
}

// 前回カーソル以降だけを取得し、1ページずつ一括追記または更新する。
function syncJob_(job) {
  const properties = PropertiesService.getScriptProperties();
  const sheet = rawSheet_(job);
  const references =
    job.mode === "upsert"
      ? allReferenceRows_(sheet, job)
      : recentReferences_(sheet, job);
  let cursorAt =
    properties.getProperty(job.cursorAtProperty) || initialCursor_(job);
  let cursorId = properties.getProperty(job.cursorIdProperty) || "";

  for (let pageIndex = 0; pageIndex < job.maxPagesPerRun; pageIndex++) {
    const payload = fetchPage_(job, cursorAt, cursorId);
    const rows = payload.rows || [];
    if (job.mode === "upsert") {
      upsertRows_(sheet, job, rows, references);
    } else {
      appendRows_(sheet, job, rows, references);
    }

    if (!payload.nextCursor) break;
    cursorAt = payload.nextCursor.at;
    cursorId = payload.nextCursor.id;
    // シート書き込みが成功したページ単位で位置を保存する。
    saveCursor_(properties, job, payload.nextCursor);
    if (!payload.hasMore) break;
  }
}

// この1関数を15分ごとに実行し、4種類の生データを同期する。
function syncMetricsRaw() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;

  try {
    SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone("Asia/Tokyo");
    const errors = [];
    Object.keys(RAW_SYNC_JOBS).forEach(function (key) {
      try {
        syncJob_(RAW_SYNC_JOBS[key]);
      } catch (error) {
        errors.push(key + ": " + error.message);
      }
    });
    SpreadsheetApp.flush();
    if (errors.length > 0) throw new Error(errors.join("\n"));
  } finally {
    lock.releaseLock();
  }
}

// 旧手順から実行しても、現在の4種類同期を行う。
function syncDiagnoses() {
  syncMetricsRaw();
}

// 二重登録を避けて、15分間隔のトリガーを1つだけ作る。
function createQuarterHourlyTrigger() {
  const handlers = new Set(["syncDiagnoses", "syncMetricsRaw"]);
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return handlers.has(trigger.getHandlerFunction());
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger("syncMetricsRaw").timeBased().everyMinutes(15).create();
}
