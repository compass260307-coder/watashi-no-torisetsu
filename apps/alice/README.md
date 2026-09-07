# Alice mobile app

既存の「ワタシのトリセツ」Web診断を入口にする、React Native + Expoアプリです。システム仕様はリポジトリ直下の `docs/alice-app-system-design-v3.1.md` を正とします。

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

AI API key、Supabase service role key、RevenueCat secretは絶対にExpoへ設定しません。

## Phase 1 backend

Web診断の引き継ぎ基盤まで実装済みです。

- Web発行画面: `/alice`
- API: `/api/app/v1/transfer/codes`、`validate`、`consume`
- DB: `supabase/migrations/2026-08-28-alice-phase1-transfer-foundation.sql`

DB migrationを適用してからAPIを公開します。Next.js側には任意で次を設定できます。

- `ALICE_TRANSFER_CODE_SECRET`: コード／claim ticketのHMAC専用secret。未設定時は既存のサーバー秘密鍵へfallback

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
