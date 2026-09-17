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
      "acq_medium",
      "acq_channel",
    ],
    // 旧8列APIにも対応。Apps Scriptを先に更新してからWebを配布する。
    legacyHeaderCount: 8,
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
    // 大きな日報への500行一括書き込みはSpreadsheetAppでタイムアウトする。
    // 連続setValuesもタイムアウトするため、1実行につき1ページに抑える。
    pageSize: 100,
    maxPagesPerRun: 1,
    recentReferenceWindow: 1000,
    mode: "append",
  },
  lineFollowEvents: {
    apiPath: "line-follow-events",
    sheetName: "line_follow_raw",
    headers: [
      "created_at",
      "date_jst",
      "hour_jst",
      "event_ref",
      "event_name",
      "line_user_ref",
      "relink",
    ],
    referenceColumn: 4,
    cursorAtProperty: "LINE_FOLLOW_CURSOR_AT",
    cursorIdProperty: "LINE_FOLLOW_CURSOR_ID",
    initialLookbackDays: 30,
    pageSize: 50,
    maxPagesPerRun: 1,
    recentReferenceWindow: 500,
    mode: "append",
    // Web側のデプロイ前は空振りとして扱い、既存同期を止めない。
    ignoreNotFound: true,
  },
  productEvents: {
    enabled: false,
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
    ensureColumns_(sheet, job.headers.length);
    sheet.getRange(1, 1, 1, job.headers.length).setValues([job.headers]);
    sheet.setFrozenRows(1);
    sheet
      .getRange(1, 1, 1, job.headers.length)
      .setFontWeight("bold")
      .setBackground("#f3f0ff");
  } else {
    const currentHeaders = sheet
      .getRange(1, 1, 1, Math.min(sheet.getMaxColumns(), job.headers.length))
      .getDisplayValues()[0];
    if (JSON.stringify(currentHeaders) !== JSON.stringify(job.headers)) {
      const legacyCount = job.legacyHeaderCount;
      const isLegacy = legacyCount &&
        JSON.stringify(currentHeaders.slice(0, legacyCount)) === JSON.stringify(job.headers.slice(0, legacyCount)) &&
        currentHeaders.slice(legacyCount).every(function (value) { return value === ""; });
      if (!isLegacy) throw new Error(job.sheetName + " の列定義がAPIと一致しません");
      // 列挿入ではなく末尾拡張。既存列・過去行・カーソルは動かさない。
      // 無題の既存データがあれば上書きせず停止する。
      const existingExtraColumns = Math.min(sheet.getMaxColumns(), job.headers.length) - legacyCount;
      if (existingExtraColumns > 0 && !sheet.getRange(1, legacyCount + 1, Math.max(1, sheet.getLastRow()), existingExtraColumns).isBlank()) {
        throw new Error(job.sheetName + " の追加列に既存データがあります");
      }
      ensureColumns_(sheet, job.headers.length);
      sheet.getRange(1, legacyCount + 1, 1, job.headers.length - legacyCount)
        .setValues([job.headers.slice(legacyCount)]);
    }
  }

  return sheet;
}

function ensureColumns_(sheet, requiredColumns) {
  const shortage = requiredColumns - sheet.getMaxColumns();
  if (shortage > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), shortage);
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

function fetchPage_(job, cursorAt, cursorId, pageSize) {
  let url =
    RAW_SYNC_BASE_URL +
    job.apiPath +
    "?after=" +
    encodeURIComponent(cursorAt) +
    "&limit=" +
    (pageSize || job.pageSize);
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
    const isLegacy = job.legacyHeaderCount && JSON.stringify(payload.columns) ===
      JSON.stringify(job.headers.slice(0, job.legacyHeaderCount));
    if (!isLegacy) throw new Error(job.sheetName + " の列定義がAPIと一致しません");
    payload.rows = (payload.rows || []).map(function (row) {
      return Object.assign({}, row, { acq_medium: "", acq_channel: "不明" });
    });
  }
  return payload;
}

function saveCursor_(properties, job, cursor) {
  properties.setProperties({
    [job.cursorAtProperty]: cursor.at,
    [job.cursorIdProperty]: cursor.id,
  });
}

function appendRows_(sheet, job, rows, knownReferences, restContext) {
  const values = [];
  rows.forEach(function (row) {
    const reference = row[job.headers[job.referenceColumn - 1]];
    if (!reference || knownReferences.has(reference)) return;
    knownReferences.add(reference);
    values.push(rowValues_(row, job.headers));
  });
  if (values.length === 0) return;

  if (restContext) {
    appendRowsViaSheetsApi_(sheet, job, restContext.nextRow, values);
    restContext.nextRow += values.length;
    return;
  }

  const firstRow = sheet.getLastRow() + 1;
  if (job.apiPath === "share-events") console.log("share: ensure rows");
  ensureRows_(sheet, firstRow + values.length - 1);
  if (job.apiPath === "share-events") console.log("share: set values");
  sheet
    .getRange(firstRow, 1, values.length, job.headers.length)
    .setValues(values);
  if (job.apiPath === "share-events") console.log("share: values saved");
}

// 大きな日報のSpreadsheetApp.setValuesは再計算でタイムアウトするため、
// 専用のOAuth権限を承認したときだけSheets APIでまとめて追記する。
// 応答が不明な失敗ではカーソルを進めず、次回の参照ID重複確認で再試行する。
function appendRowsViaSheetsApi_(sheet, job, firstRow, values) {
  const spreadsheet = sheet.getParent();
  const lastRow = firstRow + values.length - 1;
  const requests = [];
  if (lastRow > sheet.getMaxRows()) {
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: sheet.getSheetId(),
          gridProperties: { rowCount: lastRow + 1000 },
        },
        fields: "gridProperties.rowCount",
      },
    });
  }
  requests.push({
    updateCells: {
      start: {
        sheetId: sheet.getSheetId(),
        rowIndex: firstRow - 1,
        columnIndex: 0,
      },
      rows: values.map(function (row) {
        return {
          values: row.map(function (value, index) {
            if (index === 1 && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
              const parts = String(value).split("-").map(Number);
              const serial =
                Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000 +
                25569;
              return { userEnteredValue: { numberValue: serial } };
            }
            if (value == null || value === "") return {};
            if (typeof value === "number") {
              return { userEnteredValue: { numberValue: value } };
            }
            if (typeof value === "boolean") {
              return { userEnteredValue: { boolValue: value } };
            }
            return { userEnteredValue: { stringValue: String(value) } };
          }),
        };
      }),
      fields: "userEnteredValue",
    },
  });
  requests.push({
    repeatCell: {
      range: {
        sheetId: sheet.getSheetId(),
        startRowIndex: firstRow - 1,
        endRowIndex: lastRow,
        startColumnIndex: 1,
        endColumnIndex: 2,
      },
      cell: {
        userEnteredFormat: {
          numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" },
        },
      },
      fields: "userEnteredFormat.numberFormat",
    },
  });
  const response = UrlFetchApp.fetch(
    "https://sheets.googleapis.com/v4/spreadsheets/" +
      spreadsheet.getId() +
      ":batchUpdate",
    {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ requests: requests }),
      muteHttpExceptions: true,
    },
  );
  if (response.getResponseCode() !== 200) {
    // OAuthトークン、レスポンス本文、匿名参照IDをログに出さない。
    throw new Error(
      job.sheetName +
        " Sheets API write failed (HTTP " +
        response.getResponseCode() +
        ")",
    );
  }
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
function syncJob_(job, options) {
  const properties = PropertiesService.getScriptProperties();
  if (job.apiPath === "share-events") console.log("share: open sheet");
  const sheet = rawSheet_(job);
  if (job.apiPath === "share-events") console.log("share: sheet open");
  const shareRestEnabled =
    job.apiPath === "share-events" &&
    ((options && options.shareRest === true) ||
      properties.getProperty("SHARE_REST_ENABLED") === "1");
  const restContext = shareRestEnabled
    ? { nextRow: sheet.getLastRow() + 1 }
    : null;
  const pageSize = shareRestEnabled ? 999 : job.pageSize;
  const maxPagesPerRun =
    options && options.maxPagesPerRun
      ? options.maxPagesPerRun
      : shareRestEnabled
        ? 10
        : job.maxPagesPerRun;
  const references =
    job.mode === "upsert"
      ? allReferenceRows_(sheet, job)
      : recentReferences_(sheet, job);
  if (job.apiPath === "share-events") console.log("share: references read");
  let cursorAt =
    properties.getProperty(job.cursorAtProperty) || initialCursor_(job);
  let cursorId = properties.getProperty(job.cursorIdProperty) || "";

  for (let pageIndex = 0; pageIndex < maxPagesPerRun; pageIndex++) {
    if (job.apiPath === "share-events") console.log("share: fetch page");
    const payload = fetchPage_(job, cursorAt, cursorId, pageSize);
    if (job.apiPath === "share-events") console.log("share: page fetched");
    const rows = payload.rows || [];
    if (job.mode === "upsert") {
      upsertRows_(sheet, job, rows, references);
    } else {
      appendRows_(sheet, job, rows, references, restContext);
    }

    if (!payload.nextCursor) break;
    cursorAt = payload.nextCursor.at;
    cursorId = payload.nextCursor.id;
    // シート書き込みが成功したページ単位で位置を保存する。
    saveCursor_(properties, job, payload.nextCursor);
    if (!payload.hasMore) break;
  }
}

// OAuth再承認後、定期同期の高速モードを有効にする前に1ページだけ検証する。
// 既存の同期ロックとカーソルを共有し、新しいトリガーは作らない。
function syncShareRestOnce() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("別の同期が実行中です");
  try {
    syncJob_(RAW_SYNC_JOBS.shareEvents, {
      shareRest: true,
      maxPagesPerRun: 1,
    });
  } finally {
    lock.releaseLock();
  }
}

// この1関数を15分ごとに実行し、有効な生データだけを同期する。
function syncMetricsRaw() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;

  try {
    // 日報のタイムゾーンはAsia/Tokyoに設定済み。毎回の再設定は巨大な
    // スプレッドシート全体の処理を起こし、同期開始前にタイムアウトする。
    const errors = [];
    const jobKeys = Object.keys(RAW_SYNC_JOBS);
    const shareIndex = jobKeys.indexOf("shareEvents");
    const lineIndex = jobKeys.indexOf("lineFollowEvents");
    // 重いシェア書き込み後にLINEジョブがSheetsタイムアウトするのを避ける。
    if (shareIndex >= 0 && lineIndex > shareIndex) {
      jobKeys.splice(lineIndex, 1);
      jobKeys.splice(shareIndex, 0, "lineFollowEvents");
    }
    jobKeys.forEach(function (key) {
      const job = RAW_SYNC_JOBS[key];
      if (job.enabled === false) return;
      try {
        syncJob_(job);
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

// 旧手順から実行しても、現在有効な同期を行う。
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
