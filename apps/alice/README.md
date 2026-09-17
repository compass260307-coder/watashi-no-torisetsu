# Alice mobile app

状態: 技術資産として保守中。新規プロダクト開発は休止。

現在の事業方針では、Webが無料集客・招待・初回課金、LINE上のAlice Plusが日本の継続課金、アプリが将来の世界共通コミュニティを担います。事業判断は [`docs/BUSINESS_CONSTITUTION.md`](../../docs/BUSINESS_CONSTITUTION.md) を正本とします。

このディレクトリは、既存の「ワタシのトリセツ」Web診断を入口にするReact Native + Expoアプリとして実装したPhase 1〜3の基盤を保持しています。既存コードの技術仕様は `docs/alice-app-system-design-v3.1.md`、UIは `docs/alice-app-ui/color-system-v1.md` を参照します。ただし、旧サブスクリプションアプリ案を現行ロードマップとして扱いません。

## Setup

```bash
cd apps/alice
cp .env.example .env
npm ci
npm run ios:go
```

`.env` には開発環境の公開値だけを設定します。

- `EXPO_PUBLIC_API_BASE_URL`: 既存Next.jsのURL。iPhone実機ではMacのLAN内IPを使用
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: publishable keyまたはanon key
- `EXPO_PUBLIC_REVIEW_LOGIN_ENABLED`: App Store審査用ログインを表示する場合だけ`true`。本番の通常配布では`false`
- `EXPO_PUBLIC_ALICE_JOURNAL_PROTOTYPE_ENABLED`: journal prototypeを表示する場合だけ`true`
- `EXPO_PUBLIC_ALICE_PROFILE_PROTOTYPE_ENABLED`: profile prototypeを表示する場合だけ`true`
- `EXPO_PUBLIC_ALICE_TAROT_PROTOTYPE_ENABLED`: tarot prototypeを表示する場合だけ`true`

AI API key、Supabase service role key、RevenueCat secretは絶対にExpoへ設定しません。

## 実装状況

旧計画のPhase 1〜3の基盤を実装済みです。migrationは番号順に管理し、既存環境を保守する場合は対応するNext.js APIとの整合を維持します。

- Phase 1: Web `/alice`、移管コードAPI、Supabase Auth、診断snapshot移管
- Phase 2: 個人単位の7日cycle、daily start／complete、10問回答、途中保存
- Phase 3: bootstrap、subscription entitlement、利用枠管理、会話履歴、Node.js SSE対話

journal、profile、tarotはUI検証用prototypeです。固定サンプルを含み、上記の公開環境フラグは本番既定値をすべて`false`にします。正式機能や保存済みユーザーデータとして扱いません。

## 再開条件

新規機能、RevenueCat接続、ストア申請へ進む前に、次を決定します。

1. 世界共通コミュニティの対象ユーザーと、ユーザー同士がつながる目的。
2. Web診断・友達招待・Alice Plusからアプリへ移る必然性。
3. コア体験、北極星指標、継続率、安全性指標。
4. Web買い切り・Alice Plus・アプリ間の商品と権利の関係。
5. 既存のdaily、journal、chat、tarot実装の再利用・廃止範囲。

これらをコミュニティPRDとして承認するまで、アプリは保守対象に限定します。

Next.js側には機能ごとの環境変数を設定します。

- `ALICE_TRANSFER_CODE_SECRET`: コード／claim ticketのHMAC専用secret。未設定時は既存のサーバー秘密鍵へfallback
- `ALICE_DAILY_ENABLED`: daily APIとbootstrap導線を有効化

アプリ版の対話機能は提供終了扱いです。`POST /api/app/v1/chat` は常に `410 Gone` を返し、Vercel AI Gatewayへ接続しません。

`EXPO_PUBLIC_`で始まる値はアプリへ同梱されます。service role key、AI API key、`ALICE_TRANSFER_CODE_SECRET`はNext.js側だけに設定してください。

## Commands

```bash
npm start          # development client向けMetro
npm run ios:go     # Expo GoでiOS UIをすぐ確認
npm run ios        # iOS development build
npm run android    # Android development build
npm run lint
npm run typecheck
npm run doctor
```

EASの用途は `development`、`development-simulator`、`preview`、`production` の4 profileに分離しています。

## Current Mac note

このリポジトリの親フォルダ名には結合文字を含む日本語があり、CocoaPods 1.17 + Ruby 4ではReact Nativeのpodspec処理が文字コードエラーになります。アプリコードやExpo bundleには影響しません。

- 日常のUI確認: `npm run ios:go`
- native機能込み: EASの `development-simulator` / `development` buildを使用
- ローカルnative buildが必要な場合: ASCIIだけのパスへcheckoutして `npm run ios`
