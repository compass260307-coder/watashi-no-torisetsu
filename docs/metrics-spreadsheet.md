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
