# 古い画面のJS欠損から購入導線へ復帰する

## 動作

- `next.config.ts` の fallback rewrite は、ファイル・ページの解決後に、存在しない `/_next/static/**/*.js` だけを復旧用Route Handlerへ送る。存在するJSを別世代のJSで置き換えない。
- GETは固定の復旧スクリプトを返す。Nextのchunkとしての互換性を偽装せず、最新HTMLの読み直しに使う。ブラウザ/CDNとも `no-store`。HEADは、以前のHTMLに埋め込まれた404検知との互換用に404を維持する。
- 古いHTML側の `__wtAssetRecovery` フラグに妨げられず起動するため、既に開かれた旧画面にも、次に欠損JSを要求した時点で届く。
- 自動復帰は保存済み結果の `/me/[token]` とen/ko/id版だけ。入力・変更、入力欄の値、開いているモーダル、編集可能領域があるときは、更新の案内を表示する。
- 自動更新はタブ内で60秒に1回まで。sessionStorageが使えない場合も案内に切り替える。復帰に伴う購入APIの自動実行はしない。
- 結果URL・既存クエリ・ハッシュ・Cookie・localStorageを維持し、`_wt_asset_refresh` で古いHTMLキャッシュを避ける。診断回答や本人トークンを復旧診断記録に追加しない。

既に全リソースの読み込みが終了して通信しないタブには、サーバーだけで新しい処理を注入できない。次のJS要求または再読み込みから復旧する。Vercel上でのキャッシュ・rewriteの動作確認は、許可されたPreview検証を経てProductionでも行う。リリースは `WORKSPACE_RELEASE_POLICY.md` に従い、今回の修正だけをmainへ統合する。

## ローカル検証

```sh
node scripts/static-asset-recovery-test.mjs
npx eslint next.config.ts src/lib/static-asset-recovery.mjs src/app/api/static-asset-recovery/route.ts scripts/static-asset-recovery-test.mjs scripts/static-asset-recovery-routing-test.mjs
npx tsc --noEmit --incremental false
npm run verify:commerce
npm run verify:checkout-measurement
```

ブラウザ検証は旧HTMLと欠損JSを再現し、実際の `FullAccessCta` とStripeへの遷移関数を使用する。決済API・Stripe画面はローカルのモックで、外部リクエストは遮断する。本人情報・流入情報・購入後クエリの保持、既存入力の保護、更新ループ防止、復帰後の1回の購入要求を検証する。

本番ビルド後にローカルで `next start` し、次を実行する。

```sh
STATIC_RECOVERY_BASE_URL=http://127.0.0.1:3187 node scripts/static-asset-recovery-routing-test.mjs
```

ルーティング検証はローカルホストだけに接続する。欠損JSの復旧応答、GET/HEADとキャッシュ制御、現行診断画面の全JSが置換されないこと、無関係な404が維持されることを確認する。

2026-11-05: ブラウザ43項目、対象ESLint、ルートTypeScript、価格契約48項目、決済計測検証に成功。親HEADに今回の差分だけを入れた隔離コピーで、インストール済みNext.js 16.4.1を使ったwebpack本番ビルドも成功。実資格情報を使わず、外部API通信を遮断して検証した。
