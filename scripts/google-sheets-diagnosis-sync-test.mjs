import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';

const source = readFileSync(new URL('./google-sheets-diagnosis-sync.gs', import.meta.url), 'utf8');

function runSharePage({ restEnabled, sheetsStatus = 200, hasMore = false }) {
  const headers = [
    'created_at', 'date_jst', 'hour_jst', 'event_ref', 'event_name',
    'session_ref', 'owner_ref', 'invite_ref', 'locale', 'kind', 'source',
    'channel', 'type_id', 'funnel_version',
  ];
  const writes = [];
  const savedCursors = [];
  const pageUrls = [];
  const lockState = { acquired: false, released: false };
  const spreadsheet = { getId: () => 'test-spreadsheet' };
  const sheet = {
    getLastRow: () => 1,
    getMaxRows: () => 1,
    getMaxColumns: () => headers.length,
    getSheetId: () => 42,
    getParent: () => spreadsheet,
    getRange: (row) => ({
      getDisplayValues: () => [headers],
      setValues: (values) => writes.push({ row, values }),
    }),
    insertRowsAfter: (row, count) => writes.push({ insertedAfter: row, count }),
  };
  spreadsheet.getSheetByName = () => sheet;
  const properties = {
    getProperty: (name) => {
      if (name === 'SHEETS_METRICS_KEY') return 'test-metrics-key';
      if (name === 'SHARE_REST_ENABLED') return restEnabled ? '1' : '';
      if (name === 'SHARE_CURSOR_AT') return '2026-09-14T13:19:51Z';
      if (name === 'SHARE_CURSOR_ID') return '11111111-1111-4111-8111-111111111111';
      return '';
    },
    setProperties: (cursor) => savedCursors.push(cursor),
  };
  const sandbox = {
    console: { log: () => {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    PropertiesService: { getScriptProperties: () => properties },
    ScriptApp: { getOAuthToken: () => 'test-oauth-token' },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => (lockState.acquired = true),
        releaseLock: () => { lockState.released = true; },
      }),
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        if (url.startsWith('https://sheets.googleapis.com/')) {
          writes.push(JSON.parse(options.payload));
          return { getResponseCode: () => sheetsStatus };
        }
        pageUrls.push(url);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({
            columns: headers,
            rows: [{
              created_at: '2026-09-14T16:00:00Z',
              date_jst: '2026-09-15',
              hour_jst: 1,
              event_ref: 'ref_one',
              event_name: 'friend_landing_viewed',
              locale: 'ja',
            }],
            nextCursor: {
              at: '2026-09-14T16:00:00Z',
              id: '22222222-2222-4222-8222-222222222222',
            },
            hasMore,
          }),
        };
      },
    },
  };
  createContext(sandbox);
  new Script(source).runInContext(sandbox);
  return { sandbox, writes, savedCursors, pageUrls, lockState };
}

const fast = runSharePage({ restEnabled: true });
fast.sandbox.syncJob_(fast.sandbox.RAW_SYNC_JOBS?.shareEvents ??
  new Script('RAW_SYNC_JOBS.shareEvents').runInContext(fast.sandbox));
assert.match(fast.pageUrls[0], /limit=999/);
assert.equal(fast.savedCursors.length, 1);
const batch = fast.writes[0].requests;
assert.equal(batch[0].updateSheetProperties.properties.gridProperties.rowCount, 1002);
assert.equal(batch[1].updateCells.start.rowIndex, 1);
assert.equal(batch[1].updateCells.rows[0].values.length, 14);
assert.equal(batch[1].updateCells.rows[0].values[1].userEnteredValue.numberValue, 46280);
assert.equal(batch[2].repeatCell.fields, 'userEnteredFormat.numberFormat');

const denied = runSharePage({ restEnabled: true, sheetsStatus: 403 });
assert.throws(() => denied.sandbox.syncJob_(
  new Script('RAW_SYNC_JOBS.shareEvents').runInContext(denied.sandbox)),
  /HTTP 403/);
assert.equal(denied.savedCursors.length, 0);

const fallback = runSharePage({ restEnabled: false });
fallback.sandbox.syncJob_(
  new Script('RAW_SYNC_JOBS.shareEvents').runInContext(fallback.sandbox));
assert.match(fallback.pageUrls[0], /limit=100/);
assert.equal(fallback.savedCursors.length, 1);
assert.equal(fallback.writes.some(write => write.values?.[0]?.[3] === 'ref_one'), true);

const manual = runSharePage({ restEnabled: false, hasMore: true });
manual.sandbox.syncShareRestOnce();
assert.equal(manual.pageUrls.length, 1);
assert.match(manual.pageUrls[0], /limit=999/);
assert.equal(manual.savedCursors.length, 1);
assert.deepEqual(manual.lockState, { acquired: true, released: true });

console.log('share sync cursor and Sheets API request checks passed');
