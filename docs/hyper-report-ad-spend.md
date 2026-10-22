# ハイパー日報：広告費API（段階2）

[段階1](hyper-report-sync.md) の後に適用する。Xは承認待ちのため未実装・無通信。TikTokのみ取得する。広告作成・編集・予算変更・広告配信のAPIは使用しない。

## 費用と実行

既存 Supabase / Vercel Pro / Apps Script の範囲を利用し、有料ETL、コネクター、新規プラン、為替API、AI呼び出しは追加しない。VercelチームがProであることを2026-10-22に確認済み。[Cron自体はプランに含まれるが、Function利用枠の対象](https://vercel.com/docs/cron-jobs/usage-and-pricing)。既存枠内で運用し、利用枠超過が見込まれる場合は追加費用を承認せず、`HYPER_AD_SPEND_ENABLED=0` で停止する。Hobbyへ変更した場合は毎時Cronを利用できない。プラン変更は本実装に含まない。

`/api/cron/ad-spend` を `0 * * * *` で実行する。既存のpurchase-conversions Cronは保持する。CRON_SECRET認証必須、Productionかつ明示的有効化時だけ広告APIへ接続する。Previewでは通信・DB書き込みをしない。

最大5広告アカウント、レポート100ページ/アカウント。15秒/HTTP、210秒の取得予算、300秒のCron。DBの5分リースで重複実行を防ぐ。期限切れworkerは保存できない。429やAPI障害に即時の無制限再試行はせず、次の毎時実行で直近3日を取り直す。

## 保存・突合

- ad_spend のキー：platform/account_id/ad_id/JST日付/JST時。広告IDを使うため、同名広告・広告名の変更・複数アカウントを区別できる。外へ返すのは指定された集計列のみ。
- TikTok v1.3 `/advertiser/info/` で広告主ID、実際の請求通貨、アカウントのタイムゾーンを照合。`/report/integrated/get/` は AUCTION_AD / BASIC、dimensions=[ad_id,stat_time_hour]、metrics=[ad_name,spend,impressions,clicks]。広告マスタの有効状態で絞らず、終了した広告の実績も含める。
- **今日を含むJST直近3日**を毎回再取得する。広告アカウントのローカル日付では必要な境界日も含め、時刻をJSTに直して3日内だけ保存する。spendは通貨の主要単位（USDもドル）。売上のUSDセントと混同しない。JPY以外は段階1と同じ固定円換算設定を使う。
- 正常な全ページ取得後に、アカウント単位・3日間をDBトランザクションでdelete/insertする。完全な0行も成功として古い値を消す。ページ欠落・重複・不正数値・権限不足・通貨未設定時は置換せず、前回値と最終成功時刻を保持する。途中取得分を保存しない。
- 広告名をcampaignとして使用。日付/国/source/campaignが一致する診断側の日別キーが1つならそのmediumへ合算。複数mediumがある場合はpaid_socialを優先し、それもなければpaid_socialの広告費行を1つ作る。一致しない広告はcampaign=広告名、medium=paid_social。費用を複数の診断行へ重複計上しない。sourceは広告アカウント設定に記載した正確なutm_source、国も明示設定で固定する（請求国から推測しない）。
- 時間別の広告費も同じ日別キーに帰属。広告費の訂正・消滅時は変更日を記録し、段階1のupsertで古いキーを0にする。3日より前は過去の確定集計を保持する。
- B3は**現在有効な全アカウントの最終成功時刻の最小値**。シート実行時刻では更新しない。初回未取得アカウントがあれば空欄。B4=TikTok Marketing API（X承認待ち）。B5には広告取得の失敗を表示し、診断・売上の同期は続行する。
- 時間を一意に変換できない夏時間終了時の重複時間、およびJSTと正時の境界が一致しない30分/45分オフセットの時間帯は安全に停止する。APIの時間別集計だけではJSTへの正確な分割ができないため、値を推測しない。Tokyo/Seoul/UTCや通常のUS時間帯は変換可能。DSTを使うアカウントでは切替日の保持状態をB5で確認する。

## TikTok：申請と最小限の権限

公式入口は [TikTok API for Business](https://business-api.tiktok.com/portal/)。一般のTikTok投稿APIやEvents APIのトークンとは別物。既存Events APIの認証情報を使い回さない。

1. TikTok for BusinessアカウントでDeveloper登録し、My AppsからMarketing API用アプリを作成する。用途は「自社が管理する広告アカウントの、広告別・時間別のspend/impressions/clicksを社内日報へ読み取り集計」。公開サイト、プライバシーポリシー、連絡先、必要な事業情報・本人確認を実際の運営情報で入力する。申請は運用者が行う。
2. 権限は **Reporting > Consolidated Report** と、advertiser/infoを読むための広告アカウント情報の読み取りを申請する。Campaign/Adの作成・編集、財務操作、クリエイティブ投稿の権限は不要。ポータルの現在の権限表示と、必要な承認対象を確認して提出する。[公式Reporting権限一覧](https://business-api.tiktok.com/portal/docs/api-reference/v2.0)、[公式SDKの実装対象v1.3 Reporting](https://github.com/tiktok/tiktok-business-api-sdk/blob/main/python_sdk/docs/ReportingApi.md)、[広告主情報](https://github.com/tiktok/tiktok-business-api-sdk/blob/main/python_sdk/docs/AccountManagementApi.md)。
3. 審査後、アプリのBasic InformationにあるAdvertiser authorization URLを使い、対象広告アカウントの権限を持つ管理者が同意する。登録済みredirect URLだけを使用する。対象広告主IDは文字列で控える（長いIDを数値へ変換しない）。[公式の広告主認可手順](https://business-api.tiktok.com/gateway/docs/index?doc_id=1738373141733378)。
4. 取得した短命なauth_codeを使い、公式API Explorer等から `/open_api/v1.3/oauth2/access_token/` にapp_id/secret/auth_codeを送ってAccess Tokenを取得する。auth_codeやsecretをチャット・URL共有・Git・スクリーンショットへ出さない。App Secretは取得時にだけ必要で、今回の定期ジョブには保存不要。
5. 取得したTokenが対象advertiser_idを含み、advertiser/infoとレポートが読み取れることを確認する。アクセス有効期限・再認可方法は実際の発行結果とポータルに従う。失効・認可取り消しはB5に出る。API利用に課金契約を求められる場合は契約せず、この処理を無効のまま保つ。

### 運用者が入力する環境変数

Productionにのみ設定する。ソース・NEXT_PUBLIC_*・Apps Scriptには広告Tokenを置かない。実値はこの文書へ書かない。

| 変数 | 設定 |
| --- | --- |
| CRON_SECRET | 既存Cronと同じ認証設定を使用 |
| HYPER_TIKTOK_AD_ACCOUNTS | 下のJSON配列。最大5件。IDは文字列 |
| TIKTOK_MARKETING_ACCESS_TOKEN | 認可済みのMarketing API Access Token |
| HYPER_REPORT_FX_JPY_PER_UNIT | 段階1と同じJSON。例：`{"krw":0.1193156,"usd":150}`。KRWは既存日報の固定値、USDの150は仮値なので採用レートへ置換。JPYは不要 |
| HYPER_AD_SPEND_ENABLED | 設定と権限検証が完了してから1。それまでは未設定/0 |

```json
[
  {"advertiserId":"<JP広告主ID>","country":"jp","source":"tiktok"},
  {"advertiserId":"<KR広告主ID>","country":"kr","source":"tiktok","tokenEnv":"TIKTOK_MARKETING_ACCESS_TOKEN_KR"}
]
```

sourceは実際のUTM値と完全一致させる。KR広告主が別Tokenなら `TIKTOK_MARKETING_ACCESS_TOKEN_KR` も登録する。1広告アカウントが複数国へ配信される場合は国別広告主として誤って登録せず、国別レポート拡張を別途検討する。この実装はアカウント→国の明示的対応を前提にする。

## X：承認後に行うこと

このPRではXのTokenを要求せず、Xへ通信しない。

1. [X公式のAds API導入手順](https://docs.x.com/x-ads-api/getting-started/step-by-step-guide)からDeveloperアカウントとAppを用意し、AppごとにAds API Access Formを提出する。用途は自社広告アカウントの集計レポート読み取り。
2. Analyticsを含む **Standard Access** を申請する。Conversion Onlyでは広告費を読めない。既存のConversion API許可があってもAnalytics許可があるとは限らない。
3. 承認後、公式手順に従いユーザーAccess Tokenを再発行する。OAuth 1.0a用Consumer Key/Secret、Access Token/Secretと対象Ads account IDを安全に保管する。広告アカウントではレポート閲覧に必要な役割を持つユーザーで認可し、予算・広告の編集を実装しない。
4. Ads APIの利用条件・課金が追加費用なしで満たせることを確認してから、X取得と認証実装を別の承認済み変更で追加する。一般のX APIの有料プランをこの日報のために購入しない。請求通貨・タイムゾーン、アカウントと国/source対応を確認する。

## マージ承認後の適用順序と検証

1. 段階1を先に適用済みにする。DB履歴とremote schemaを再確認し、段階2 `20261022070001_hyper_report_ad_spend.sql` を隔離環境で検証してから、明示承認されたDBにのみ適用する。元の予定番号20261022060000は別作業のpurchase_conversion_cron_configが適用済みだったため使用しない。
2. 段階2 API/Cron設定を承認後に配布する。有効フラグ未設定時は何も取得しない。Apps ScriptのB5広告エラー反映の小変更も追加する。15分トリガーは既存1本を維持する。
3. 運用者が上記環境変数を登録し、TikTok認可が終わってから有効化する。無認証Cron=401、Preview=skip、ページ失敗=前回保持、0行=古い費用消去、B3の鮮度を確認する。
4. 同じ3日間を再実行し、重複が増えず、TikTok管理画面とspend/impressions/clicksが一致すること、同名campaignの行へ1回だけ合算されることを確認。管理画面のタイムゾーンと換算レートも揃える。API認証情報未入力のため、PR時点では実広告APIとの照合は未実施。

テスト: `node scripts/hyper-ad-spend-test.mjs`、`node scripts/hyper-report-sync-test.mjs`、`HYPER_TEST_ADS=1 HYPER_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node scripts/hyper-report-sql-test.mjs`。既存のraw同期テスト、ESLint、TypeScript、段階1＋段階2だけを適用した隔離本番buildも行う。

停止はHYPER_AD_SPEND_ENABLED=0。すでに保存済みの費用は維持し、B3は前回成功時刻を表示する。Cronを外す場合はVercel設定変更と再配布を承認後に行う。段階1の集計同期は継続する。段階2のDB関数を戻す場合は、先にAPI/有効フラグを戻し、hyper_report_dayの段階1実装を復元する。既存raw同期やad_spendの履歴を削除しない。
