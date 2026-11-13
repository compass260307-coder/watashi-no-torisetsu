# チーム開発の環境変数・検証環境

値の正本は環境担当が管理する秘密情報の保管先です。この文書と`.env.example`には秘密値を保存しません。以下はWeb版の参加に必要な設定であり、全運用機能の変数一覧ではありません。

## 環境の役割

| 環境 | アプリ | DB | 決済・送信 |
| --- | --- | --- | --- |
| 各自のMac | `npm run dev:team`、127.0.0.1 | 確認済みの`watashi-dev` | Stripeテスト、ログインメールはローカルデモ |
| 共通の検証環境 | Vercel Preview / 管理者が指定するURL | 開発専用DB | Stripeテスト、必要な連携だけ開発アカウント |
| 本番 | 既存のProduction | 本番DB | 本番課金・配信 |

開発用DBはチーム内でもデータを共有します。テストユーザーを担当者ごとに識別し、別の人のデータを削除しません。schema変更と全体リセットは担当を決め、承認のある操作だけ実施します。

## ローカルで必要な設定

| 変数 | 用途・取得元 | 設定 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | ローカルのリンク先 | `http://127.0.0.1:3000`。別ポートなら変更する |
| `NEXT_PUBLIC_SUPABASE_URL` | 開発専用DB | `.env.example`は既存コードが認識する`watashi-dev`のURL。現在の稼働・schemaは担当者が確認する |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 開発DBの公開クライアントキー | 同じ開発プロジェクトのanon / publishableキー |
| `SUPABASE_SERVICE_ROLE_KEY` | 開発DBのサーバーキー | 同じ開発プロジェクトのservice-role / secretキー。RLSを迂回できるためサーバー内だけで使用する |
| `NEXT_PUBLIC_DISABLE_THIRD_PARTY_MEASUREMENT` | 広告・解析送信の停止 | `1` |
| `LOGIN_MAIL_MODE` | ローカルの認証メールデモ | `preview`。developmentかつloopbackだけで有効 |

`.env.local`に入れます。`NEXT_PUBLIC_*`はブラウザに公開されるため、サーバーキーを入れません。Vercelが返す`[SENSITIVE]`は実際の値ではなく、入力済みとして扱えません。

`npm run dev:check`は既存の開発DBだけを許可します。別の開発DBを追加する際は、接続先を確認し、チェッカーと`src/lib/third-party-measurement.ts`の開発用参照をまとめて更新・検証します。

## 担当機能ごとの追加設定

| 機能 | 変数 | 準備 |
| --- | --- | --- |
| Stripe Checkout | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 同じStripeテスト環境の`sk_test_` / `rk_test_`、`pk_test_`キー |
| Stripe Webhook | `STRIPE_WEBHOOK_SECRET` | ローカル転送用listenerの署名secret。共通Previewのsecretとは別 |
| 既存Priceの利用 | `STRIPE_PRICE_FULL_ACCESS`, `STRIPE_PRICE_FULL_ACCESS_KRW`, `STRIPE_PRICE_UNMEI_899`, `STRIPE_PRICE_UNMEI_400` | 対象機能が参照するテストPriceだけ設定。現行カタログ・Checkout実装と金額/通貨/種別を照合。空欄時の挙動は経路ごとに異なる |
| AI生成 | `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` | 実装が参照する開発用キーと費用枠。利用しない場合は空欄 |
| Googleログイン | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 開発用OAuthクライアントとcallback。[Google設定手順](GOOGLE_LOGIN_SETUP.md) |
| LINE | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_LOGIN_CHANNEL_ID`, `NEXT_PUBLIC_LINE_LIFF_ID`等 | 開発用チャネル・LIFF。担当機能の参照変数とcallbackを確認 |
| 実メール | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `LOGIN_CODE_SECRET` | 実送信が必要なときだけ受信者・送信範囲を決める。共通のローカル手順はデモを使う |
| 定期処理 | `CRON_SECRET` | 環境ごとの値。サンプル確認のために本番cronを手動起動しない |

キーを空欄にしても全画面が動くわけではありません。DBが必要なAPIは設定を要求し、AI生成・決済・LINEなどは必要な設定がそろうまで検証対象外です。ローカル設定チェッカーは外部通信を遮断する仕組みではなく、入力ミスを見つける補助です。

## Stripeのローカル検証

Stripe CLIを導入し、自分のアカウントで対象のテスト環境へログインした決済担当だけが実施します。

```bash
stripe listen --forward-to http://127.0.0.1:3000/api/webhook/stripe
```

表示されるlistener用secretをローカルの`STRIPE_WEBHOOK_SECRET`に設定し、アプリを再起動します。値を共有文書には貼りません。

```bash
npm run dev:check -- --checkout
npm run dev:team
```

開発アプリから作成したCheckoutをテストモードで完了し、その購入のWebhookと開発DBの権利反映を確認します。任意の`stripe trigger`だけで、アプリ固有のmetadataや購入フローが確認できたと扱いません。Price IDの文字列からテスト/本番は判断できないため、同じテスト環境に存在することと商品カタログの内容を確認します。

## 検証環境を共有する前の管理者作業

1. GitHubメンバーのユーザー名とレビュー・リリース担当を決める。
2. `watashi-dev`が利用可能で、必要なmigration・RLS・関数が適用済みか、管理者が履歴とschemaを確認する。`supabase/schema.sql`だけで最新環境を再現できると仮定しない。現在、Supabase CLIのローカル起動設定はリポジトリにない。
3. 開発用キーの安全な配布方法を用意する。サーバーキーは開発に必要なメンバーだけへ渡す。
4. Vercel Developmentにローカル用の変数を登録するか、管理された秘密情報の保管先から各自へ渡す。設定前に対象プロジェクトと環境を確認する。
5. PreviewのDB・Stripe・Webhook・AIキーが開発用であることを確認する。Productionからの一括コピーはしない。ブランチ別の上書きも確認する。
6. 共通確認用のURLを選び、戻り先・共有URL・OAuth・Webhookを一致させる。
7. 架空の診断→友達回答→Stripeテスト決済→権利反映を実施し、結果をPRに記録する。

### 既存コードで確認が必要な点

- `src/lib/site-url.ts`の`resolveSiteUrl()`は、未設定と`vercel.app`のURLを本番ドメインへ変換する。ローカルでは明示的なloopback URLを使う。共通検証URLでは、検証専用ドメインの用意、またはPreviewだけを扱うURL解決の変更が別途必要。今回の共有準備では本番のURL処理を変更しない。
- ローカルのメールデモは`NODE_ENV=development`かつloopback限定。Vercel Previewでは同じデモは使えない。
- DB migration適用、Vercel設定変更、push/デプロイは[既存のリリース方針](WORKSPACE_RELEASE_POLICY.md)の明示承認に従う。

## 2026-11-13の準備確認

| 対象 | 確認結果 |
| --- | --- |
| Node | Vercelは24.x、今回のローカル検証は24.14.0 / npm 11.9.0 |
| Vercel Development | 登録変数0件。新規参加者へこの環境からキーを配布する準備は未完了 |
| Vercel Preview | 環境変数と一部ブランチ別設定あり。計測停止の設定あり。既定のDB接続先はコード内の`watashi-dev`参照と異なるため用途の確認が必要 |
| Previewの秘密値 | pull結果には`[SENSITIVE]`が含まれ、接続先・キーの有効性をすべて確認できない。テスト環境として検証済みとは扱わない |
| 開発DB | コードに`watashi-dev`の参照あり。今回、リモートschema・キーの有効性・データ状態は未確認 |
| ローカル検証 | 設定チェッカーの回帰テスト、ESLint、Next型生成とTypeScript、本番形式build、商品契約48項目、PDF runtime確認が成功。buildは実サービスへ接続しないダミー設定を使用し、実DB・決済のE2E確認は含まない |
| 招待 | 対象メンバーはMac。GitHubユーザー名は参加時に確認 |
| 外部変更 | 今回の準備ではGitHubへのpush、DB適用、Vercel設定変更、デプロイ、招待を実施していない |

上表は準備時点の記録です。管理者作業が終わったら、担当者・日付・検証結果を更新してください。秘密値は記録しません。
