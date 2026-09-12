# 診断完了の流入medium・日報連携

2026-09-12実装・本番反映済み。DB、Web、Apps Script、JP/KRのraw構造・参照式を更新。日報の表示追加は対象外。

## 調査結果

- 共通root layoutは `utm_medium` を `wt_ad_utm_medium` に保存済み。広告CV計測用last-touchで、診断APIは送信・保存していなかった。
- 本番Supabase REST/OpenAPIを読み、`users` には `acquisition_source` / `acquisition_campaign` / `acquisition_locale` / `diagnosis_completed_at` があり、medium専用列がないことを確認。既存の公開テーブル定義にもutm/medium専用列は見つからなかった。
- Supabase SQL管理画面で本番の適用済み履歴・schemaを確認。適用前の最新履歴は `20260909120000`、今回のtimestampは未登録。隔離DBで検証後、今回のDDLと履歴だけを1トランザクションで適用した。RESTでも新列のSELECTが200で成功。
- 本番 `diagnoses_raw` はA:Hの8列、102,503行のグリッド。現行APIは完了日時＋IDの複合カーソルで差分取得し、Apps Scriptは診断参照IDで重複除外。
- JP/KRとも同一 `DiagnosisPageContent` → `/api/diagnosis` を利用。localeは `ja` / `ko`。日付はJST（韓国と同じUTC+9）。

## 追加列

| 保存先 | 列 | 内容 |
| --- | --- | --- |
| `public.users` | `acquisition_medium` | 同じ流入から得たutm_medium。任意・NULL可。APIでtrim、最大100文字。DBにも長さ制約。 |
| `diagnoses_raw` I列 | `acq_medium` | 保存された値。NULLは空欄。 |
| `diagnoses_raw` J列 | `acq_channel` | `広告` / `自然流入` / `不明`。APIでmediumから算出。 |

A:H (`completed_at,date_jst,hour_jst,diagnosis_ref,type_id,locale,acq_source,acq_campaign`) の順序、参照ID、カーソル形式は変更しない。売上API・sales_rawの列・売上集計も変更しない。旧 `/api/metrics/raw?table=users` は今回の日報同期経路ではないため変更しない。

## 分類ルール v1

判定時のみtrim＋小文字化し、次の完全一致リストで分類する。rawには元の保存値を出す。

| 分類 | medium |
| --- | --- |
| 広告 | `paid_social`, `paid_search`, `paid_video`, `paid_display`, `paid`, `cpc`, `ppc`, `cpm`, `cpv`, `cpa`, `display`, `retargeting`, `remarketing` |
| 自然流入 | `organic`, `organic_search`, `organic_social`, `organic_video`, `organic_referral` |
| 不明 | 空欄、NULL、未定義の値、それ以外すべて |

- `social`, `referral`, `email`, `direct` は、それだけでは広告利用の有無を確定できないため「不明」。自然流入として計測する管理リンクには上記の明示的なorganic系mediumを使う。
- sourceがtiktok/google/meta等でも、それだけで広告・自然流入を判定しない。
- campaignがあっても広告と推定しない。`fbclid`、`ttclid`、referrerだけからmediumを生成しない。既存のttclidによるsource=tiktok補完は維持するが、クリックID自体をDB・rawへ保存しないため、この仕様ではmediumがなければ分類は不明。
- UTMはリンクに付けた申告値であり、広告媒体の請求・クリック実績と照合した確定値ではない。
- 分類の正本は `src/lib/acquisition-channel.ts`。リスト変更時は既に同期されたJ列の再分類方針も別途決める（通常同期は過去行を書き換えない）。

## 取得・保持・保存

選択した層のsource/campaign/mediumを**一組**として使い、欠損を別の層から継ぎ足さない。

1. 現在URLの `utm_source`（無ければ`ref`）、`utm_campaign`（無ければ`camp`）、`utm_medium`。
2. 同じタブの着地URLを保持した `sessionStorage.wt_acq_session_v2`。現在URLの優先権を診断への遷移・リロード後も維持する。
3. localStorageのfirst-touch (`wt_acq_source`, `wt_acq_campaign`, `wt_acq_medium`)。
4. 既存の広告計測用last-touch (`wt_ad_utm_source`, `wt_ad_utm_campaign`, `wt_ad_utm_medium`)。
5. 既存のttclidによるsource=tiktok補完、次に外部referrerのsource補完。mediumはNULL。

直接クエリに流入項目がなければ `liff.state` / `state` 内も見る。root layoutの同期インライン処理でReactの描画・リダイレクト前に保存。JP・KR共通。現在URLに1項目でもあればその層を優先し、別層の値を混ぜない。

新しいfirst-touchは欠損も含め一組で固定する。従来の項目別追記は、別着地のsourceとcampaign/mediumが混ざるためやめる。既存の `wt_acq_source` / `wt_acq_campaign` は上書きせず、旧保存値へ後日のmediumを補完しない。新しいURLがあるタブではsessionの組を優先するため、着地時と診断完了時の帰属が揃う。タブを閉じた後は従来のfirst-touch優先へ戻る。

保存先は新規診断の既存INSERT。購入先行などで作られた未診断placeholderは、既存の帰属が全て空の場合だけ初回完了時のUPDATEに一組を追加する。再診断は既存medium・source/campaign・初回完了日時を上書きしない。

ブラウザがstorageを拒否した場合は診断を妨げず、現在URLから取得可能な範囲で保存する。storageが両方使えずURLも消えた場合の保持は保証できず、推定で埋めない。

## 過去データ・表示側での扱い

- migrationはnullable列追加だけ。UPDATE/backfill/defaultなし。過去のcampaign/sourceからmediumを作らない。
- 既にSheetsにある行のI/Jは空欄のまま。**J空欄も集計上は不明**に含める。今後APIで取得するmediumなしの行はI空欄、J=`不明`。
- 同期カーソルを戻さず、全件再同期もしない。既存行を再診断で埋め直さない。
- 各日の広告比率・自然流入比率・不明比率の分母は、対象localeの**全診断完了人数**とする。判明分だけを分母にしない。
- JPの9/1=619件、9/2=2,926件は既存日報の固定補正で、rawに全件対応する行がない。これらの内訳も不明として扱う。架空のraw行は作らない。

## JP→KR参照調査と移行

確認したファイル:

- JP元: `1J7257eFLp8nhO6aUtZyML6hoNltbjHKg4D-nLkxoKec`
- JPから参照するKR版: `13uBekL9JZfzNWFxqiCQHOxTalFxBhx3scWFfdj6cGoU`
- 同名の別KR版 `1KHmcMSWd1pVYQQ42A1mO7x4m9wNBJK0jZvL37Sam6ms` はdiagnoses_raw!A1が固定ヘッダーで、上記のIMPORTRANGE版とは異なる。移行対象に含めない。

現行 `_KR共有データ` は診断=A:H、友達診断=I:V、売上=W:AP、件数=AQ1。診断FILTERをA:Jへ単純拡張すると友達診断の式に衝突する。

移行用 `scripts/google-sheets-acquisition-upgrade.gs` はJPに `_KR診断共有` を作り、診断A:Jだけをlocale=koで共有する。既存 `_KR共有データ` は維持し、KRのdiagnoses_raw!A1の既存IMPORTRANGE **1本を置換**する。KRにも末尾I/Jを追加。参照エラー時の作成時点控え（旧8列）には空欄2列をHSTACKする。

友達診断・売上のIMPORTRANGE、固定バックアップ、JP集計参照は変更不要。JP/KR日報の診断数はB（日付）・F（locale）、媒体集計はG、売上は別rawのL/C/M/I/Sを参照しており、末尾追加の影響を受けないことを実ファイルの式で確認した。

共有タブ・KRグリッドの既存上限10,000行は維持する（ヘッダー込み）。IMPORTRANGEは共有タブの `A:J` を1本で参照する。上限を超える前に両方のグリッドを拡張する。移行関数は通常同期へ登録しない。

## リリース順と互換性

リポジトリのAGENTS.md / WORKSPACE_RELEASE_POLICY.mdに従い、DB適用・外部反映・デプロイには明示的な許可が必要。

1. DB管理権限で適用済み履歴とスキーマを再確認。新migration `20260912010000_add_acquisition_medium.sql` のtimestamp衝突がないことを確認し、隔離DBで制約・既存診断保存との互換性を検証。
2. 許可後、対象だけをDBへ適用。全未適用migrationの一括適用やmigration repairはしない。追加列は旧アプリと互換。
3. JPの既存Apps Scriptソース・トリガー設定・カーソルと対象シート式をバックアップし、**実際に稼働しているソースとローカル版を比較してから**診断関連の変更を反映する。実ソースをブラウザで確認・バックアップし、ライブ固有のMETRICS_KEY認証・非診断ジョブは維持した。時間主導トリガーはsyncMetricsRawの15分間隔1本。
4. 更新済みApps ScriptをWebより先に配布する。新スクリプトは旧8列APIにも対応。列移行はヘッダー一致・追加先が空であることを確認し、末尾だけ拡張する。トリガー再作成・カーソルリセットは不要。
5. JPから `upgradeAcquisitionMediumSheets()` を一度実行する。既知のKR参照式と一致しない場合は停止する。既存3データの配置を変えず、新規診断共有タブとKRの診断参照だけを更新する。
6. 許可後にWebをPreviewで検証しProductionへ反映。**DB列追加とApps Script更新より先に新Webを配布しない**。新APIは10列を返すため旧Apps Scriptの厳密ヘッダーチェックではエラーになる。CLIはタスク専用の59.16.0を使用。Preview DBが未構築のため、migrationは隔離トランザクションで検証し、WebはProduction環境の `--prod --skip-domain` で公開ドメインを動かさず検証する。Production秘密値をPreviewへ転用しない。
7. JP/KRの管理テスト流入で初回診断を完了し、DBの一組・locale・完了日時、次の既存15分同期でrawのI/J、KRの同一参照IDとI/Jを読み戻す。広告/自然/mediumなしを確認する。テスト診断が本番人数に入る点を管理する。同期呼び出し・トリガーを追加しない。

アプリを旧版へ戻しても新Apps Scriptは旧8列APIを受け入れる。列は残せばよい。運用済みデータを含むmedium列のDROP、カーソル巻き戻しは行わない。

## 検証記録

- `node scripts/acquisition-medium-test.mjs`: 成功。実際のインラインキャプチャ、型付き流入解決、診断POSTハンドラー、createSessionのINSERT、日報GETハンドラー、Apps Scriptを実行し、ブラウザstorage・DB・Sheetsだけメモリアダプターへ置換。
- JP/KRの遷移・再読込、first-touch、旧値と広告値の非混合、LIFF、storage拒否、分類、保存正規化、再診断非補完、placeholder初回保存、認証、ページング、末尾列拡張、1ページ1HTTP取得、カーソル維持、再実行重複除外、旧API互換を確認。
- 既存salesジョブと15分トリガー関数はHEAD版と同一であることをテストで確認。
- 対象ESLint（変更アプリファイル＋追加テスト）成功。`tsc --noEmit --incremental false` 成功。`npm run build:local`（Next.js本番webpackビルド）成功。
- JP→KR移行関数の対象ID検証・式変更検知・再実行・1本のIMPORTRANGE・10列の控え・追加HTTP取得なしもローカルアダプターで検証。
- `git diff --check` 成功。ローカルコミットと反映後の記録は下記参照。Git pushは行わない（Vercel CLIで反映）。
- 実DBのmigration適用と初回保存、Google Sheetsの式評価、JP/KRブラウザ実画面での50問完了・遷移・リロードまで追加検証。通常同期の結果は下記参照。

## 2026-09-12 反映記録

- ユーザーの「反映して下さい」によりDB・日報・Webの本番反映を承認。
- 本番DBに `20260912010000_add_acquisition_medium` を適用。隔離DBで既存行NULL維持、100文字許容、101文字拒否を確認しROLLBACK。本番には過去行UPDATEなし。
- Apps Scriptの診断ヘッダー、旧8列API互換、末尾列拡張、数式注入対策を保存。ライブの認証方式・他ジョブを維持し、保存後にソース全文一致を確認。
- 移行helperは実行アカウントからKRファイルを開けず、書き込み前に停止。権限を増やさず、接続済みGoogle Sheets APIで同じ限定変更を実行した。
- JP diagnoses_rawを8→10列へ拡張しI1/J1を追加。新規 `_KR診断共有`（gid 190008）は10,000行×10列・非表示。KR diagnoses_rawも10列へ拡張しA1の既存IMPORTRANGEを1本置換。
- JP/KRのI/Jヘッダーと新式の評価結果を再取得して確認。旧共有データ、友達診断・売上の参照式は同一。JPのヘッダー表示も画面確認済み。
- シート構造移行はVercelを呼び出さず、Script Properties・トリガーには触れていない。
- Webを `dpl_8quYDjoQTxKCWD4X6jTDpHTF8MUq` に反映。Production環境の公開前ステージでJP画面→DBを確認後、10:20頃に公開ドメインへpromote。公開URLの割当先READYを再確認。遠隔Turbopack本番ビルド（251ページ）・TypeScriptとも成功。配布入力に既存PDF32件を含み、env・一時ファイルは含まれないことを確認。
- JPの `paid_social` とKRの `organic_social` は、着地URL→サイト内リンク→クエリなし診断ページ→リロード→50問完了→結果画面→DB読み戻しで確認。さらにAPIからJP organic・KR cpc・両言語mediumなし（campaignあり）を初回保存。計6件のmedium・locale・完了日時を検証。
- 新デプロイの01:17 UTC以降の5xxログを確認し、検査時点で0件。
- 変更前10:08の定期同期では shareEvents / lineFollowEvents に `Service timed out: Spreadsheets` が発生していた。診断列変更と別の既存事象として記録。
- 10:23:40の既存トリガーでJP rawへ検証6件が同期され、I/Jと参照IDの一致を確認。行103478/103507/103509/103510/103512/103532。追加の臨時同期は行っていない。
- 同じ通常実行はshareEvents / lineFollowEventsのSheetsアクセスエラーで全体として失敗扱いだが、diagnoses / salesのエラーはなく、診断データは追記済み。
- KRの `A1:J10000` 参照でGoogleの `Import Range internal error.` を実測。同じ共有タブをフルURL＋`A:J`で参照し、グリッド上限10,000行とIMPORTRANGE1本を維持したまま解消した。最終式は移行helperと一致。KR rawの4237〜4239行で広告(cpc)、不明(medium空・campaignあり)、自然流入(organic_social)とJP側参照IDの一致を確認。
- 検証用6件は対象ID・campaign・sourceを再照合し、バックアップ後にDBから削除、JP rawの該当6行の値だけを消去（行位置・書式を維持）。JP共有タブとKR rawでも除去・後続実データの継続を確認。検証用の一時タブとライブApps Scriptの一度限りの移行関数は除去済み。
- 日報実装はmainの `2d36589b` へコミット済み。後続の決済タスクの `6e556b3e` / `dpl_8Knv5LSCQK7QfJwPiY1TfMPKvSko` は日報実装を保持。本タスクの最終追記は移行helper・検証コード・本書だけで、Webの追加デプロイは不要。
- 本番の取得→保存→既存同期→KR参照まで検証完了。日報表示は未追加。既存のshareEvents / lineFollowEventsのSheets側エラーは残存しており、本タスクではジョブ設定を変更していない。

Googleの参照関数は元ファイルの計算完了を待ち、サービス側の更新遅延・内部エラーは別途起こり得る。今回の接続設定タブにも旧参照の内部エラーを確認したが、権限追加は行っていない。[Google公式のIMPORTRANGE説明](https://support.google.com/docs/answer/3093340?hl=en)。
