# 課金コンバージョン計測

Stripe Webhookを正本として、Meta CAPIとTikTok Events APIへ購入を送る。
ブラウザ・GTM・価格・Stripeの決済検証は変更しない。
両媒体とも `event_id` はStripe Checkout Session ID、`event_time` は
最初にoutboxへ保存した `paid_at` のまま。再送時刻へ置き換えない。

## 設定する環境変数

値は管理者がVercelの対象プロジェクトで入力する。秘密値をチャット、
Git、`NEXT_PUBLIC_*`へ入れない。ProductionとPreviewを分離し、
Previewへ本番トークンを流用しない。

| 名前 | 形式 | 取得場所・用途 |
| --- | --- | --- |
| `TIKTOK_PIXELS` | JSON配列。各要素は `{"pixelCode":"20文字のコード","accessToken":"トークン"}` | TikTok Ads Manager → Tools → Events Manager → 対象ピクセル → Settings → Events API → Generate Access Token。3ピクセルそれぞれにアクセスできるトークンを入力 |
| `META_PIXEL_ID` | 数字の文字列 | Meta Events Manager → 対象データセット／ピクセル → Settings。ブラウザと同じIDを使用 |
| `META_CONVERSIONS_API_TOKEN` | アクセストークン文字列 | 同じデータセットのSettings → Conversions API → Set up manually → Generate access token |
| `META_GRAPH_API_VERSION` | `v数字.数字`（例: `vXX.0` のXXを実際のサポート中バージョンに置換） | [Meta Graph APIバージョン](https://developers.facebook.com/docs/graph-api/changelog/versions)でサポート中のバージョンを確認 |
| `CRON_SECRET` | 推測困難なランダム文字列（32バイト以上を推奨） | ローカルの暗号学的乱数で作成しVercelへ入力。Vercel Cronが `Authorization: Bearer <値>` を自動付与 |
| `STRIPE_SECRET_KEY` | Stripeのサーバー秘密鍵 | 既存設定。Stripe Dashboard → Developers → API keys。cronのSession再取得に使用。値・決済検証は今回変更しない |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | プロジェクトURL／サーバー用キー | 既存設定。SupabaseプロジェクトのConnect／API設定。service-roleキーは公開しない |

`TIKTOK_PIXELS` の入力テンプレート（以下のダミートークンは必ず置換）:

```json
[
  {"pixelCode":"D9V8IIBC77UFF28NGHK0","accessToken":"REPLACE_TOKEN_1"},
  {"pixelCode":"DAUFBCRC77U5PB60GLP0","accessToken":"REPLACE_TOKEN_2"},
  {"pixelCode":"DAV7P7RC77UA36CC79E0","accessToken":"REPLACE_TOKEN_3"}
]
```

JSONの外側をシェル用のシングルクォートで囲まず、JSONそのものをVercelへ入力する。
3つの既知の送信先は、未設定・JSON不正でもキューへ残す。
トークン欠落やピクセルコード重複はそのピクセルだけ失敗する。
JSON全体が壊れている場合はTikTokの各ジョブが設定エラーになり、Metaは継続する。
有効な追加コードも別の送信先として扱う。

旧 `TIKTOK_PIXEL_CODE` / `TIKTOK_EVENTS_API_TOKEN` はJSONが未設定の場合だけ
単一ピクセルの互換設定として使える。3ピクセル送信には `TIKTOK_PIXELS` を使う。
広告費集計用の `TIKTOK_ACCESS_TOKEN` とは用途が異なる。

2026-08-24に確認したMeta IDは `2851061085248770`。
今回ブラウザ・GTMの再検証はしていないため、入力時は対象データセットと照合する。
環境変数の追加だけでは稼働中Deploymentへ反映されない。設定後の公開は別途承認を得る。

## 再送期限と重複除外

- Meta: [公式Server Event Parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event.md)で、event_timeは最大7日前、7日を超えたイベントを含むリクエストは全体がエラーになると確認（2026-10-22）。
- TikTok: [現行Web Events API 2.0の公式リファレンス](https://business-api.tiktok.com/gateway/docs/index?doc_id=1771100865818625&language=ENGLISH)は、event_timeを実際の発生時刻のUnix秒とし、即時送信を推奨している。確認した資料にWebイベントの最大受付日数の明記は見つからなかった。今回の運用上の再送上限を7日とする。広告の7日クリック帰属期間や、オフライン送信期限をWebの受付期限と混同しない。
- 安全側の境界として `paid_at <= 現在時刻 - 7日` を `expired` にし、
  理由を `last_error` へ保存する。Metaの受付上限とTikTokのローカル方針を理由文で区別する。
- DBで古い行を終了してからバッチ上限を適用し、Stripe Session取得前・媒体HTTP送信直前にも期限を確認する。
- 送信済み行は保持する。期限切れを設定変更で復活させたり、現在時刻のイベントとして送り直したりしない。
- [TikTok公式の重複除外仕様](https://business-api.tiktok.com/gateway/docs/index?doc_id=1771100865818625&language=ENGLISH)の単位は `event_source_id + event_id + event`。サーバーでも3ピクセルに同じSession ID・Purchaseを送る。

同じevent_idでも、媒体の重複除外期間を延長できるわけではない。
[TikTok公式の説明](https://ads.tiktok.com/resources/help/article/tiktok-adobe-eapi-implementation-guide?lang=en)は48時間以内の重複イベントを除外するとしている。
そのため、数日前にブラウザから送られた購入の初回サーバー再送について、重複除外を保証しない。
過去分の再送開始はこの点も確認してから承認する。

## outboxと互換移行

新outboxは `purchase_conversion_delivery_outbox`。
`(provider, destination_id, stripe_session_id)` を一意キーにする。
TikTokのdestination_idはピクセルコード、Metaは既存の単一送信先を表す空文字。
アクセストークン・メール・広告Cookieの生値はoutboxへ保存しない。

`pending/failed → processing → sent/failed/expired` と遷移し、
claimは行ロックと `SKIP LOCKED` で原子的に行う。15分のleaseで中断を回復する。
失敗は5分から指数バックオフ（最大24時間）。1つの送信先のエラーで他を止めない。
HTTP 2xxだけで成功とせず、TikTokのcode=0、Metaのevents_received=1も確認する。
APIの生レスポンス・トークンをエラーログへ残さない。

`server_purchase_conversion_sent` の監査キーもTikTokはピクセル単位。
従来送信先D9V8IIBC77UFF28NGHK0は従来の監査キーを引き継ぎ、
追加2つの成功判定には使わない。監査metadataへpixel_codeを保存する。
監査保存後にoutbox更新が失敗しても、次回は送信済み監査を参照する。

旧 `purchase_conversion_outbox` の一意制約・RPCは維持する。
新migrationとclaim処理は次の順で旧行を移す。

1. 期限切れのpending/failed（およびlease切れprocessing）を理由付きexpiredにする。
2. 期限内の旧行をMeta 1先・TikTok 3先の新ジョブへコピーする。
   従来のsentはMeta／元のTikTok先だけsentとして引き継ぐ。
3. コピーした旧pending/failed行を `expanded`（理由: 新outboxへ移管）にする。
   attemptsとpaid_atは保持し、旧ワーカーから再claimされないようにする。
4. 有効なprocessing leaseは触らず、旧ワーカーの終了またはlease切れ後に取り込む。
   新旧Webhookが切り替わる間に旧テーブルへ追加された行も、次回claimで取り込む。

移行・再実行は一意制約で冪等。期限内の既存failedは新キューで即時再送可能にし、
次回試行時刻が24時間後でも古いバックオフを待たせない。

## cronの設定待ち・既存分の消化（2026-10-22追加PR）

cronは `META_PIXEL_ID`・`META_CONVERSIONS_API_TOKEN`・`META_GRAPH_API_VERSION` の
すべてが空白以外の値を持つ場合だけMetaをclaimする。欠落中はDBの件数制限より前に
Metaを除外し、行・attempts・バックオフを保持する。既存のpending/failedを削除・resetしない。
設定をProductionへ入力して再デプロイすると、期限内・試行時刻到来済みのMetaも次のcronで再開する。
即時送信経路は既存のままで、この除外はcronだけに適用する。

除外中もclaim冒頭で全媒体の7日超を理由付きexpiredにする。
Metaしか残っていない場合もこの期限切れ処理は実行し、Metaの試行回数は増やさない。
cronレスポンスのexpiredはclaim後に期限を迎えた件数なので、一括期限切れ件数はDBの状態で確認する。

2026-10-22 12:00 JST（`2026-10-22T03:00:00Z`）より前の購入に対するTikTokの
pending/failed/processingが7日以内に残っている間は、cron1回の上限を25から100行へ増やす。
この既存分がsentまたはexpiredになれば自動で25行に戻る。新規購入だけでは増枠を延長しない。
追加環境変数や手動の解除は不要。100は全ピクセル合計のoutbox行数で、購入100件×3先ではない。

[TikTok Events API公式](https://business-api.tiktok.com/gateway/docs/index?doc_id=1771100779668482&language=ENGLISH)
の上限は、Events Managerのトークンなら広告アカウント単位、開発者アプリのトークンなら
アプリ単位で1,000 QPS、1リクエスト最大1,000イベント。
本workerは既存どおり1行を1リクエストで送り、同時4行・各バッチ後200ms待機に制限する。
cronは1回最大100リクエスト、連続したバッチでも毎秒おおむね20リクエスト以下。
この待機と同時実行制限はcron内に適用する。他の送信元と共有するアカウント全体の制御ではない。
APIエラー時は既存のバックオフを維持し、同一cronで即座に再試行しない。

実行時間は既存の300秒。4行ずつ確保し、開始240秒後には次のclaimを止める。
Stripeの再取得は1回10秒・SDK自動再試行なし、媒体送信は従来の8秒timeout。
未取得行はpending/failedのまま次回へ残るため、遅い実行では100件未満になる。
取得済み4行の完了処理には残り60秒を確保する。実行が強制中断された行は従来の15分leaseで回復する。

公開時は追加migration `20261022060000_purchase_conversion_cron_config.sql` を
承認後に先に適用し、その後アプリを公開する。
新しいservice_role専用RPCを追加するだけで、既存RPC・テーブル・権限・保存済み行は変更しない。
既存アプリ／即時送信と互換性がある。アプリを戻す場合も新RPCは残せる。
このPRの作成ではDB適用・本番公開・テスト送信・cron手動起動は実施しない。

## 公開手順（今回のPRでは実行しない）

1. Supabaseの適用履歴と本番outboxの制約・関数を再確認する。
2. ローカル／隔離DBで検証した `20261022003000_purchase_conversion_destinations.sql` を、
   承認後に適用する。既存の `2026-08-24-purchase-conversion-outbox.sql` が作成した
   テーブル・RPCが前提。古い非標準名migrationを再適用・repairしない。
3. 管理者が上記環境変数を入力する。本番トークンをPreviewへ入れない。
4. 別途公開の承認を得てアプリを公開する。旧アプリも旧キューへ保存できるため、
   schemaを先に追加できる。schema未適用のまま新アプリを公開しない。
5. 本番テストイベントやcronの手動呼び出しはしない。自然購入と通常cronで
   新outboxのsent/failed/expired、pixel_code別成功監査を確認する。
6. ロールバック時は新outboxの未送信行が残るため、新workerの停止による再送中断を
   考慮する。新テーブルを削除したり、旧expanded行を一括再送したりしない。

## 2026-10-22 読み取り調査

対象: Vercel `compass260307-coders-projects/watashi-no-torisetsu`、
Project ID `prj_4a4NYE4o9zlnDVz8pa8FGeUwq90s`。

- Production環境変数名の一覧でCRON_SECRETは登録済み（作成157日前）。
  TIKTOK_* / META_* は登録なし。値は表示・変更していない。
- 00:00:41.512 JSTの `GET /api/cron/purchase-conversions` はHTTP 200。
  Deployment `dpl_2A2qFKzE8EeX8UHtXAFvAXVSYK3B`、branch main。
  25件の設定不足エラーが記録され、attempts=2以上の再送も確認した。
- `vercel logs --environment production --since 24h --limit 100
  --query /api/cron/purchase-conversions --status-code 401 --json` は結果0件。
  無条件の24時間検索はタイムアウトしたため、全リクエストを網羅したとは言わない。
  直近1時間の同ルート検索では上記200の1リクエストを確認。
  取得可能な直近ログでは「CRON_SECRET未設定で401停止」は裏付けられなかった。
- 00:09 JSTに全8,900行をページングして読み取り集計。
  TikTok・Metaは各4,450行すべて設定不足のfailed。
  各4,128行が7日超、各322行が7日以内、attemptsは1〜32。
  件数は観測時点のスナップショットで、移行・公開時には変動する。
- 本番DBの制約（provider/session一意、4状態）とclaim関数をSELECTで確認。
  Supabase管理画面のmigration履歴も読み取り確認。
  新migrationは未適用。本番へのイベント送信・cron手動起動はしていない。

## ローカル検証

- `node scripts/purchase-conversion-delivery-test.mjs`: 全通信をmock。実送信なし。
- `PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/purchase-conversion-migration-test.mjs`: ローカルのインメモリPostgreSQLで旧schemaから移行。環境ファイルやリモートDBへ接続しない。PGliteは検証用のignoredディレクトリへインストールし、アプリ依存には追加しない。
- 対象ESLint、ルート／隔離環境のTypeScript、本番ビルド（`npm run build:local`）、`npm run verify:commerce`（48項目）合格。
- 隔離環境のbuildにはダミーSupabase設定を使用。本番資格情報や送信先トークンを使用していない。
- 即時／cronの応答に含まれる`expired`は、claim後に期限切れと判定した件数。DBがclaim前に整理した古い行はテーブルのstatusで確認する。

## ブラウザ計測との整合性

購入ファネルは `checkout_attempt_id` で次の4段を接続する。

- `purchase_cta_clicked`: ブラウザのクリック信号（欠損検知用）
- `checkout_requested`: APIが受理したサーバー正本の入口
- `checkout_session_created`: Stripe Session作成成功
- `purchase_completed` / `checkout_cancelled`: 完了またはキャンセル

集計のCheckout入口には `checkout_requested` を使い、ページ遷移時に欠けうる
`purchase_cta_clicked` は配信率の監視にだけ使う。Checkout作成はSession数に加えて
`owner_token` / `user_id` ベースのユーザー数も出力する。

`meta_purchase` はMeta Purchase・GA4 Purchase・Yahoo検索広告へ送る前提とし、
TikTok Purchaseはアプリから直接補完する。GTMを変更する場合も次の対応を維持する。

- Meta InitiateCheckout: Data Layer変数 `value` / `currency`
- Yahoo購入: Data Layer変数 `value`
- TikTok購入タグを追加する場合: イベント名を `Purchase`、Event IDを `event_id` にし、
  アプリの直接送信との重複排除を維持
