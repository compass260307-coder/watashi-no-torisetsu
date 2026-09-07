# Alice mobile app

既存の「ワタシのトリセツ」Web診断を入口にする、React Native + Expoアプリです。システム仕様はリポジトリ直下の `docs/alice-app-system-design-v3.1.md` だけを正本とし、UI実装は `docs/alice-app-ui/color-system-v1.md` のカラールールに従います。

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

Phase 1〜3の基盤を実装しています。migrationは番号順に適用し、対応するNext.js APIを同時に公開します。

- Phase 1: Web `/alice`、移管コードAPI、Supabase Auth、診断snapshot移管
- Phase 2: 個人単位の7日cycle、daily start／complete、10問回答、途中保存
- Phase 3: bootstrap、subscription entitlement、利用枠管理、会話履歴、Node.js SSE対話

journal、profile、tarotはUI検証用prototypeです。固定サンプルを含み、上記の公開環境フラグは本番既定値をすべて`false`にします。正式機能や保存済みユーザーデータとして扱いません。

Next.js側には機能ごとの環境変数を設定します。

- `ALICE_TRANSFER_CODE_SECRET`: コード／claim ticketのHMAC専用secret。未設定時は既存のサーバー秘密鍵へfallback
- `ALICE_DAILY_ENABLED`: daily APIとbootstrap導線を有効化
- `ALICE_CHAT_ENABLED`: entitlement確認付きの対話APIを有効化
- `AI_MODEL_DIALOGUE`: AI Gatewayの`provider/model`。未設定時はサーバー既定値を使用

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
