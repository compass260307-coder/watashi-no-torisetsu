# 課金コンバージョン計測

Stripe Webhook を正本として、設定済みの広告媒体へ購入イベントをサーバー送信する。
ブラウザの `meta_purchase` と同じ Stripe Checkout Session ID を `event_id` に使うため、
ブラウザ／サーバーの両方から届いても媒体側で重複排除できる。
Checkout作成時に取得できた `_fbp` / `_fbc`、`ttclid` / `_ttp` もStripe metadata経由で
引き継ぎ、各媒体の照合キーとして送る（アプリのイベントDBには生値を保存しない）。

## Vercel環境変数

Metaを有効にする場合は、次の3つを同じ環境に設定する。

- `META_PIXEL_ID`
- `META_CONVERSIONS_API_TOKEN`
- `META_GRAPH_API_VERSION`（Meta Events Managerで現在利用するバージョン）

TikTokを有効にする場合は、次の2つを同じ環境に設定する。

- `TIKTOK_PIXEL_CODE`
- `TIKTOK_EVENTS_API_TOKEN`

定期再送APIをVercel Cronからのみ呼び出すため、次も設定する。

- `CRON_SECRET`

2026-08-24時点の本番GTM公開コンテナで確認したIDは次のとおり。

- Meta Pixel ID: `2851061085248770`
- TikTok Pixel Code: `D9V8IIBC77UFF28NGHK0`

アクセストークンは公開コンテナから取得できないため、各媒体のEvents Managerで発行する。

秘密値はリポジトリや `NEXT_PUBLIC_*` に置かず、Vercelの
Production／Previewごとに設定する。設定変更後は再デプロイする。
媒体の認証情報が未設定・不完全でも購入処理は止めず、キューに残して
設定完了後の再送対象にする。

## 監査と再試行

- 支払い・返金の正本: `payment_history`
- アプリ内の購入完了ファクト: `purchase_completed` / `unmei_*_complete`
- 媒体へのサーバー送信成功: `server_purchase_conversion_sent`
- ブラウザでGTMへ渡した記録: `meta_purchase_claimed`
- ブラウザでTikTok Pixelへ渡した記録: `browser_tiktok_purchase_pushed`
- サーバー送信待ち／再送: `purchase_conversion_outbox`

Webhook内では決済・権限・購入イベントとキュー投入までを必須にする。
これらは単一のDB transactionではないが、Stripe Checkout Session IDを共通の
冪等キーにして順番に保存し、途中で失敗した場合はWebhookを500にしてStripeの
再送で安全に再開する。キューのclaimはDB関数内で行ロックを取り、原子的に
`processing`へ遷移させる。
媒体API通信は応答後に即時実行し、失敗時は1時間ごとのVercel Cronが
指数バックオフ（最大24時間）で再送する。媒体障害はStripe Webhookの
200応答、購入権限、購入メールを巻き込まない。再送時も `event_id` は
Stripe Checkout Session IDのままで、成功済み媒体は監査行を見てスキップする。

デプロイ時は先に `2026-08-24-purchase-conversion-outbox.sql` を適用し、
その後にアプリをデプロイする。順序を逆にすると新規決済のWebhookが
キュー保存で再試行になる。

## ブラウザ計測との整合性

`meta_purchase` はMeta Purchase・GA4 Purchase・Yahoo検索広告へ送る前提とし、
TikTok Purchaseはアプリから直接補完する。GTMを変更する場合も次の対応を維持する。

- Meta InitiateCheckout: Data Layer変数 `value` / `currency`
- Yahoo購入: Data Layer変数 `value`
- TikTok購入タグを追加する場合: イベント名を `Purchase`、Event IDを `event_id` にし、
  アプリの直接送信との重複排除を維持
