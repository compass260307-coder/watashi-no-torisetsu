# ハイパー日報（通年）：集計同期

対象: [ハイパー日報（通年）](https://docs.google.com/spreadsheets/d/177UacI6un8hb2B01O0xkiFtPm9-IoSxMBn3gxIi-sLg/edit)。表示用タブ、設定、広告費手入力タブ、data_daily の Q 列は変更しない。

## 段階1：集計と既存15分トリガー

追加の有料サービス、Google Cloud の課金設定、Supabase プラン変更は不要。既存 Supabase、Vercel、Apps Script の利用枠を使用する。利用量課金まで必ず0円になる保証ではない。生データの新たな書き出しはせず、1日単位の集計JSONのみ取得する。既存 raw 同期を止めないため、その既存の転送量は残る。

2026-10-22の事前確認：対象シートは Asia/Tokyo、data_daily=A:P（Q1が配列数式）、data_hourly=A:K、同期状態=B2:B5。Vercelの接続先は watashi-no-torisetsu、既存チーム契約は Pro。Supabase の remote OpenAPI で users/payment_history/events/line_accounts/line_plus_subscriptions を照合し、初回の適用履歴 `20261022003000_purchase_conversion_destinations` と既存 acquisition_medium 等を管理画面で確認。再確認では別作業の `20261022060000_purchase_conversion_cron_config` が適用済み。今回の段階1 migrationとad_spendは未適用・未作成。マージ直前に再確認する。

### データ定義

- 日付・時間はすべて JST。国は診断の acquisition_locale: ja→jp、ko→kr、en→us。その他のlocaleは対象外。
- 診断は users.diagnosis_completed_at があるユーザーを1件。購入は payment_history の completed/refunded、テストSession除外。日付は購入日（paid_at、なければcreated_at）、返金は元の購入日の純売上を修正する。全額返金でも購入件数は保持する。
- 診断・購入とも users の診断時 acquisition_source/medium/campaign を使用。campaignだけ acquisition_campaign がNULLなら旧campaignへフォールバック。欠損 source/medium/campaign は空文字。決済時のsourceや広告名から診断の帰属を変更しない。
- purchases_full は payment_kind=full_access。purchases_upsell はそれ以外の有償決済、purchases_total は両者の和。料金・商品内容を変更しない。
- amount_jpy は既存DBの列名であり、実際は元通貨の最小単位。JPY/KRWはそのまま、USDは100で除算後、設定レートで円換算する。返金額を同じ元通貨で先に控除する。通貨・レートが不明な場合は同期全体を失敗させ、前回値を保持する。
- line_follows は line_follow イベント数（再フォローを含む）。line_accounts の現在の連携先ユーザーで帰属し、未連携は jp/空source/空medium/空campaign。後から連携した場合は過去日を再集計する。
- sub_starts は line_plus_subscriptions の実Stripeサブスク（IDが sub_ で開始）の作成件数。解約後も開始件数を保持。手動付与・買い切り権利は除外する。
- 段階1では広告費・表示・クリック=0、広告最終同期は空、取得元は「未接続（段階1）」。広告接続前の0は実績取得済みを意味しない。

### 更新の安全性

DB関数と変更日テーブルはRLS有効、anon/authenticated/PUBLICに権限なし。APIは既存SHEETS_METRICS_KEY（旧METRICS_KEY互換）をBearerで照合し、no-storeで配信する。メール、元ID、匿名ID、トークン等の個別レコードを返さない。DB側はjsonbの単一値で返すため、PostgRESTの1000行制限で切れない。

毎回、今日〜一昨日、変更待ちの古い日3日、初回取得の過去日3日まで再計算する。変更日のバージョンを日別に保存し、古い返金、削除、流入の修正、LINE連携も追随する。全履歴を15分ごとにスキャンしない。変更日テーブルは日付と更新時刻だけを保持する。

data_daily はA:Eでupsert。再集計した日から消えたキーは数値列を0にして古い合計を残さない。data_hourlyは今日・昨日のみ、前回の余分な行も削除する。日付はSheetsの日付シリアル値＋日付書式、広告名等の文字はstringValueで書くため数式として実行されない。書き込みはSheets APIの1つの原子的batchUpdate。Q列とヘッダーには書かない。不足時は行数だけ拡張する。

シート公開が成功してから専用チェックポイントを保存する。不明なHTTP失敗では進めない。再実行は同じキーを更新する。B2=集計公開時刻、B3=広告取得成功時刻（段階1は空）、B4=広告取得元、B5=固定の安全なエラー文。同期失敗時はB2/B3と前回データを保持する。Google権限やAPI自体の障害時はB5を書けない場合がある。

### 診断保存とLINEフォロー検索の負荷

users の INSERT トリガーは診断日を変更日テーブルに記録するだけで、payment_history・line_plus_subscriptions・events は検索しない。UPDATE・DELETE は従来どおり関連する過去日を再集計対象にする。

2026-10-22に本番DBのIndexes画面で `idx_events_event_name` と `idx_events_event_name_created_at_id (event_name, created_at, id)` の存在を確認した。これらでline_followへ絞れるが、`metadata->>'line_user_id'` をキーにした既存インデックスはない。PRのmigrationへ `idx_events_hyper_line_follow_user_created`（LINEユーザーID式＋created_at、`WHERE event_name='line_follow'`）を追加し、UPDATE・DELETEとLINE連携変更時の検索を支える。本番には未作成。新規ユーザーのINSERTではこの検索自体を実行しない。

### マージ承認後の導入順序

本PRの作成だけではDB・Web・Apps Script・シートは更新されない。マージ、本番DB適用、デプロイ、Apps Script保存と認可はそれぞれ承認後に行う。

1. 適用履歴とremote schemaを再確認し、隔離DBで `20261022050000_hyper_report_aggregates.sql` を検証後、承認された環境へ適用する。過去の未適用migrationをまとめてdb pushしない。
2. Vercelに `HYPER_REPORT_FX_JPY_PER_UNIT` を設定する。値はJSONで、KRWは既存韓国日報と同じ **1ウォン＝0.1193156円** を使用する。JPYは常に1。USDは1ドルあたりの採用レートを運用者が決める。設定例：`{"krw":0.1193156,"usd":150}`。この `usd:150` はJSON書式を示す仮値であり、採用済み・現在の為替レートではない。USDは実際に採用する値へ置き換えてから登録する。USDの決済額はセントからドルへ直してこのレートを掛ける（例：499セント→4.99ドル）。設定レートを変更したら後述の再取得を行う。認証情報はGitへ置かない。
3. 承認後にWebを配布し、Bearer認証付き `/api/metrics/hyper-report?date=YYYY-MM-DD` を検証する。無認証401、誤った日付400、未適用/換算未設定503を確認。
4. **既存のApps Scriptプロジェクト**に `google-sheets-hyper-report-sync.gs` を追加。既存のsyncMetricsRawには、生データ同期とflushの後に置いた任意呼び出しと残り時間の判定を反映する。月別保存用補助ファイル、既存コード、プロパティ、rawカーソル、15分トリガーを保持する。
5. 現行マニフェストと `google-sheets-hyper-report-sync-appsscript.json` を比較し、既存スコープをすべて維持したまま `https://www.googleapis.com/auth/spreadsheets` を追加する。別の日報ファイルをopenByIdで編集するため、currentonlyのみでは不足する。Googleの権限追加を運用者が確認・再承認する。SHEETS_METRICS_KEYは既存値を使用し、Supabase service_roleキーをApps Scriptへ入れない。
6. プロパティ `HYPER_REPORT_START_DATE=2026-10-01`（今回の初回取得開始日。省略時の既定値も2026-10-01）と `HYPER_REPORT_ACTIVE=1` を設定し、`syncHyperReportOnce` を手動実行。Aの日付型、Q1の数式、B2:B5、既存日報とraw同期の継続を確認。新しいトリガーは作らない。以後は既存15分トリガーから実行する。

初回の過去分は2026-10-01から1実行最大3日。2026-10-22時点の22日分は最大8実行（約2時間、既存同期後に十分な実行時間がある回に進む）。今日・昨日は最初に成功した実行から更新。既存の生データ同期とflushを先に完了させ、開始から4分以上経過していた場合は集計同期をスキップする。集計の処理予算は最大45秒かつトリガー開始から5分までとし、期限を過ぎた場合は新たな書き込みとチェックポイント更新をしない。個々のGoogleネットワーク呼び出しは途中中断できないが、先に完了した既存同期を妨げない。初回取得の進捗は `HYPER_REPORT_BACKFILL_NEXT` で確認できる。

再取得：停止中に `HYPER_REPORT_BACKFILL_NEXT` を必要な開始日に戻す。日付バージョンプロパティを消さずに過去分を再計算できる。停止は `HYPER_REPORT_ACTIVE=0` のみ。既存syncMetricsRawトリガーを削除しない。DB追加物は残しても既存同期へ影響しない。ロールバックで既存テーブル・決済ファクトを削除しない。

### 検証

`node scripts/hyper-report-sync-test.mjs`、`node scripts/google-sheets-diagnosis-sync-test.mjs`。SQLは隔離用 @electric-sql/pglite をignoredフォルダへインストールし、`HYPER_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/hyper-report-sql-test.mjs`。本番DBを書かず、JST境界、日付型、帰属、返金、JPY/KRW/USD、RLS、削除、古い更新、Q列保護、時間別全置換、原子的公開、再実行、認証を実行検証する。

## 段階2

広告費の格納・TikTok Marketing API・毎時Cron・権限申請の手順は別PRにする。段階1のマージ前に段階2を本番へ反映しない。X Ads APIは承認前には呼び出さない。
