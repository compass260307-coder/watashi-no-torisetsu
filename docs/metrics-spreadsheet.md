# 主要KPIをスプレッドシートに反映する

## 推奨: 4種類の生データを15分ごとに差分同期する

時間別診断数、売上、返金、シェア率の元になる行だけを、
前回の続きから追記・更新する。`/api/metrics` の全集計や
`/api/metrics/raw` の全件置換は定期実行しない。

```text
GET /api/metrics/diagnoses?after=<ISO>&after_id=<UUID>&limit=500
GET /api/metrics/sales?after=<ISO>&after_id=<UUID>&limit=500
GET /api/metrics/share-events?after=<ISO>&after_id=<UUID>&limit=500
GET /api/metrics/product-events?after=<ISO>&after_id=<UUID>&limit=500
Authorization: Bearer <SHEETS_METRICS_KEY>
```

- `diagnoses_raw`: 保存成功済みの確定診断を1人1行で追記
- `sales_raw`: 実決済を1決済1行。売上、返金額、純売上を保持し、返金時は同じ行を更新
- `share_events_raw`: 自己結果シェアと友達招待の主要イベントを1イベント1行で追記
- `product_events_raw`: Alice・運命の設計図の主要導線イベントを1イベント1行で追記
  - `journey` は `alice` / `unmei`。日別ファネルは `date_jst`, `event_name`, `session_ref` を基準に集計する
  - 生のユーザーID、owner token、Stripe session IDは出さず、`ref_...` 形式へ匿名化する
- 各APIは `(timestamp, id)` のカーソル以降だけを読み取る
- メールアドレス、Stripe ID、生のトークン、元のDB IDは返さない
- 同一ユーザー/セッションを数えるためのIDは復元不能な `ref_...` 形式
- 管理画面の重い全集計を呼ばないため、DB読み取り量は基本的に新規行数に比例する

Apps Script は `scripts/google-sheets-diagnosis-sync.gs` を使う。
スプレッドシートの「拡張機能 > Apps Script」へ貼り付け、次の順に1回ずつ実行する。

1. Vercelの環境変数とApps Scriptのスクリプト プロパティの両方に
   `SHEETS_METRICS_KEY` を登録する（新方式の推奨設定）
   - 値にはGoogle Sheets同期専用の、十分に長いランダム文字列を使う
   - 旧設定との互換用に `METRICS_KEY` でも認証できるが、新規設定では使わない
   - 両方が設定されている場合、匿名参照IDのHMACには常に
     `SHEETS_METRICS_KEY` が使われる
2. `syncMetricsRaw` を実行し、初回のデータ取得と権限承認を完了
3. `createQuarterHourlyTrigger` を実行し、15分トリガーを登録

初回は診断=直近2日、売上=過去分全般、シェア=直近30日を取得する。
シェアの初回分は数が多いため、15分トリガー数回に分けて自動的に追い付く。

昨日の時間別診断数は、ピボットテーブルでフィルタを `date_jst`、
行を `hour_jst`、値を `diagnosis_ref` の COUNTA にすれば確認できる。
純売上は `sales_raw!net_jpy` の合計、基本的なシェア率は
`share_events_raw` の `share_clicked` ユニーク人数 ÷ `diagnosis_completed`
ユニーク人数を基準に作れる。

> Apps Scriptの時間トリガーは完全な `:00 / :15 / :30 / :45` 固定ではなく、
> Google側のスケジュールによって数分前後することがある。
>
> Google Sheetsは1ファイル1,000万セルが上限。現在の診断量では長期に
> 同じファイルへ蓄積し続けると上限に達するため、半年〜1年ごとに
> アーカイブ先スプレッドシートへ分ける。

---

## 非推奨の旧方式（`METRICS_KEY` 互換用）

以下は `/api/metrics` の全集計を取得していた旧方式である。
新しい15分差分同期のキー設定とは分離し、新規導入には使用しない。

Google スプレッドシート側から `/api/metrics` を **1日おき**に pull し、1行ずつ追記して時系列で貯める。
集計結果はVercel Runtime Cacheに24時間保存し、Supabaseから同じ大量データを繰り返し転送しない。

## 仕組み

```
Supabase events/users → /api/metrics (集計・主要数値だけ返す)
        ↑ 1日おきに GET (Authorization ヘッダーで認証)
Google Apps Script (時間トリガー) → シートに1行追記
```

- 集計ロジックは `src/lib/admin-stats.ts`（管理画面 `/admin` と共有・二重管理なし）
- エンドポイント: `src/app/api/metrics/route.ts`
- 認証は `Authorization: Bearer <METRICS_KEY>` ヘッダーと env `METRICS_KEY` の照合。URLにはキーを含めない
- `METRICS_KEY` は `ADMIN_KEY` とは別トークン（シートに置くキーで /admin は開けない）

## セットアップ

### 1. 環境変数を設定

Vercel（Production）とローカル `.env.local` に追加：

```
METRICS_KEY=<ランダムな長い文字列>
```

（`openssl rand -hex 24` などで生成。Vercel は `vercel env add METRICS_KEY production` でも設定できる。
※実値はこのファイルに書かない。Vercel の環境変数、ローカル `.env.local`、Apps Script の
スクリプト プロパティにのみ置く）

### 2. Apps Scriptのプロパティにキーを保存

Apps Script の **プロジェクトの設定 → スクリプト プロパティ** に次を追加：

- プロパティ: `METRICS_KEY`
- 値: Vercel に設定した `METRICS_KEY` と同じ値

これにより、キーをURLやソースコードへ直接書かずに済む。

### 3. 動作確認

```
curl -H "Authorization: Bearer <METRICS_KEYの値>" \
  "https://<本番ドメイン>/api/metrics"
```

JSON で主要数値が返ればOK。`?format=csv` で2列CSVも取得可（IMPORTDATA でのお試し表示用）。

### 4. スプレッドシートに Apps Script を貼る

スプレッドシートを開く → 拡張機能 → Apps Script → 以下を貼る：

```javascript
const METRICS_URL = 'https://<本番ドメイン>/api/metrics';
const SHEET_NAME = 'KPI';

function authorizedFetch(url) {
  const key = PropertiesService.getScriptProperties().getProperty('METRICS_KEY');
  if (!key) throw new Error('スクリプト プロパティ METRICS_KEY が未設定です');
  return UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + key },
    muteHttpExceptions: true,
  });
}

// 現在の累計スナップショットを1行追記する
function appendMetricsSnapshot() {
  const res = authorizedFetch(METRICS_URL);
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

// 1回だけ実行して1日おきのトリガーを作成する。
// (二重登録を防ぐため、既存の同名トリガーは消してから作り直す)
function createDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'appendMetricsSnapshot')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('appendMetricsSnapshot').timeBased().everyDays(1).atHour(1).create();
}
```

### 5. トリガー登録

Apps Script エディタで関数 `createDailyTrigger` を一度実行（初回は権限承認あり）。以後は **1日おき**に自動で1行増える。
手動で1行足したいときは `appendMetricsSnapshot` を実行。

> 集計は累計スナップショットなので、Free Planでは日次取得で十分。短い間隔へ戻すとEgress超過の原因になる。

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

# 分析用データをスプレッドシートに落とす（日付別に見たい場合）

「今日 何人が診断してくれたか」などを日付で見たいとき用。集計済みの累計スナップショット
（上のセクション）とは別に、Supabase から分析に必要な項目だけをシートに全置換で書き込み、
集計はスプシ側のピボット/関数で行う。

名前・招待コード・閲覧トークン・任意の metadata は出力しない。ユーザーIDやセッションIDは、
同一データを数えたり匿名のまま突合したりできる `ref_...` 形式の復元不能な参照IDに変換する。

## エンドポイント

`src/app/api/metrics/raw/route.ts`

```
GET /api/metrics/raw?table=events|users|friend_perceptions&days=<1..365>
Authorization: Bearer <METRICS_KEY>
```

- `table=events`（既定）… events テーブルの行。列:
  `created_at, date_jst, event_name, session_ref, meta_type_id, meta_source, meta_channel, meta_kind, meta_friend_count, meta_question_id`
  - `meta_*` は metadata のうち分析に必要な項目だけを展開したもの。元のJSONは出力しない
- `table=users` … users テーブルの行。列:
  `created_at, date_jst, user_ref, plan, type_name, friend_count, acq_source, acq_campaign, generation, source_user_ref`
  - `user_ref` = 元のユーザーIDを復元不能にした参照ID。`source_user_ref` や友達診断側の `target_user_ref` と匿名のまま突合できる
  - `type_name` = サイトの「性格タイプ」= 称号(essence)（例 采配者 / 将軍 / 寄添者）。scores から算出しサイト表示と一致（32有効時は32称号）
  - `friend_count` = 友達に評価された人数（累計）。**3 以上 = 友達診断が完成した人**。`=COUNTIF(users_raw!<friend_count列>, ">=3")` で達成者数
  - `acq_source` = 流入元媒体（line/x/copy/qr/utm_source等）、`acq_campaign` = キャンペーン（新 acquisition_campaign 優先・無ければ旧 campaign）
  - `generation` = バイラル世代、`source_user_ref` = 匿名化した招待元ユーザー、`plan` = 料金プラン
- `table=friend_perceptions` … 友達診断(他己評価)の結果。列:
  `created_at, date_jst, target_user_ref, perceived_type_name`
  - `target_user_ref` = 評価された人の匿名参照ID（`users_raw` の `user_ref` と突合可）
  - `perceived_type_name` = 友達が見た称号（サイト表示と一致）。評価した友達の名前は出力しない
- `date_jst` は **日本時間の YYYY-MM-DD**（集計しやすいよう追加している唯一の派生列）
- `days` は直近何日分か（既定90）。返却は最大 50,000 行（超える分は古い行が切れる → `days` を絞る）

> events は 1 日あたり数百〜千行あるので、生 events は `days=30` 程度が扱いやすい。
> 「診断した人数」は 1 人 1 行の **users テーブル**を使うのが正確でラク。

## Apps Script（events / users を各タブに全置換）

```javascript
const RAW_BASE = 'https://www.watashi-torisetsu.com/api/metrics/raw';

// events / users / 友達診断結果 の生データを各タブに全置換で書き込む
function syncRawData() {
  writeRawTable('events_raw', RAW_BASE + '?table=events&days=30');
  writeRawTable('users_raw', RAW_BASE + '?table=users&days=365');
  writeRawTable('friend_results', RAW_BASE + '?table=friend_perceptions&days=365');
}

function writeRawTable(sheetName, url) {
  const res = authorizedFetch(url);
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

// 生データ同期は必要なときだけ手動で syncRawData() を実行する。
```

生データ出力は通信量が大きいため本番では既定で停止している。必要なときだけVercelの
`METRICS_RAW_EXPORT_ENABLED=1`を一時設定し、`syncRawData`を手動で1回実行する。
完了後は環境変数を削除して再デプロイする。定期トリガーでは実行しない。

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
`users_raw` を範囲に、行 = `date_jst`、値 = `user_ref` の COUNTA。これで「日付ごとの診断人数」表になる。
イベント別に見たいときは `events_raw` を範囲に、行 = `date_jst`、列 = `event_name`、値 = COUNTA。

---

# ダッシュボードタブを自動生成する

`dashboard` タブに主要KPIを自動で組む Apps Script。1回貼って `buildDashboard` を実行するだけ。
数式なので、`syncRawData` で生データが更新されれば dashboard も自動で追従する。

前提: 列順は `syncRawData` が書く固定順（users_raw: A created_at / B date_jst / C user_ref /
D plan / E type_name / F friend_count / G acq_source …）。タイムゾーンはJST。

```javascript
function buildDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('dashboard') || ss.insertSheet('dashboard');
  sh.clear();

  const today = 'TEXT(TODAY(),"yyyy-mm-dd")';
  const yday = 'TEXT(TODAY()-1,"yyyy-mm-dd")';

  // ── サマリー (A1:B9) ──
  sh.getRange('A1').setValue('■ サマリー（日次更新）').setFontWeight('bold');
  const kpi = [
    ['総診断者数', '=COUNTA(users_raw!C2:C)'],
    ['今日の診断者', '=COUNTIF(users_raw!B2:B, ' + today + ')'],
    ['昨日の診断者', '=COUNTIF(users_raw!B2:B, ' + yday + ')'],
    ['友達診断 完成者(3人以上)', '=COUNTIF(users_raw!F2:F, ">=3")'],
    ['友達診断 完成率', '=IFERROR(COUNTIF(users_raw!F2:F,">=3")/COUNTA(users_raw!C2:C),0)'],
    ['友達評価の総数', '=COUNTA(friend_results!C2:C)'],
    ['今日の友達回答完了', '=COUNTIFS(events_raw!C:C,"friend_answer_completed", events_raw!B:B, ' + today + ')'],
    ['今日の友達招待クリック', '=COUNTIFS(events_raw!C:C,"friend_invite_clicked", events_raw!B:B, ' + today + ')'],
  ];
  for (var i = 0; i < kpi.length; i++) {
    sh.getRange(2 + i, 1).setValue(kpi[i][0]);
    sh.getRange(2 + i, 2).setFormula(kpi[i][1]);
  }
  sh.getRange('B6').setNumberFormat('0.0%'); // 完成率

  // ── 友達人数の分布 (A11:B16) ──
  sh.getRange('A11').setValue('■ 友達人数の分布').setFontWeight('bold');
  const dist = [
    ['0人', '=COUNTIF(users_raw!F2:F,0)'],
    ['1人', '=COUNTIF(users_raw!F2:F,1)'],
    ['2人', '=COUNTIF(users_raw!F2:F,2)'],
    ['3人以上', '=COUNTIF(users_raw!F2:F,">=3")'],
    ['5人以上', '=COUNTIF(users_raw!F2:F,">=5")'],
  ];
  for (var j = 0; j < dist.length; j++) {
    sh.getRange(12 + j, 1).setValue(dist[j][0]);
    sh.getRange(12 + j, 2).setFormula(dist[j][1]);
  }

  // ── タイプ(称号)別 人数 (A19〜) ──
  sh.getRange('A19').setValue('■ タイプ(称号)別 人数').setFontWeight('bold');
  sh.getRange('A20').setFormula(
    '=QUERY(users_raw!E2:E, "select E, count(E) where E is not null group by E order by count(E) desc label E \'称号\', count(E) \'人数\'", 0)'
  );

  // ── 日別 診断者数 (D1〜, 新しい順) ──
  sh.getRange('D1').setValue('■ 日別 診断者数（新しい順）').setFontWeight('bold');
  sh.getRange('D2').setFormula(
    '=QUERY(users_raw!B2:B, "select B, count(B) where B is not null group by B order by B desc label B \'日付\', count(B) \'診断者\'", 0)'
  );

  // ── 流入元(acq_source)別 (G1〜) ──
  sh.getRange('G1').setValue('■ 流入元(acq_source)別').setFontWeight('bold');
  sh.getRange('G2').setFormula(
    '=QUERY(users_raw!G2:G, "select G, count(G) group by G order by count(G) desc label G \'流入元\', count(G) \'人数\'", 0)'
  );

  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(4, 110);
  sh.setColumnWidth(7, 130);
}
```

`buildDashboard` を1回実行すれば `dashboard` タブができる。中身は数式なので、以後は
`syncRawData`を手動実行して生データが更新されるたびに自動で最新化される。
