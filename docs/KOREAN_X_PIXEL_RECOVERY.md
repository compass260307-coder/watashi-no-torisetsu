# 韓国X広告のコンバージョン計測復旧（2026-10-21）

## 対象と動作

- Pixel: `rh617`
- 診断完了: `tw-rh617-rh619`、payload `{}`
- 購入完了: `tw-rh617-rh61c`、payload `{}`
- 基準コード: `dcfbee73`（本番main）。既存の5つのPixel設定・イベント・金額条件・送信済みキーを維持する。
- ベースタグは既存の共通ローダーへ追加し、`/ko`以下で初期化する。共通URLで韓国語のコンバージョンを送る場合は、その直前に初期化する。`uwt.js`は共通の1本だけで、rh617のconfigもdocument内で1回。
- 診断保存APIが成功した後だけ、ユーザーIDに対応する10分有効のタブ内完了マーカーへ韓国語の出自を付ける。本人結果の既存ゲートを維持する。結果URLや過去の韓国ページ訪問だけでは発火しない。
- 購入APIはStripeから取得し直したセッションの言語を返し、`ko`の場合だけ対象イベントを追加する。支払済み・完了・買い切りの検証、署名、実際の金額／通貨、および`cs_live_`の制限を維持する。キャンセルURL、クエリーや表示言語から購入を推測しない。
- 既存のメモリ、sessionStorage、localStorage、Web Locksを使う。購入はStripeセッション単位、韓国語診断は保存アクション単位で重複を防ぐ。過去に送信済みの購入は復旧時に再送しない。
- 広告ブロック、ストレージ制限、通信断時も診断・購入画面は継続する。送信済みはtwqへの受け渡し成功を指し、X側の受信確認ではない。ストレージを消した場合や別端末間の重複防止は保証しない。

## 検証

- `X_PIXEL_BASELINE_REF=dcfbee73 node scripts/x-pixel-regression-test.mjs`
  - 既存5アカウントとの110ケースの差分比較。
  - 各言語、通貨、期限切れ／未保存／失敗、イベント別再試行、履歴、再読込、タブ間競合、storage拒否。
  - 実際のPurchaseコンポーネント、署名付きprepareルート、Stripeセッション検証関数を使用。Stripe取得・DB・外部送信はstub。
  - クライアント申告の言語を無視し、Stripe metadataの言語を採用することを確認。
- `node scripts/x-pixel-browser-test.mjs`
  - 空のChromeプロファイルで、韓国語から共通結果URLへの移動、診断／購入、reload／複数タブの重複防止と単一ローダーを検証。広告への外部送信は遮断。
- StripeテストAPI: `pm_card_visa`を使ったKRW 4,900のPaymentIntentが`succeeded`、`livemode=false`、`amount_received=4900`となることを再取得して確認。
  - PaymentIntent: `pi_3USo9UF7XNJ6QTia1pwcdEMC`
  - テストWebhookの配信先に本番ドメインがあるため、本番DBへテスト購入を作るCheckout完了は実行していない。実決済確認と、検証済みCheckoutレスポンスを使う発火テストは分離した。
  - テスト決済をXの本番購入コンバージョンへ送らない既存制約を維持。
- `npm run verify:commerce`: 44チェック成功。
- 対象ESLint、`next typegen`後のTypeScript、`npm run build:local`（Webpackによる本番ビルド）成功。
  - 隔離作業場所のnode_modulesリンクをTurbopackが拒否したため、ローカルのみ既存のWebpack用コマンドを使用。Vercel設定変更なし。
- 公開GTM `GTM-K39CJGCF` の配信コードに`rh617`・`twq`・`uwt.js`がないことを確認。リポジトリに同IDの他の設置なし。

## 本番確認と切り戻し

- リリース前の本番: `dcfbee73` / `dpl_CNSEwz7DZabMShYFM3CzvJWazUiE`
- 直前の正常版: `https://watashi-no-torisetsu-et7cml88z-compass260307-coders-projects.vercel.app`
- 切り戻し: 確認済みのVercel `rollback <deployment-url>`を使用し、mainにも復旧内容を反映する。DB変更なし。
- Xイベントマネージャー: `https://ads.x.com/manager/18ce55xun7i/events-manager`
- リリース前はrh617と両イベントの存在を確認。診断最終記録は10/14 18:45、購入最終記録は10/14 07:33。両イベントとも「最近のアクティビティはありません」と表示。
- X Pixel Helperとイベントマネージャーの受信表示は、本番反映後に別途確認する。受信確認できない場合は未確認として報告する。
