# Alice アプリ システム設計 v3.1

更新日: 2026-08-28
状態: 正本（v1・v2・v3の設計書を置き換える v3 確定仕様 + AI 原価・審査 account・実装順の追補）

> このファイルをAliceアプリ設計の唯一の正本とする。旧版やUI検討履歴は実装判断に使用しない。2026-09-07時点でPhase 1〜3の基盤を実装済み。journal・profile・tarot画面は固定サンプルを含むprototypeであり、公開環境フラグの本番初期値はOFFとする。

## 1. 設計方針

Alice アプリは、既存 Web の診断資産を入口にし、毎日の自己理解、日記、対話、占いを継続する subscription アプリとする。

- Web: 集客、50 問診断、買い切り商品、引き継ぎコード発行
- Expo: 画面、端末認証、RLS 付き CRUD、RevenueCat SDK
- Next.js API: AI、subscription 認可、利用上限、service role 処理、webhook、通知、定期処理
- Supabase: Auth、Postgres、RLS
- RevenueCat: App Store / Google Play の購入状態統合
- Vercel AI Gateway: Alice のモデル呼び出し
- Expo Push Service: APNs / FCM への通知配信

最重要原則は以下とする。

1. AI API key、Supabase service role key、RevenueCat secret を端末へ載せない
2. タイプ判定、subscription 認可、AI 利用上限はサーバーで確定する
3. Expo が外部サービスへ直接接続するのは Supabase Auth + RLS 付き CRUD と RevenueCat SDK だけに限定する
4. 「週」は全員共通のカレンダー週ではなく、各 account の開始日を基準にした個人 7 日 cycle とする
5. 初期リリースは Web 診断と引き継ぎコードを必須にし、アプリ単体診断は Phase 4 で追加する

## 2. 全体構成

```text
┌──────────────────────────┐
│ 既存 Web / Next.js       │
│ ・50問診断               │
│ ・users / tombstone      │
│ ・買い切り商品（Web限定） │
│ ・引き継ぎコード発行      │
└────────────┬─────────────┘
             │ source解決 / snapshot copy
             ▼
┌──────────────────────────────────────────────┐
│ iOS / Android: React Native + Expo           │
│                                              │
│ ・画面 / ローカル状態 / Deep Link             │
│ ・Supabase Auth                              │
│ ・Supabase RLS付きCRUD（本人データのみ）       │
│ ・RevenueCat SDK（購入・復元・端末側表示）     │
└──────────────┬────────────────┬──────────────┘
               │ HTTPS / SSE    │ JWT + RLS
               ▼                ▼
┌──────────────────────────┐  ┌────────────────┐
│ Next.js Route Handlers   │  │ Supabase       │
│ /api/app/v1/*            │  │ Auth/Postgres  │
│                          │  │                │
│ ・Auth JWT検証            │  │ ・RLS           │
│ ・subscription認可       │  │ ・本人CRUD       │
│ ・AI利用量予約/確定       │  │ ・永続データ     │
│ ・AI context builder     │  └───────▲────────┘
│ ・AI stream              │          │ service role
│ ・引き継ぎ/再コピー       │          │ サーバー限定
│ ・週タイプ計算/保存       │          │
│ ・通知job/Push送信        ├──────────┘
│ ・RevenueCat webhook     │
│ ・削除request処理         │
└───────┬────────┬─────────┘
        │        │
        │        ├──────────────▶ Vercel AI Gateway
        │        │                 モデル呼び出し
        │        │
        │        └──────────────▶ Expo Push Service
        │                          Push送信
        │
        ▲ webhook
┌───────┴─────────┐          ┌──────────────────────┐
│ RevenueCat      │◀────────▶│ App Store /          │
│ 購入状態統合     │          │ Google Play          │
└─────────────────┘          └──────────────────────┘

┌─────────────────┐
│ Vercel Cron      │────▶ /api/app/v1/internal/scheduler
│ 15分間隔         │      ・失敗webhook再処理
└─────────────────┘      ・週cycle確定
                         ・通知job処理
```

### Expo が直接行ってよいこと

- Supabase Auth へのログイン、ログアウト、token refresh
- anon / publishable key + 本人 JWT による RLS 付き本人データ CRUD
- RevenueCat SDK による購入、復元、端末側 CustomerInfo 取得
- Next.js API への HTTPS / SSE リクエスト

### Next.js API に限定すること

- Supabase service role を使う処理
- AI Gateway 呼び出し
- RevenueCat webhook 受信と subscription mirror 更新
- subscription と利用上限を確認した AI 実行
- 引き継ぎコードの検証、消費、再コピー
- 週タイプ確定、週次レポート生成
- Expo Push Service への送信
- account 削除の横断処理

## 3. API 境界と後方互換

アプリ用 API は既存 Next.js プロジェクトの Route Handler に追加し、必ずバージョンを切る。

```text
/api/app/v1/*
```

モバイルアプリは古いバージョンが端末に残ることを前提にする。

- v1 のレスポンス変更は原則フィールド追加だけにする
- 既存フィールドの意味、型を変更せず、削除しない
- 破壊的変更は `/api/app/v2/*` を新設する
- client は未知のレスポンスフィールドを無視する
- 更新系には `Idempotency-Key` または client 生成 ID を必須化する
- リクエストには `X-App-Version`、`X-Platform`、`X-Locale` を付ける
- API の error body は `code`、`message`、`retryable`、`request_id` を共通化する

`GET /api/app/v1/bootstrap` は以下を返す。

- `api_version`
- `min_supported_app_version`
- `latest_app_version`
- `maintenance_state`
- `feature_flags`
- `entitlement_state`
- `active_cycle`

API v1 を終了するときは利用状況を確認し、アプリ内で更新要求を表示してから段階的に停止する。

## 4. account・認証・locale

### 4.1 account と診断の多重度

`accounts.id` は Supabase Auth の `auth.users.id` と同じ UUID にする。

既存 Web の `users` は「人」ではなく「診断 1 件」として扱い、次を確定仕様とする。

```text
accounts 1 ── N account_diagnosis_links N ── 1 Web users
```

- 引き継ぎコードは Web `users` 1 行に対して発行する
- 同一メールの `users` 行を自動統合しない
- 再診断では新しい `users` 行を作り、新しいコードで同じ account に追加する
- account は複数 snapshot を持ち、`accounts.active_base_profile_snapshot_id` が現在利用する 1 件を指す

`account_diagnosis_links`

- `id`
- `account_id`
- `source_user_id`
- `linked_at`
- `linked_via_transfer_code_id`
- `base_profile_snapshot_id`

`source_user_id` は legacy Web のマージで参照先が tombstone になる可能性があるため、Web `users` への DB foreign key は張らない。整合性は引き継ぎ transaction と監査 job で検証する。

- UNIQUE `(account_id, source_user_id)` で同じ診断の二重 link を防ぐ
- `base_profile_snapshot_id` はアプリ側 snapshot への foreign key を張る
- active 判定を link table に重複保持せず、`accounts.active_base_profile_snapshot_id` だけを正とする
- active snapshot の切り替えは snapshot 作成と account pointer 更新を同じ transaction で行う

### 4.2 Supabase Auth provider

初期 provider は以下とする。

- Email OTP / magic link
- Sign in with Apple

Google Sign-In は Android の登録率改善が必要になった段階で追加する。Google などの第三者ソーシャルログインを iOS で提供する場合も、Sign in with Apple を維持する。Apple App Review Guideline 4.8 の同等ログイン要件を審査前に再確認する。
[Apple App Review Guidelines 4.8](https://developer.apple.com/app-store/review/guidelines/)

#### LINE Login の検討

LINE は Supabase Auth の標準 social provider 一覧には含まれない。一方、Supabase は標準外 provider 向けの Custom OAuth/OIDC Provider を提供しており、LINE Login v2.1 は OAuth 2.0 / OpenID Connect に対応している。
[Supabase Custom OAuth/OIDC Providers](https://supabase.com/docs/guides/auth/custom-oauth-providers) / [LINE Login overview](https://developers.line.biz/en/docs/line-login/overview/)

採用する場合の優先方式:

1. LINE Developers で LINE Login v2.1 channel を作る
2. Supabase に `custom:line` を manual OAuth2 provider として登録する
3. authorization、token、userinfo endpoint と `openid profile` scope を設定する
4. メール取得を使わない場合は `email_optional` を有効にする
5. Expo は browser OAuth + deep link で Supabase session を受け取る
6. Email / Apple account との account linking を本人確認付きで行う

工数の目安:

| 範囲 | 目安 |
|---|---:|
| Custom provider 接続の技術検証 | 2〜3 人日 |
| Expo deep link、iOS / Android 実機対応 | 2〜4 人日 |
| account linking、重複・退会・再認証対応 | 3〜5 人日 |
| QA、審査文言、運用手順 | 2〜3 人日 |
| 合計 | 9〜15 人日 |

Custom provider で要件を満たせず native LINE SDK + server token exchange が必要になった場合は、追加で 5〜10 人日を見込む。初期リリースには含めず、Web 利用者の provider 構成とログイン離脱率を見て判断する。

### 4.3 locale と timezone

`accounts` に最初から以下を持たせる。

- `locale`: BCP 47。初期値 `ja-JP`
- `timezone`: IANA timezone。初期値 `Asia/Tokyo`
- `guide`: `alice` または `harry`
- `registered_at`: account 作成の UTC timestamp

locale は次の分岐キーにする。

- 毎日の質問文
- 診断結果ラベル
- Alice / Harry の system prompt
- 週次レポート
- タロット解釈
- Push 通知
- エラー文

未対応 locale は `ja-JP` に fallback する。AI 生成物には生成時の `locale` を保存し、locale 変更後も過去文章を勝手に再生成しない。

質問マスタは ID と採点情報を言語非依存にし、文言を `daily_question_texts(question_id, locale, text)` に分離する。

### 4.4 アプリ単体の入口

初期リリースは Web の 50 問診断完了と引き継ぎコードを必須にする。コードを持たない一般ユーザーには Web 診断への universal link を表示し、アプリ内に簡易診断や空の体験を作らない。

App Store / Google Play の審査では、専用 code や専用 entitlement table を作らず、審査用 account 1 件で全画面を確認できるようにする。

- Supabase Auth で審査用 account だけ email + password を有効化する
- 一般ユーザー向け password signup は提供しない
- `accounts.is_review_account boolean NOT NULL DEFAULT false` を持たせる
- `is_review_account = true` は service role / 管理処理だけが設定できるようにする
- partial UNIQUE index で環境ごとに review account を 1 件に限定する
- review account には固定の匿名 demo snapshot、日記、cycle、週次レポート、会話履歴を seed する
- server の subscription guard は `is_review_account = true` の場合だけ審査用 bypass を許可し、`review_entitlements` は作らない
- review account にも通常の AI rate limit、監査 log、削除導線を適用する
- 審査提出ごとに password を rotate し、全 session を revoke して demo data を初期化する
- email、password、操作手順を審査メモへ記載する

`app_review_access_codes` と `review_entitlements` は設計・実装対象から削除する。

Phase 4 でアプリ内 50 問診断を追加する。診断ロジックを端末へ複製せず、既存ロジックを Next.js API 経由で再利用する。完了時は新しい Web `users` 行、`account_diagnosis_links`、snapshot を transaction で作る。

## 5. Web 引き継ぎと snapshot

### 5.1 引き継ぎコード

`app_transfer_codes`

- `id`
- `code_hash`
- `source_user_id`
- `expires_at`
- `consumed_at`
- `consumed_by_account_id`
- `claim_ticket_hash`
- `created_at`

コード本文は保存せず hash だけを保存する。一般コードは 1 回利用、有効期限付きとする。`source_user_id` は tombstone merge を考慮し、ここでも Web `users` への foreign key を張らない。

UX 上はコード入力を account 登録より前に見せるが、内部処理は 2 段階にする。

1. `POST /api/app/v1/transfer/validate` で検証し、短時間だけ有効な claim ticket を返す
2. Auth 完了後、`POST /api/app/v1/transfer/consume` で ticket を原子的に消費する

consume transaction は link、snapshot、active pointer をまとめて作成する。同じコードの並行 consume は 1 件だけ成功させる。

### 5.2 将来 `person_id` を導入するときの移行

将来 Web に `web_people` と `person_id` を導入する場合は、既存 `users` 行を削除・統合せず、`users.person_id` を nullable で追加する。本人が Web ログインまたは新しい引き継ぎを行った時点で、本人確認済みの複数 `users` 行を 1 つの `person_id` に紐づける。`account_diagnosis_links` はそのまま保持し、account 単位で検証できた link 群から `account_person_links` を追加する。移行期間中は `source_user_id` と `person_id` の両方を解決できる adapter を API 側に置き、メール一致だけでは backfill しない。

### 5.3 immutable snapshot と tombstone

診断情報は `base_profile_snapshots` にコピーし、過去 snapshot を直接上書きしない。

- `id`
- `account_id`
- `source_user_id`
- `source_canonical_user_id_at_copy`
- `logic_version`
- `schema_version`
- `copied_at`
- `type_id`
- `scores`
- `facet_scores`
- `self_report`
- `perceived_report`
- `friend_view_base`
- `source_updated_at`
- `superseded_by_snapshot_id`

`base_profile_snapshots.source_user_id` に Web `users` への foreign key は張らない。Web 側の重複整理で元行が tombstone に変わる、または削除される可能性があるためである。

source 解決は次の順に行う。

1. `source_user_id` の行を取得する
2. tombstone の場合は `merged_into_user_id` を辿る
3. cycle 検出と最大 hop 数を設ける
4. 最終の正規行を canonical source とする
5. 版比較と再コピーは canonical source の `logic_version`、`updated_at` を使う

コピー時に `source_canonical_user_id_at_copy` を監査情報として保存するが、これにも foreign key は張らない。`accounts.active_base_profile_snapshot_id` が現在使う snapshot を指す。

必須の版情報:

- `logic_version`: Web 側の診断・レポート生成ロジックの版
- `schema_version`: snapshot JSON の構造版
- `copied_at`: アプリへコピーした日時

### 5.4 「友達から見た自分」の二層型

初期は Web からコピーした集計だけを immutable snapshot に保存する。将来の app 起点招待を追加しても API response を壊さないよう、最初から base + live の二層で返す。

```ts
type FriendViewProfile = {
  base: {
    snapshotId: string
    copiedAt: string
    responseCount: number | null
    scores: Record<string, number>
    summary: string
  } | null
  live: {
    summaryId: string
    updatedAt: string
    responseCount: number
    scores: Record<string, number>
    summary: string
  } | null
  displaySource: 'base' | 'live' | 'none'
}
```

- MVP は常に `live: null`
- 友達個人の回答本文、氏名、連絡先は snapshot に含めない
- Phase 4 以降に hybrid 招待を追加した場合だけ `friend_live_summaries` を作る
- live を削除しても base snapshot は残る

### 5.5 再コピー導線

- `GET /api/app/v1/base-profile/version` で canonical source と active snapshot の版を比較する
- 新しい版がある場合、マイページに「診断データを更新」を表示する
- 実行時に新しい immutable snapshot を作成し、active pointer を切り替える
- 古い週次レポートは当時の snapshot ID を保持する
- 再コピーで日記、会話、記憶、過去の週次レポートは消さない

引き継ぐ対象は以下に限定する。

- 性格診断結果
- キャラクタータイプ
- 自己分析レポート
- 友達から見た自分の集計

Web の購入権利、会話履歴、出生情報、友達個人の回答本文・個人情報は snapshot に含めない。

### 5.6 Web 買い切り商品の表示要件

「運命の設計図」は Web 限定商品であり、初期リリースでは Alice アプリの entitlement に影響させない。

Web の商品 LP、購入 CTA 直前、購入確認画面、購入完了メール、FAQ に次の意味を明記する。

> 診断の基本情報は Alice アプリへ引き継げますが、「運命の設計図」の本文・購入権利は Web 版限定です。Alice Plus は別契約です。

短縮表示が必要な場所でも「Web 版限定」「Alice Plus は別契約」の 2 点を省略しない。アプリ引き継ぎ画面でも、購入商品そのものは引き継がれないことを再掲する。

## 6. Supabase access

### 6.1 Expo の RLS 付き CRUD

本人が直接操作する低リスク CRUD は Supabase Auth の JWT と RLS を使う。

- 日記の作成、編集、削除
- daily check-in の途中保存
- daily answers の途中保存
- 通知設定
- 本人の履歴参照

policy は `(select auth.uid()) = account_id` を基本にする。RLS があっても account ID を client から自由指定する insert は避け、default または trigger で `auth.uid()` を設定する。

### 6.2 Next.js API の service role

次は service role が必要なサーバー処理とする。

- legacy Web source を解決して snapshot を作る
- entitlement mirror を更新する
- AI context を横断取得する
- AI message と利用量を原子的に予約、確定する
- 週タイプと週次レポートを確定する
- notification job を claim、送信する
- account 全体を削除する

service role client を Expo bundle に含めない。API は JWT から account ID を確定し、request body の `account_id` を信用しない。

## 7. RevenueCat webhook による購入同期

購入状態のサーバー同期は RevenueCat webhook に一本化する。App Store Server Notifications と Google RTDN を Alice の backend で直接受けない。

```text
App Store / Google Play
        ↓
RevenueCat
        ↓ webhook
/api/app/v1/webhooks/revenuecat
        ↓ event_idで保存・同期処理
subscription_entitlements
        ↓ commit後
       HTTP 200
```

RevenueCat Webhooks 自体も RevenueCat Pro plan の機能であるため、公開環境の固定費要件に含める。
[RevenueCat Webhooks](https://www.revenuecat.com/docs/integrations/webhooks)

### 7.1 webhook endpoint: 同期処理

`POST /api/app/v1/webhooks/revenuecat`

応答後に処理を継続する post-response worker は使わない。entitlement 反映が完了する前に 200 を返さない。

処理順:

1. raw body を保持したまま Authorization header と HMAC signature、timestamp を検証する
2. payload を parse し、`event.id`、`app_user_id`、environment を検証する
3. `event_id` UNIQUE の `revenuecat_webhook_events` へ raw event を `pending` として insert する
4. duplicate が `processed` なら変更せず 200 を返す
5. duplicate が `pending` / `failed` なら同じ processor を再実行する
6. 同じ HTTP request 内で DB function `process_revenuecat_event(event_id)` を呼ぶ
7. DB function は event row を `FOR UPDATE` で lock し、entitlement 更新と event の `processed` 化を 1 transaction で行う
8. transaction commit 後にだけ 200 を返す

transaction が失敗した場合:

- catch 側の短い update で event row を `failed`、`processing_error` 付きで残す
- webhook request は 5xx を返し、RevenueCat の再送対象にする
- scheduler も `failed` event と一定時間以上残った `pending` event を同じ processor で再処理する
- RevenueCat 再送と scheduler が競合しても row lock と `event_id` で 1 回だけ反映する

raw event の先行保存は、失敗 event を scheduler から再処理可能にするための短い永続化である。entitlement 変更そのものは必ず 1 transaction に閉じる。外部 API 呼び出しを transaction 内に入れず、通常時は短時間で完了させる。

RevenueCat は at-least-once 配信で、retry でも同じ event ID を使うため、`event_id` を冪等 key にする。
[RevenueCat Webhooks](https://www.revenuecat.com/docs/integrations/webhooks) / [Event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)

### 7.2 purchase tables

`revenuecat_webhook_events`

- `event_id` UNIQUE
- `event_type`
- `app_user_id`
- `event_timestamp_ms`
- `environment`
- `payload`
- `status`: `pending | processed | failed | ignored`
- `attempt_count`
- `last_attempt_at`
- `processed_at`
- `processing_error`

`subscription_entitlements`

- `account_id`
- `entitlement_id`: `alice_plus`
- `state`: `trialing | active | grace_period | billing_issue | expired`
- `store`
- `product_id`
- `expires_at`
- `will_renew`
- `latest_event_id`
- `latest_event_timestamp_ms`
- `updated_at`

古い `event_timestamp_ms` で新しい entitlement 状態を巻き戻さない。同時刻 event の precedence rule も version 管理する。

### 7.3 Expo 側

- RevenueCat SDK は購入、復元、端末の即時表示だけに使用する
- Expo から receipt や entitlement を Next.js API へ自己申告しない
- 購入直後の UI は SDK の CustomerInfo で更新できる
- AI API の利用可否は server mirror が有効になるまで `syncing_purchase` として短時間再試行する
- 長時間同期されない場合は「購入を復元」と support 導線を出す

### 7.4 確定した商品方針と将来案

初期は Web の「運命の設計図」購入有無を Alice Plus の entitlement、価格、trial に反映しない。全員が同じ store product / offering を見る。

将来 Web 購入者を優遇する場合の優先案は promotional offer ではなく、trial 日数が異なる別 subscription product を作り、RevenueCat の Web 購入者向け offering に出す方式とする。

- Web 購入の検証は server 側で行う
- client が `is_web_buyer` を自己申告しない
- product、subscription group、intro eligibility、upgrade / restore の挙動を両 store で検証する
- Web 購入者向け offering が取得できなくても通常 offering に fallback する
- 外部決済への誘導ではなく store 内 product として購入させる
- 実装前に App Store / Google Play の現行規約を再確認する

## 8. scheduler・個人 7 日 cycle・通知

### 8.1 scheduler と claim 上限

MVP は Vercel Cron から 15 分ごとに署名付き internal endpoint を起動する。

```text
Vercel Cron
  ↓
/api/app/v1/internal/scheduler
  ├─ failed webhook retry
  ├─ cycle close / 週タイプ計算
  ├─ 週次解説生成job
  └─ 通知送信job
```

Vercel Cron は全 plan で利用できるが、Hobby は 1 日 1 回までである。15 分間隔は最短 1 分に対応する Pro または Enterprise plan が前提となる。Alice の本構成では Vercel Pro 以上を公開環境の要件とする。Pro を使わない場合は 15 分 scheduler を `pg_cron` へ切り替える。
[Vercel Cron Jobs: Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)

1 tick で処理する件数に必ず上限を持つ。初期値は server config とし、次を出発点に負荷試験で調整する。

| queue | 1 tick の初期 claim 上限 |
|---|---:|
| failed / stale pending RevenueCat event | 10 |
| cycle close | 20 |
| weekly AI generation | 20 |
| account deletion | 5 |
| notification delivery | 45 |
| 合計 | 100 |

- `due_at <= now()` を対象に `FOR UPDATE SKIP LOCKED` で claim する
- `claimed_at`、`lease_expires_at`、`attempt_count` を持つ
- tick の wall-clock deadline も設け、残り時間が少ない場合は新規 claim を止める
- 上限超過分と lease 切れは次 tick に回す
- queue 間の starvation を避けるため種類ごとに上限を持つ
- Cron の起動時刻が遅れても、`due_at` と冪等 key から取りこぼしなく追いつく

将来件数が増えた場合は、同じ DB job / outbox を保ったまま queue worker だけ分離できるようにする。

### 8.2 個人 7 日 cycle の境界

「週」はユーザーごとの 7 日 cycle であり、月曜〜日曜などの共通カレンダー週ではない。`accounts.timezone` を使い、初期値を `Asia/Tokyo` とする。

初回 cycle は次の境界にする。

```text
Day 1: accounts.registered_at 〜 翌ローカル日付の 00:00 未満
Day 2: 翌ローカル日付 00:00 〜 次の日の 00:00 未満
...
Day 7: 7日目のローカル日付 00:00 〜 8日目の 00:00 未満
```

- cycle 初日だけ account 登録時刻起点とする
- 2 日目以降はローカル日付の 00:00 を境界にする
- 初回 cycle は経過時間として 168 時間未満になり得る
- 2 cycle 目以降は直前 cycle 終了時刻から 7 つのローカル日付で区切る
- Store の free trial 終了時刻と個人 cycle の境界を同一視しない
- cycle 作成時に `timezone_at_start` と各 `day_start_at` を保存する
- cycle 途中で timezone を変更しても進行中 cycle は変えず、次 cycle から反映する
- DST で 1 日が 23 / 25 時間になってもローカル日付を正とする

`weekly_cycles` は UNIQUE `(account_id, cycle_number)` とし、終了時刻を過ぎたら server が直前 cycle を 1 回だけ確定する。

### 8.3 保存値の単一参照

`weekly_reports` に UNIQUE `(account_id, cycle_id)` を設定し、server で 1 回だけ計算・保存する。

- アプリ表示は保存済み `weekly_reports` を読む
- Push は同じ `weekly_report_id` を deep link に入れる
- 通知時にタイプを再計算しない
- AI の再生成でも数値、タイプ、境界距離は変更しない

### 8.4 共有カードと将来のカレンダー週

共有カードは「今週」ではなく「今回の 7 日間」の文脈で設計する。

推奨文言:

- 「今回の7日間のわたし」
- 「この7日間は○○タイプでした」
- 期間を `8/28–9/3` のように併記する

将来の月曜〜日曜集計に備え、`daily_results.local_date` と timezone を保持する。カレンダー週は daily result から作る別 aggregate / view とし、個人 cycle の `weekly_reports` を書き換えない。

### 8.5 通知配信

`notification_jobs` と `notification_deliveries` を使用する。

1. scheduler が送信対象を job 化する
2. locale、timezone、quiet hours を確認する
3. Next.js API が Expo Push Service へ送信する
4. receipt を確認する
5. 無効 token を停止する

UNIQUE `(account_id, notification_type, source_id)` で二重送信を防ぐ。Push 本文には日記、相談内容、人名などの機微情報を含めない。

## 9. 毎日の診断と 7 日タイプ

既存 Web の 10 facet から毎日 1 問ずつ、合計 10 問を出す。

1. 主張力
2. 温かさ
3. 協力性
4. 共感性
5. 冒険性
6. 想像力
7. 達成欲求
8. 秩序性
9. 感情の動き
10. 不安の感じやすさ

### 9.1 質問選択

`daily_question_bank`

- `question_id`
- `facet_id`
- `dimension`
- `reversed`
- `question_logic_version`
- `active_from`
- `active_to`

account ID、cycle ID、cycle day から seed を作り、再読み込みしても同じ 10 問になるようにする。同じ質問の短期間連続を避ける。

### 9.2 判定とタイプ境界距離

AI にタイプを決めさせない。

1. 7 段階回答を正逆補正する
2. 0〜10 に正規化する
3. cycle 内の facet 平均を計算する
4. Big Five 5 軸に集約する
5. 既存 `classifyThirtyTwoType()` と同じ logic version でタイプを算出する
6. タイプと各境界までの距離を `weekly_reports` に保存する

- 4 日以上回答: 7 日タイプを確定する
- 3 日以下: タイプを断定せず傾向だけを保存する
- 日記と気分は解説材料に使うが数値判定には使わない

`weekly_reports` に次を追加する。

- `dimension_scores`
- `boundary_distances`: 各二分境界からの正規化距離
- `minimum_boundary_distance`: 最も近い境界までの距離
- `stability_score`: 算出方法確定までは nullable
- `answered_days`
- `answer_count`
- `question_set_version`
- `scoring_version`
- `classification_version`
- `stability_logic_version`
- `base_profile_snapshot_id`

`boundary_distances` は「確率」や医学的な信頼度として表示しない。Phase 2 の TestFlight 実データで、同一人物の cycle 間変動、境界付近のタイプ反転率、回答日数による揺れ幅を確認する。その結果から、数値表示、3 段階の安定度表示、非表示のどれにするかを決める。表示方法が決まる前も raw distance は保存し、後から再分析できるようにする。

## 10. AI server component

### 10.1 AI request flow と Expo SSE

```text
Expo
  ↓ user message + client_message_id + Supabase JWT
Next.js API
  ↓ Auth JWT検証
  ↓ subscription_entitlement確認
  ↓ AI利用量を原子的にreserve
  ↓ context builder（service role）
  ↓ Vercel AI Gateway
  ↓ SSE stream
  ↓ message保存
  ↓ usage確定 / 失敗時release
```

AI Gateway を Expo から直接呼ばない。model ID、credential、system prompt、rate limit は server だけに置く。

Expo の SSE 受信は SDK 52 以降の `expo/fetch` を第一候補とする。`response.body.getReader()` と `TextDecoder` で `text/event-stream` を逐次 parse する。Expo SDK / native 実機で互換問題がある場合だけ `react-native-sse` を fallback にする。
[Expo `expo/fetch`](https://docs.expo.dev/versions/latest/sdk/expo/)

- request は `client_message_id` で冪等化する
- `AbortController` で画面離脱時に中断する
- POST stream の自動再接続を前提にしない
- stream 中断後は message status を取得し、保存済み response があれば再表示する
- token chunk のたびに DB write せず、完了または一定間隔で checkpoint する

### 10.2 context builder

毎回すべての会話・日記を送らない。

```text
active base profile snapshot
+ friend view base / optional live summary
+ 本人承認済み memories の上位N件
+ 直近 weekly report summary
+ 必要な直近日記の要約
+ conversation summary
+ 直近メッセージ
```

承認済み memory の保存上限が 200 件でも、1 call に 200 件すべてを入れない。初期値を `AI_CONTEXT_MEMORY_MAX = 20` とし、token budget 内で次の二層を選ぶ。

- stable memory: 最大 8 件。本人が重要指定したものと最近使われたものから選び、conversation 中は固定する
- relevant memory: 最大 12 件。現在の user message との意味的関連度を優先し、同点では最近性で選ぶ
- 同じ内容や上位概念が重なる memory は context 組み立て時に重複排除する
- memory が 20 件未満なら存在する分だけを使う
- `AI_CONTEXT_MEMORY_MAX`、stable / relevant の配分は server config に置く

system prompt、active snapshot、stable memory を固定 prefix とし、relevant memory、conversation summary、直近 message を可変 suffix にする。snapshot、guide、locale、prompt version、承認済み memory が変わった場合は `context_prefix_revision` を更新する。

Alice と Harry は同じ context、人格方針、記憶を使う。変えるのは名前、外見、性別表現だけとする。

### 10.3 model Tier

具体的な model ID は固定しない。AI Gateway の利用可能 model から benchmark で選び、server 設定で差し替える。

| Tier | 用途 | 方針 |
|---|---|---|
| Tier A: Dialogue | user message に対する自由対話の返答 | 会話品質と文脈理解を優先 |
| Tier B: Explanation | 日次解説、7 日振り返り、週次本文、タロット解釈 | 品質と原価の均衡 |
| Tier C: Structure | 記憶候補、要約、通知候補、安全分類 | 高速、低原価、構造化出力 |

設定 key:

- `AI_MODEL_DIALOGUE`
- `AI_MODEL_EXPLANATION`
- `AI_MODEL_STRUCTURE`
- `AI_MODEL_POLICY_VERSION`

AI Gateway には account 単位の匿名 user ID と `feature:*` tag を渡し、model / feature 別に原価を追跡する。model 変更時は生成物に `model_policy_version` を保存する。

### 10.4 加入者 1 人あたり月間 AI 原価モデル

Tier A の call 単位は、会話回数や session 数ではなく「server が受理した user message 1 件」に統一する。

- user message 1 件につき Tier A の primary generation は最大 1 call
- SSE chunk 数や assistant message 数は call 数に含めない
- 同じ `client_message_id` の再送は新しい call に数えない
- provider failover / retry は user message 数を増やさず、実原価と buffer にだけ加算する
- 7 日振り返りなどの自動生成は Tier B とし、Tier A に混ぜない

原価は token 単価だけでなく、context 長、出力長、retry、要約の追加 call を含めて計算する。

```text
1呼び出し原価（円）
= ((平均input token × input単価/1M)
 + (平均output token × output単価/1M))
 × USD/JPY

Tier月間原価
= 1呼び出し原価 × 月間呼び出し回数

加入者月間AI原価
= Tier A + Tier B + Tier C + retry/変動buffer
```

以下は model 選定前の予算仮説であり、provider の価格表ではない。Phase 2 / 3 で実測値へ差し替える。基準 P90 の 5 user messages / 日に加え、20 user messages / 日を悲観 P90 stress として併記する。

| Tier | call 単位 | 1 call 予算仮説 | calls P50 | calls 基準P90 | calls 悲観P90 | 原価 P50 | 原価 基準P90 | 原価 悲観P90 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A | 1 user message | ¥2.70 | 45 | 150 | 600 | ¥121.50 | ¥405.00 | ¥1,620.00 |
| B | 1 explanation generation | ¥0.45 | 38 | 65 | 65 | ¥17.10 | ¥29.25 | ¥29.25 |
| C | 1 structure generation | ¥0.06 | 90 | 240 | 240 | ¥5.40 | ¥14.40 | ¥14.40 |
| 小計 | — | — | — | — | — | ¥144.00 | ¥448.65 | ¥1,663.65 |
| retry・単価・為替 buffer 20% | — | — | — | — | — | ¥28.80 | ¥89.73 | ¥332.73 |
| 月間 AI 原価予算 | — | — | — | — | — | **約¥173** | **約¥538** | **約¥1,996** |

token 仮説は Tier A 3,000 / 500、Tier B 2,000 / 500、Tier C 1,200 / 200（input / output）とする。

呼び出し回数の仮定:

- Tier A P50: 平均 1.5 user messages / 日、45 messages / 月
- Tier A 基準P90: 5 user messages / 日、150 messages / 月
- Tier A 悲観P90 stress: 20 user messages / 日、600 messages / 月
- Tier B: 日次解説、cycle 解説を基本に、悲観ケースではタロット利用増を含む
- Tier C: 会話要約、memory candidate、安全分類。user message ごとに全処理を走らせず、batch / threshold 起動する
- 悲観表では Tier A の高利用影響を分離して見るため、Tier B / C は基準 P90 と同じ call 数に置く。Tier C が会話量に連動した場合は別感度として追加する

#### prompt caching

system prompt + active snapshot + stable memory を同一順序の固定 prefix とし、prompt caching を Tier A の主要な原価レバーにする。ユーザー固有の会話回答そのものを response cache する設計ではない。

現行 AI Gateway には `providerOptions.gateway.caching = 'auto'` があり、明示的 marker が必要な provider にも適切な caching 指定を適用できる。ただし model / provider ごとの対応、最小 token、TTL、cache write premium、cache hit 単価は異なるため、Phase 3 で実リクエストを使って確認する。
[Vercel AI Gateway: Provider Options / Automatic Caching](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options)

検証項目:

- AI Gateway 経由で caching 指定が採用 model / provider まで渡ること
- 1 call 目の cache write と 2 call 目以降の cache read token
- `usage.inputTokenDetails.cacheReadTokens` または provider 相当値
- prefix revision が同じ call の cache hit 率
- cache 有無による実効 input 単価、応答速度、回答品質
- provider failover 時に cache 効果が失われる範囲
- snapshot / memory 更新による invalidation 頻度

`ai_generation_logs` に次を保存し、月次 cohort 集計を作る。

- `account_id`
- `user_message_id`: Tier A だけ必須
- `feature`
- `tier`
- `model_id`
- `model_policy_version`
- `context_prefix_revision`
- `input_tokens`
- `output_tokens`
- `cache_write_input_tokens`
- `cache_read_input_tokens`
- `provider_cost_usd`
- `estimated_cost_jpy`
- `effective_cost_per_user_message_jpy`
- `is_retry`
- `created_at`

#### store 手数料と価格計算

基準ケースは store 手数料 15% とする。Apple は Small Business Program の対象・承認が前提で IAP 手数料が 15%、Google Play は auto-renewing subscription を原則 15% としている。実際の適用条件、関連 developer account、地域別条件は公開前に確認する。
[Apple App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/) / [Google Play Service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en-GB)

価格判断は P50 原価を基準にする。

- store 手数料控除後売上に対し、AI 原価 P50 を 15% 以下にする
- P50 AI 原価 ¥173、store 手数料 15% の仮定では、必要 gross 月額の計算例は約 ¥1,360 以上
- store 手数料 30% の感度分析では約 ¥1,650 以上
- 税、RevenueCat、Vercel、support、返金などの非 AI 原価は別途加算する
- 悲観P90の月間総額をそのまま月額価格の根拠にしない

悲観P90は、高利用者から利益を最大化する価格設定ではなく、Tier A の実効 1 user message 原価をどこまで下げる必要があるかを判断する stress test とする。

```text
Tier A 目標1 message原価
<= (高利用者に許容する月間AI原価 - Tier B/C原価 - buffer)
   / 600 user messages
```

trial 判断の基準:

```text
trial AI原価
= 月間AI原価 × trial日数 / 30 × trial利用倍率
```

- 7 日 trial を初期仮説とする
- 利用倍率 1.0 なら基準P90の 7 日分は約 ¥126、3 日分は約 ¥54。悲観P90では 7 日分が約 ¥466、3 日分が約 ¥200
- trial 原価が許容 CAC を超える場合は、trial 開始点、trial 日数、trial 中上限、Tier、caching のいずれかを見直す
- trial の日数は Store 設定だけで確定せず、原価と conversion を併せて決める

### 10.5 AI 利用量と上限の決め方

`ai_daily_usage`

- `account_id`
- `local_date`
- `feature`
- `accepted_user_messages`
- `reserved_requests`
- `completed_requests`
- `input_tokens`
- `output_tokens`
- `estimated_cost_jpy`
- `updated_at`

UNIQUE `(account_id, local_date, feature)` とし、DB function で reserve / settle / release を原子的に行う。

v2 の 50 message / 日などの値を公開時の確定値として引き継がない。Phase 2 / 3 の P50 / P90、採用 model、cache hit 後の実効原価から次を決める。

- 1 日の request 上限
- rolling 30 日の request / token / 原価上限
- trial 中の上限
- タロット、日次解説、週次解説の feature 別上限
- memory candidate と承認済み memory の件数上限

算出ルール:

```text
Tier A目標1 message原価
= 高利用stress testで許容するTier A原価 / 悲観P90 messages

有料上限
= 実測P90利用の数倍。ただし異常利用・自動化による最大損失を許容範囲に抑える
```

悲観P90は月額価格を高くする根拠にしない。20 messages / 日の利用でも成立するよう、model 選定、context 圧縮、上位 N memory、prompt caching によって 1 user message 原価の目標を決めるために使う。

有料 plan の上限は P90 そのものに置かず、正常な高利用者を遮断しないよう日次で約 3 倍、rolling 30 日で約 2 倍を暫定目安にする。上限は「利用促進の目標」ではなく、bot・loop・credential 共有による損失防止線である。

**Phase 3 TestFlight 暫定上限:** Tier A は 60 accepted user messages / local day、1,200 messages / rolling 30 days。同じ `client_message_id` の retry は加算しない。

server config の `ai_plan_limits` を version 管理し、アプリ更新なしで変更する。通常利用で上限を意識させず、超過時は 429、対象 feature、local reset 時刻を返す。価格、trial 日数、上限は同じ原価表の承認なしに別々に変更しない。

### 10.6 記憶

```text
Tier Cで候補抽出
  ↓
memory_candidates
  ↓ 本人が承認・修正・拒否
memories
```

会話や日記から直接 `memories` に保存しない。上限到達時も自動削除せず、重複候補の統合または本人による整理を促す。

承認済み memory の保存上限と AI context への投入上限を分離する。保存上限が 200 件でも、各 call に渡すのは 10.2 で選んだ上位 N 件だけとする。memory の採用回数と最終採用日時を記録し、関連度・最近性 ranking の改善に使う。

## 11. 主要 data model

### Identity / Profile

- `accounts`
- `account_diagnosis_links`
- `base_profile_snapshots`
- `app_transfer_codes`
- 将来: `account_person_links`
- 将来: `friend_live_summaries`

### Subscription

- `revenuecat_webhook_events`
- `subscription_entitlements`

### Daily / 7-day cycle

- `weekly_cycles`
- `daily_checkins`
- `daily_answers`
- `daily_results`
- `weekly_reports`
- `daily_question_bank`
- `daily_question_texts`

### Journal / Alice

- `journal_entries`
- `chat_threads`
- `chat_messages`
- `conversation_summaries`
- `memory_candidates`
- `memories`
- `ai_daily_usage`
- `ai_generation_logs`
- `ai_plan_limits`

### Tarot / Notification / Ops

- `tarot_draws`
- `devices`
- `notification_preferences`
- `notification_jobs`
- `notification_deliveries`
- `app_events`
- `account_deletion_requests`

## 12. アプリ用 API v1

### 初回・profile

- `POST /api/app/v1/transfer/validate`
- `POST /api/app/v1/transfer/consume`
- `GET /api/app/v1/bootstrap`
- `GET /api/app/v1/base-profile/version`
- `POST /api/app/v1/base-profile/refresh`
- Phase 4: `POST /api/app/v1/diagnosis/start`
- Phase 4: `POST /api/app/v1/diagnosis/answers`
- Phase 4: `POST /api/app/v1/diagnosis/complete`

### 毎日・7 日 cycle

- `GET /api/app/v1/home`
- `POST /api/app/v1/daily/start`
- `POST /api/app/v1/daily/complete`
- `GET /api/app/v1/weekly-reports`
- `GET /api/app/v1/weekly-reports/:id`

回答と日記の途中保存は RLS CRUD を基本とし、server 確定が必要な `complete` だけ API を通す。

### 対話・記憶

- `POST /api/app/v1/chat`（SSE）
- `GET /api/app/v1/chat/messages`
- `GET /api/app/v1/chat/messages/:client_message_id/status`
- `GET /api/app/v1/memories`
- `POST /api/app/v1/memory-candidates/:id/approve`
- `POST /api/app/v1/memory-candidates/:id/reject`
- `PATCH /api/app/v1/memories/:id`
- `DELETE /api/app/v1/memories/:id`

### 占い

- `POST /api/app/v1/tarot/draws`
- `GET /api/app/v1/tarot/draws`

card 抽選を先に保存し、AI retry で card が変わらないよう `draw_id` を冪等 key にする。占い結果は 7 日タイプと記憶へ自動で入れない。

### 設定・課金・内部処理

- `PATCH /api/app/v1/me/guide`
- `PATCH /api/app/v1/me/locale-timezone`
- `POST /api/app/v1/devices/push-token`
- `GET /api/app/v1/entitlement`
- `POST /api/app/v1/webhooks/revenuecat`
- `POST /api/app/v1/internal/scheduler`
- `POST /api/app/v1/account/deletion-requests`
- `GET /api/app/v1/account/deletion-requests/:id`

審査用 account の作成、`is_review_account` 設定、password rotate、demo data 初期化は管理者処理に限定し、アプリ公開 API には含めない。

## 13. account 削除

Alice は account 作成を提供するため、アプリ内から削除を開始・完了できるようにする。Apple はアプリ内削除導線を求めている。Google Play はアプリ内導線に加えて、アプリを再インストールしなくても削除申請できる Web resource を求めている。
[Apple: Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app) / [Google Play: アプリ アカウントの削除要件](https://support.google.com/googleplay/android-developer/answer/13327111?hl=ja)

### 13.1 アプリ内 UX

```text
マイページ
  ↓
アカウントとデータを削除
  ↓
削除対象とsubscription継続の説明
  ↓
再認証
  ↓
最終確認
  ↓
削除request作成
```

- subscription の解約と account 削除は別処理であることを明示する
- store の subscription 管理画面への導線を出す
- subscription が有効でも「今すぐ削除」を選べるようにする
- 「契約終了日に削除予約」を提供しても、即時削除を隠さない

### 13.2 Web 削除申請

公開 Web に `/app/account-deletion` を設け、Google Play Console の Data safety と store listing に URL を登録する。

- アプリのインストールを要求しない
- Email OTP、Sign in with Apple、将来の LINE など account provider で本人確認する
- ログイン不能時の support 申請と追加本人確認を用意する
- 削除対象、保持対象、処理予定期間、完了通知を表示する
- アプリ内と同じ `account_deletion_requests` を作成する
- Web page を noindex にせず、審査と利用者が到達できる状態を維持する

### 13.3 server 処理

`account_deletion_requests`

- `id`
- `account_id`: 削除完了までは UUID、完了時に null 化
- `account_reference_hash`: 完了監査用の不可逆 hash
- `source`: `ios | android | web | support`
- `status`: `requested | processing | completed | failed`
- `requested_at`
- `completed_at`
- `failure_reason`

削除 request は scheduler が claim し、次を行う。

1. session と refresh token を失効する
2. device / Push token を削除する
3. 日記、回答、週次レポート、会話、記憶、占いを削除する
4. snapshot と diagnosis link を削除する
5. RevenueCat subscriber attributes から個人情報を除去し、app account と切り離す
6. Supabase Auth user と `accounts` を削除する
7. 法令・会計上保持が必要な購入 event は account ID を不可逆匿名化して最小限保持する
8. 完了状態を個人情報を含まない audit record に残す

`account_deletion_requests.account_id` は `ON DELETE CASCADE` にせず、削除完了時に null 化して `account_reference_hash` だけを残す。Sign in with Apple を使用している場合は Apple token revoke も削除処理に含める。外部 service に渡した対象データも削除または匿名化する。

## 14. security・運用

- service role、AI credential、webhook secret を Expo に載せない
- RevenueCat webhook は raw body HMAC 検証 + event ID 冪等化を行う
- internal scheduler は Cron 専用 secret で保護する
- Auth JWT から account ID を確定し、本文の user ID を信用しない
- 全アプリ用 table で RLS を有効化する
- AI context は必要最小限にし、管理 log へ会話・日記本文を出さない
- Push 通知に機微情報を含めない
- 削除済みデータを AI context と検索 index からも除外する
- rate limit は IP だけでなく account ID 単位で行う
- webhook、AI、通知、週次生成を冪等化する
- generation に model、prompt、logic、locale version を保存する
- tombstone chain の cycle、欠損、過剰 hop を監視する
- scheduler backlog、oldest due age、claim 数、失敗率を監視する
- P50 / P90 AI 原価を cohort と plan ごとに監視する
- `accounts.is_review_account` は service role 以外から更新不可とし、true の件数が 1 を超えたら alert する
- prompt cache は account 間で意図的に共有せず、provider の保持期間・privacy 条件を採用 model ごとに確認する
- cache log には token 数と revision だけを残し、snapshot・memory本文を複製しない

## 15. 実装順

### Phase 1: 基盤

- Expo project
- Supabase Auth: Email OTP + Sign in with Apple
- `accounts.locale` / `accounts.timezone`
- RLS policy
- API v1 bootstrap
- `account_diagnosis_links`
- 引き継ぎと versioned snapshot
- tombstone canonical source 解決
- 審査用 email + password account と `accounts.is_review_account`

Phase 2 の home / 共有カード実装に入る前に、17.6 の trial 開始点を決定する。

### Phase 2: 看板体験

- 今日の気持ち、10 問、日記
- 個人 7 日 cycle
- scheduler と claim 上限
- deterministic 7 日タイプ
- boundary distance の保存
- Tier B 週次解説
- 同じ weekly report を使う表示
- 「今回の 7 日間」共有カード

Phase 2 完了時点で TestFlight internal 配布を行い、次を先に検証する。

- 初回 transfer 完了率
- Day 1 / Day 2 / Day 7 継続率
- 10 問完了時間と離脱位置
- cycle 間の score 揺れとタイプ反転率
- Tier B の token、品質、P50 / P90 原価

### Phase 3: Alice

- Tier A 自由対話
- AI usage reserve / settle
- `expo/fetch` SSE
- context builder
- conversation summary
- Tier C memory candidate
- 記憶の承認、修正、削除
- Alice / Harry / locale 分岐
- Tier 別原価 dashboard
- stable prefix の構築と `context_prefix_revision`
- AI Gateway 経由の prompt caching pass-through / cache hit 実測
- RevenueCat sandbox project / store product の接続
- RevenueCat webhook endpoint、event ID 冪等化、同期 transaction の実装

### Phase 4: 継続・独立入口

- タロット 3 種
- Push 配信
- 日記カレンダー
- 履歴
- アプリ内 50 問診断
- 既存診断 logic の API 再利用
- 将来候補: app 起点、Web 回答の friend hybrid loop
- RevenueCat SDK の購入・復元
- product / offering / entitlement mirror の接続
- sandbox 購入から webhook 反映までの E2E 確認
- account 削除のアプリ内 / Web 両導線
- 価格、trial 日数、AI 上限の公開候補を確定

RevenueCat は Phase 3 で server 側の sandbox / webhook に着手し、Phase 4 で client SDK、purchase UI、entitlement mirror を並行して接続する。Phase 5 に実装を持ち越さない。

### Phase 5: 公開前

- RevenueCat sandbox / webhook retry / 順序逆転 test
- purchase、restore、解約、grace period の回帰 test
- RLS と削除 cascade test
- API 後方互換 test
- AI 上限、原価、安全性評価
- prompt cache hit、fallback、原価 log の確認
- locale fallback test
- iOS / Android 実機 test
- App Store / Google Play 審査資料
- 審査用 account の reset、password rotate、操作手順確認
- store 提出と審査対応

#### 実装順の別案

公開要件を早期に潰したい場合は、RevenueCat と最小削除フローを Phase 1 に置く「公開準備先行」も可能である。ただし推奨は上記の TestFlight 先行案とする。Phase 2 までは server の internal tester entitlement で開放し、看板体験と scoring を先に検証する。RevenueCat と削除フローは一般公開前には必ず完了し、外部 TestFlight や store review の範囲に応じて前倒しする。

## 16. 確定した事業・獲得方針

### 16.1 Web users と accounts

- `accounts : Web users = 1 : N`
- transfer code は `users` 1 行ごと
- 再診断は新しい `users` 行と snapshot を追加
- email による自動統合はしない
- 将来 `person_id` を導入できる link 構造を維持する

### 16.2 Web 買い切り

- 「運命の設計図」は Web 限定
- app entitlement、trial、価格には影響させない
- 購入前後に「Web 限定」「Alice Plus は別契約」を明示する
- 将来優遇する場合は、trial 日数が異なる別 product + Web 購入者向け RevenueCat offering を第一候補にする

### 16.3 他己診断

- MVP は Web ユーザーの受け皿とし、snapshot の集計だけを app へコピーする
- API 型は base snapshot + nullable live summary の二層にする
- 将来は app から招待し、友達は Web で回答する hybrid loop を優先する
- friend 回答者に app account 作成を強制しない

## 17. 実装ゲート・実データで確定する項目

以下は仕様漏れではなく、指定した実装ゲートまたは Phase 2 / 3 の計測後に確定する項目である。

1. boundary distance の表示方法
2. Tier A / B / C の具体的 model
3. 月額価格、trial 日数、AI feature 別上限
4. LINE Login の採否
5. RevenueCat / Vercel の plan と想定固定費の最終承認
6. trial 開始点: account 登録直後の hard paywall で開始するか、価値体験後にユーザーが任意開始するか

trial 開始点は retention、trial 原価、home の locked state、共有カードの到達条件を変えるため、Phase 2 の home / 共有カード実装前に決定する。決定前は両方を実装せず、画面遷移図と計測 event の比較案までに留める。

- 登録時 hard paywall: 引き継ぎと account 作成直後に store checkout を必須表示し、承認時点から trial が始まる
- 任意開始: trial 開始前に表示できる read-only 範囲を定義し、本人が CTA を押して store checkout を承認した時点から trial が始まる
- どちらの場合も account 登録時刻だけでは Store trial を開始扱いにしない
- 比較 event は `transfer_completed`、`paywall_viewed`、`trial_started`、`home_opened`、`first_daily_completed` を最低限揃える

各決定は `decision_date`、根拠 metric、採用 version を設計変更履歴へ残す。
