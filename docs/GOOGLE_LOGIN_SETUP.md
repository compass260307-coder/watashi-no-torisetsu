# Googleログイン

日本語のログインカードにGoogleボタンを表示します。既存のメールリンク認証は維持します。

## 設定

Google CloudのGoogle Auth PlatformでWeb applicationのOAuthクライアントを作成し、同意画面のアプリ名、サポート連絡先、公開ドメイン、プライバシーポリシーを設定します。

環境ごとに次のサーバー専用環境変数を設定します。秘密値をチャットやGitへ貼り付けないでください。

```dotenv
GOOGLE_CLIENT_ID=<Web client ID>
GOOGLE_CLIENT_SECRET=<Web client secret>
```

ローカルでは`.env.local`に設定し、開発サーバーを再起動します。未設定でも画面を確認でき、ボタンを押すと準備中の案内へ戻ります。

Authorized redirect URIsに、使用するURLを完全一致で登録します。

- `http://127.0.0.1:3000/api/auth/google/callback`
- `http://localhost:3000/api/auth/google/callback`
- `https://www.watashi-torisetsu.com/api/auth/google/callback`
- apexドメインも使用する場合は`https://watashi-torisetsu.com/api/auth/google/callback`

開発と本番ではOAuthクライアントを分けることを推奨します。Testing状態では必要なテストユーザーを登録します。Previewは別途明示的に許可した固定URLを使います。外部管理画面の設定・本番環境変数の変更・デプロイは別途実施が必要です。

## 動作

- Authorization Code + PKCE、ブラウザに紐付く10分間のHttpOnly / SameSite cookie、state、nonceを使用します。
- `jose`でGoogleの署名、issuer、audience、有効期限、nonceを検証します。要求する情報は`openid email`のみです。
- Googleがメールの管理主体であるGmail / Google Workspaceの確認済みメールだけを、既存の`users.email`へ照合します。外部メールのGoogleアカウントはメールリンク認証へ案内します。
- メールリンクと同じく、同じメールに複数の診断履歴がある場合は最新の行を使用します。
- 同じ確認済みメールの既存アカウントを優先します。見つからず、現在のセッションがメール未登録なら、その診断結果にGoogleの確認済みメールを紐付けます。メール登録済みの別アカウントは上書きしません。
- 現在の未登録セッションも無ければ、無料・未診断のアカウントを作成して診断へ進みます。アカウントの統合、別メールへの変更、購入権限の追加は行いません。
- 1分間有効の内部用ワンタイムリンクを発行し、既存のログイン完了処理へ引き渡します。メールは送りません。別アカウントへの切り替え確認、セッション更新、購入済み結果・未診断購入者の遷移は既存処理を利用します。
- 認証キャンセル、期限切れ、通信障害はログイン画面へ戻します。Googleのアクセストークン・IDトークンは保存しません。

## 確認

```sh
node --experimental-strip-types scripts/google-login-test.mjs
```

設定後は、実アカウントでログイン、キャンセル、既存セッションからの切り替え、登録メール不一致、購入済みアカウントの遷移を確認します。ローカル自動チェックでは実Google認証やDB書き込みは行いません。

参考: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)、[ID tokenの検証とメールの管理主体](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)。

## ログインのやり直し

単独のログイン画面は表示しません。`/login`（各言語版も同様）は現在のセッションの自己診断結果へ戻す入口です。セッションが無い場合は、このブラウザに保存された結果を使います。結果が無い場合のみ診断画面へ進みます。Google認証のキャンセルやメールリンクの期限切れもこの導線に戻し、必要な案内とメールフォームは遷移先のログインモーダルに表示します。モーダルを閉じると遷移先をそのまま閲覧できます。
