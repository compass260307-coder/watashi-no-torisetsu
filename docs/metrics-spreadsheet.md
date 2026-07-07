# 主要KPIをスプレッドシートに反映する

Google スプレッドシート側から `/api/metrics` を **30分おき**に pull し、1行ずつ追記して時系列で貯める。

## 仕組み

```
Supabase events/users → /api/metrics (集計・主要数値だけ返す)
        ↑ 30分おきに GET (?key=METRICS_KEY)
Google Apps Script (時間トリガー) → シートに1行追記
```

- 集計ロジックは `src/lib/admin-stats.ts`（管理画面 `/admin` と共有・二重管理なし）
- エンドポイント: `src/app/api/metrics/route.ts`
- 認証はクエリ `?key=` と env `METRICS_KEY` の照合。`ADMIN_KEY` とは別トークン（シートに置くキーで /admin は開けない）

## セットアップ

### 1. 環境変数を設定

Vercel（Production）とローカル `.env.local` に追加：

```
METRICS_KEY=<ランダムな長い文字列>
```

（`openssl rand -hex 24` などで生成。Vercel は `vercel env add METRICS_KEY production` でも設定できる。
※実値はこのファイルに書かない。Vercel の環境変数とローカル `.env.local` にのみ置く）

### 2. 動作確認

```
curl "https://<本番ドメイン>/api/metrics?key=METRICS_KEY"
```

JSON で主要数値が返ればOK。`?format=csv` で2列CSVも取得可（IMPORTDATA でのお試し表示用）。

### 3. スプレッドシートに Apps Script を貼る

スプレッドシートを開く → 拡張機能 → Apps Script → 以下を貼って `METRICS_URL` を自分の値に：

```javascript
const METRICS_URL =
  'https://<本番ドメイン>/api/metrics?key=<METRICS_KEYの値>';
const SHEET_NAME = 'KPI';

// 現在の累計スナップショットを1行追記する
function appendMetricsSnapshot() {
  const res = UrlFetchApp.fetch(METRICS_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error('metrics fetch failed: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
  const data = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const keys = Object.keys(data);
  if (sheet.getLastRow() === 0) sheet.appendRow(keys); // 初回はヘッダー
  sheet.appendRow(keys.map((k) => data[k]));
}

// 1回だけ実行して 30分おきのトリガーを作成する。
// (二重登録を防ぐため、既存の同名トリガーは消してから作り直す)
function createHalfHourlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'appendMetricsSnapshot')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('appendMetricsSnapshot').timeBased().everyMinutes(30).create();
}
```

### 4. トリガー登録

Apps Script エディタで関数 `createHalfHourlyTrigger` を一度実行（初回は権限承認あり）。以後は **30分おき**に自動で1行増える。
手動で1行足したいときは `appendMetricsSnapshot` を実行。

> 30分おき = 1日約48行。データが増えても問題ないが、行が多くなったら古い行を別シートへ退避するか、後述の「間隔を変える」で頻度を落とすとよい。
>
> **間隔を変えたいとき**: `everyMinutes(30)` の数字を変える（Apps Script が許可するのは `1 / 5 / 10 / 15 / 30` 分、または `everyHours(n)`）。変更後は再度 `createHalfHourlyTrigger` を実行（古いトリガーは自動で消えて作り直される）。

## 反映される列（主要な数値）

`asOf`（取得時刻）, `diagnosisStarted`, `diagnosisCompleted`, `completionRate`,
`friendInviteClicked`, `friendAnswerStarted`, `friendAnswerCompleted`, `answerCompletionRate`,
`threeAchieved`, `fiveAchieved`, `friendLandingViewed`, `friendToDiagClicked`,
`resultRevisited`, `totalUsers`, `avgChildPerParent`, `viralCoefficient`

いずれも「その時点の累計」。日次で貯めれば差分＝日次増分もシート上で計算できる。

## 列を増やしたいとき

`src/app/api/metrics/route.ts` の `metrics` オブジェクトに1行足すだけ。
`computeStats()` が返す値ならなんでも露出できる（`src/lib/admin-stats.ts` の return を参照）。

---

# 生データをそのままスプレッドシートに落とす（日付別に見たい場合）

「今日 何人が診断してくれたか」などを日付で見たいとき用。集計済みの累計スナップショット
（上のセクション）とは別に、Supabase の生の行をシートに全置換で書き込み、集計はスプシ側の
ピボット/関数で行う。

## エンドポイント

`src/app/api/metrics/raw/route.ts`

```
GET /api/metrics/raw?key=<METRICS_KEY>&table=events|users&days=<1..365>
```

- `table=events`（既定）… events テーブルの行。列:
  `created_at, date_jst, event_name, session_id, invite_code, owner_token, meta_type_id, meta_source, meta_channel, meta_kind, meta_friend_count, meta_question_id, metadata`
  - `meta_*` は metadata(JSON) のよく使うキーを展開したもの（`metadata` 列に元のJSONも残す）。ピボットが楽になる
- `table=users` … users テーブルの行。列:
  `created_at, date_jst, id, display_name, type_name, acq_source, acq_campaign, generation, source_user_id, plan`
  - `type_name` = サイトの「性格タイプ」= 称号(essence)（例 采配者 / 将軍 / 寄添者）。scores から算出しサイト表示と一致（32有効時は32称号）
  - `acq_source` = 流入元媒体（line/x/copy/qr/utm_source等）、`acq_campaign` = キャンペーン（新 acquisition_campaign 優先・無ければ旧 campaign）
  - `display_name` = ニックネーム、`generation` = バイラル世代、`source_user_id` = 招待元ユーザー、`plan` = 料金プラン
- `date_jst` は **日本時間の YYYY-MM-DD**（集計しやすいよう追加している唯一の派生列）
- `days` は直近何日分か（既定90）。返却は最大 50,000 行（超える分は古い行が切れる → `days` を絞る）

> events は 1 日あたり数百〜千行あるので、生 events は `days=30` 程度が扱いやすい。
> 「診断した人数」は 1 人 1 行の **users テーブル**を使うのが正確でラク。

## Apps Script（events / users を各タブに全置換）

```javascript
const RAW_BASE = 'https://www.watashi-torisetsu.com/api/metrics/raw?key=<METRICS_KEYの値>';

// events と users の生データを各タブに全置換で書き込む
function syncRawData() {
  writeRawTable('events_raw', RAW_BASE + '&table=events&days=30');
  writeRawTable('users_raw', RAW_BASE + '&table=users&days=365');
}

function writeRawTable(sheetName, url) {
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    throw new Error(sheetName + ' fetch failed: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
  const json = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clearContents();
  const cols = json.columns;
  const values = [cols].concat(json.rows.map((r) => cols.map((c) => r[c])));
  if (values.length) sheet.getRange(1, 1, values.length, cols.length).setValues(values);
}

// 30分おきトリガー（二重登録は消してから作り直す）
function createRawTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'syncRawData')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncRawData').timeBased().everyMinutes(30).create();
}
```

`syncRawData` を1回手動実行 → `events_raw` / `users_raw` タブができる。よければ `createRawTrigger`
を実行して30分おきに全置換更新。

## 「今日◯人」を出す（集計はスプシ側）

> ⚠️ 先に **ファイル → 設定 → タイムゾーンを (GMT+09:00) 日本** にする。
> `TODAY()` がJSTになり `date_jst` と一致する。

別タブ（例: `dashboard`）に関数を置く：

```
今日の診断完了人数     =COUNTIF(users_raw!B:B, TEXT(TODAY(), "yyyy-mm-dd"))
昨日の診断完了人数     =COUNTIF(users_raw!B:B, TEXT(TODAY()-1, "yyyy-mm-dd"))
今日の友達回答完了数   =COUNTIFS(events_raw!C:C, "friend_answer_completed", events_raw!B:B, TEXT(TODAY(), "yyyy-mm-dd"))
```

日付別の一覧が欲しいときは **ピボットテーブル**：
`users_raw` を範囲に、行 = `date_jst`、値 = `id` の COUNTA。これで「日付ごとの診断人数」表になる。
イベント別に見たいときは `events_raw` を範囲に、行 = `date_jst`、列 = `event_name`、値 = COUNTA。
