# プレミアム化 v3: LINE 必須 → Web ファースト移行計画書 (Day 1)

作成日: 2026-05-23
スコープ: Day 1 調査 + 計画書のみ。実装・DB マイグレーション・LINE コード削除はまだ行わない。
ローンチ目標: 2026-07 末 〜 2026-08 中旬。

## エグゼクティブサマリ

- 既存資産 `owner_token` (nanoid 16B、UNIQUE、永続) は**そのまま Web ファースト時代の共有 URL token として再利用可**。新しい token 設計は不要。
- 認可は **Cookie (HttpOnly, 1 年) → `users.session_token` で user_id 解決** に統一。バックエンド 10 API、フロント 11 ファイルが置換対象。
- メール送信は **Resend を採用**。`resend` ライブラリ + React Email、Vercel との親和性最高、無料枠 3,000 通/月。
- LINE コードは**全面残置 + UI からの剥がし + 環境変数 `LINE_NOTIFICATIONS_ENABLED` で feature flag**。Phase 2 復活は env 1 つで戻せる構成。
- DB 追加は 3 つだけ: `users.session_token` / `users.email` / `magic_links` テーブル。既存スキーマは破壊しない。
- 14 日の中、Day 12-14 はバッファ。クリティカルパスは Day 6-8 (Resend ドメイン認証 + メール送信)。

---

## §1. LIFF 認可の依存マップ

### 1-1. バックエンド (`verifyBearer` 系)

`src/lib/liff-verify.ts` の 2 関数:
- `verifyLiffIdToken(idToken)` — LINE Verify API `/oauth2/v2.1/verify` を 3 種 Channel ID で順次試行
- `verifyBearer(request)` — `Authorization: Bearer` を抽出して上記を呼ぶラッパー

**呼び出し箇所 10 ファイル** (全て `verifySession()` への置換対象):

| ファイル | 行 | 用途 | 置換後 |
|---|---|---|---|
| `src/app/api/settings/notifications/route.ts` | 41, 63 | 通知設定 GET/PUT | `verifySession()` |
| `src/app/api/zukan-mine/route.ts` | 92 | マイ図鑑取得 | `verifySession()` |
| `src/app/api/checkout/create-session/route.ts` | 95 | Stripe Checkout 生成 | `verifySession()` |
| `src/app/api/integrated-trisetsu/[id]/pdf/route.ts` | 175 | PDF 取得 | `verifySession()` + token 認可 |
| `src/app/api/integrated-trisetsu/route.ts` | 68 | 統合トリセツ作成 | `verifySession()` |
| `src/app/api/account/delete/route.ts` | 30 | アカウント削除 | `verifySession()` |
| `src/app/api/line-resolve/route.ts` | 8 | LIFF→ownerToken 解決 | **削除** |
| `src/app/api/friend-answer/v2/route.ts` | 55 | 友達評価保存 | **認可不要** (友達は匿名) |
| `src/app/api/line-register/route.ts` | 16 | LINE 紐付け | **削除** (Phase 2 で復活) |
| `src/app/api/diagnosis/route.ts` | 39 | 診断保存 | `getOrCreateSession()` |

### 1-2. フロントエンド (`@line/liff` dynamic import)

11 ファイルすべてに dynamic import あり。全て LIFF 撤去対象:

| ファイル | LIFF 使用 | Web 移行後 |
|---|---|---|
| `src/app/diagnosis/page.tsx` | `init` (シェア前提) | Cookie 経由、LIFF 不要 |
| `src/app/friend/[inviteCode]/page.tsx` | `init` / `getProfile` / `getIDToken` / `shareTargetPicker` | Web Share API + 名前入力 |
| `src/app/integrated/[id]/IntegratedShareButton.tsx` | `shareTargetPicker` | `navigator.share()` |
| `src/app/integrated/[id]/IntegratedDownloadButton.tsx` | `getIDToken` で PDF API | Cookie 認可で同 API |
| `src/app/integrated/new/page.tsx` | `getIDToken` | Cookie 認可 |
| `src/app/line-register/page.tsx` | LINE 紐付け専用 | **ページ削除** |
| `src/app/settings/page.tsx` | `getIDToken` | メール変更などへ縮退 |
| `src/app/share/page.tsx` | `shareTargetPicker` | Web Share API |
| `src/app/torisetsu/redirect/page.tsx` | LIFF endpoint router | **ページ削除** |
| `src/app/zukan-mine/page.tsx` | `getIDToken` | Cookie 認可 |
| `src/app/report/[ownerToken]/page.tsx` | LIFF ID 参照のみ | env 削除 |

### 1-3. `line_user_id` でデータ識別している箇所

DB カラム:
- `users.line_user_id` (nullable, indexed) — nullable のまま残置
- `line_users.line_user_id` (UNIQUE) — Phase 2 まで残置
- `notification_preferences.line_user_id` (UNIQUE)
- `friend_perceptions.perceiver_line_user_id` (nullable)
- `integrated_trisetsu.line_user_id` (nullable)

クエリ箇所 (主要 13 ファイル):
- `src/app/api/webhook/line/route.ts` (follow/unfollow/postback)
- `src/app/api/webhook/stripe/route.ts` (114, 209 行)
- `src/app/api/zukan-mine/route.ts` (5 箇所)
- `src/app/api/checkout/create-session/route.ts` (5 箇所)
- `src/app/api/integrated-trisetsu/route.ts` (4 箇所)
- `src/app/api/admin/*` (2 ファイル)
- `src/app/api/settings/notifications/route.ts` (4 箇所)

**移行方針**: `line_user_id` を WHERE 句で使うクエリは `user_id` (= session 解決後の users.id) ベースに置換。`line_user_id` カラム自体は Phase 2 用に温存。

### 1-4. env var 参照

| env | 参照ファイル数 | 移行 |
|---|---|---|
| `NEXT_PUBLIC_LIFF_ID` | 4 | 削除 (フロント剥離後) |
| `NEXT_PUBLIC_LIFF_ID_SHARE` | 5 | 削除 |
| `NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT` | 11 | 削除 |
| `LINE_CHANNEL_SECRET` | 1 (webhook) | **残置** |
| `LINE_CHANNEL_ACCESS_TOKEN` | 3 (notify/cron) | **残置** |
| `LINE_NOTIFICATIONS_ENABLED` (新規) | (新規) | feature flag |

### 1-5. ディープリンク (Flex 内 LIFF URL) 8 経路

`line-flex.ts` 内の `https://liff.line.me/...?dest=*`:
- (なし) → `/report/{ownerToken}`
- `dest=zukan` → `/zukan/{ownerToken}`
- `dest=perceptions` → `/perceptions/{ownerToken}`
- `dest=zukan-mine` → `/zukan-mine`
- `dest=settings` → `/settings`
- `dest=integrated-new` → `/integrated/new`
- `dest=integrated&id=` → `/integrated/{id}`
- `dest=checkout-success` → `/checkout/success`

**移行**: Flex 関数は残置するが、ベースを `https://www.watashi-torisetsu.com/...` に書き換え。Phase 2 でフラグで切替できる構成にする (内部関数 `getDeepLinkBase()` を導入)。

---

## §2. データモデル再設計案

### 2-1. 設計原則

1. **既存スキーマは破壊しない**。FK / インデックス / カラムを削除しない。
2. **`owner_token` は共有 URL として継続使用**。新 token は導入しない。
3. **追加は最小限**: `users.session_token` / `users.email` / `magic_links` テーブル のみ。
4. **`line_user_id` 系は全テーブル温存**。Phase 2 で再びアクティブ化できる。

### 2-2. `users` テーブル追加カラム

```sql
ALTER TABLE users ADD COLUMN session_token text UNIQUE;
ALTER TABLE users ADD COLUMN email text;
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
CREATE INDEX idx_users_session_token ON users(session_token);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
```

- `session_token`: nanoid(32)。Cookie 値の DB 側照合キー。
- `email`: Stripe Checkout の `customer_details.email` で埋まる。複数 users 行が同じ email を持つ可能性あり (再診断ケース) → UNIQUE にはしない。
- `email_verified_at`: マジックリンク verify 成功時にセット。

### 2-3. 新規 `magic_links` テーブル

```sql
CREATE TABLE magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  email text NOT NULL,             -- 監査用 (送信先 email を記録)
  expires_at timestamptz NOT NULL, -- now() + interval '1 hour'
  used_at timestamptz,
  created_ip inet,                 -- rate limit 用
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_magic_links_token_active ON magic_links(token) WHERE used_at IS NULL;
CREATE INDEX idx_magic_links_user_active ON magic_links(user_id, created_at DESC) WHERE used_at IS NULL;
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;
-- anon ポリシーなし。service_role のみ。
```

### 2-4. 既存テーブルの扱い

| テーブル | 扱い |
|---|---|
| `friend_answers` | レガシー、変更なし |
| `friend_perceptions` | `perceiver_line_user_id` は nullable のまま温存 |
| `integrated_trisetsu` | 変更なし。`line_user_id` も温存 |
| `payment_history` | 変更なし。`metadata` に email を保存可 |
| `notification_preferences` | **Phase 2 まで凍結**。Web ファースト時は触らない |
| `line_users` | **Phase 2 まで凍結** |
| `line_messages_sent` | 変更なし。`message_type='magic_link'` の運用も検討 |
| `events` | 変更なし |
| `feature_optins` | **Phase 2 まで凍結** |

### 2-5. 通知設定の扱い

- 現状: `notification_preferences` は `line_user_id` 単位
- Web ファースト時: 設定 UI を一旦削除。Phase 2 で復活
- メール通知の ON/OFF は当面不要 (購入後・完成時の必須通知 1 通のみ)

---

## §3. セッション ID 設計

### 3-1. 基本仕様

| 項目 | 値 | 理由 |
|---|---|---|
| **Cookie 名** | `wn_session` | watashi-no-torisetsu の略。短くプロジェクト固有 |
| **値の形式** | `nanoid(32)` (192 bit エントロピー、URL-safe) | crypto.randomUUID() より短く、衝突確率は実用上ゼロ |
| **生成タイミング** | サーバー側 (初回 POST /api/diagnosis 等) | クライアント生成だと信頼できない |
| **保存先** | `users.session_token` (UNIQUE) | DB 側で user_id 解決 |
| **有効期限** | `Max-Age: 31536000` (1 年) | 大学生は学期またぎで再アクセスする想定 |
| **`HttpOnly`** | `true` | XSS で session を盗まれない |
| **`Secure`** | `true` (prod) / `false` (dev) | HTTPS のみ送信 |
| **`SameSite`** | `Lax` | 外部から /me/[token] に飛ぶ際の cookie 送信を許可 |
| **`Path`** | `/` | 全エンドポイントで使用 |
| **`Domain`** | 未指定 (= host-only) | サブドメイン共有不要 |

### 3-2. 生成・検証ロジック

```ts
// src/lib/session.ts (新規)
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';

const COOKIE_NAME = 'wn_session';
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getSession(): Promise<{ userId: string } | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('session_token', token)
    .maybeSingle();
  return data ? { userId: data.id } : null;
}

export async function setSessionForUser(userId: string): Promise<string> {
  const token = nanoid(32);
  await supabaseAdmin.from('users').update({ session_token: token }).eq('id', userId);
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR,
  });
  return token;
}
```

### 3-3. Edge ケース

- **既存ユーザー (`session_token IS NULL`) が初回アクセス**: マジックリンク経由でログイン → その時点で `session_token` を生成して紐付ける。
- **複数デバイス**: 各デバイスで別 token を持ちたい → MVP では 1 user 1 token (上書き)。将来 `user_sessions` テーブルに分離。
- **Cookie 削除**: 同一ユーザーの diagnosis 結果は失われる。email がある場合のみ復元可。

---

## §4. 結果 URL token 設計

### 4-1. URL 構造

```
/me/[token]         ← トリセツ表示 (現 /report/[ownerToken] の後継)
/me/[token]/zukan   ← 図鑑
/me/[token]/perceptions  ← 他者評価
/me/[token]/integrated   ← 統合トリセツ (購入後)
```

または既存パス (`/report/`, `/zukan/`, `/perceptions/`) を残す案もあるが、ブランド統一のため `/me/` 配下に統合推奨。

### 4-2. Token の正体

**結論: 既存 `users.owner_token` (nanoid 16B base64url = 22 文字) をそのまま `/me/[token]` の token として利用。**

理由:
- 既に UNIQUE + indexed + 永続生成済み
- 128 bit エントロピーは「URL を推測される確率」として実用上ゼロ
- 既存ページ (`/report/[ownerToken]` 等) と互換性のある token なので、内部リンクの書き換えだけで済む

仕様 spec の `nanoid(40)` (240 bit) は推測安全性が過剰。エントロピー的に 128 bit でも `10^17` 個生成して衝突確率 50% 程度なので問題なし。

### 4-3. 認可モデル

```
GET /me/[token]
├── token で users 検索
├── 見つからない → 404
├── 見つかる:
│   ├── session が存在 AND session.user_id === users.id → "owner"  (編集 UI 表示)
│   └── それ以外 → "viewer" (読み取りのみ、購入 UI 非表示)
```

- **読み取り = token のみで可** (友達シェアのため)
- **書き込み (PDF生成・購入・削除) = session 必須 + 一致**

### 4-4. プライバシー強化策

- `<meta name="robots" content="noindex" />` (検索エンジン除外)
- `Referrer-Policy: same-origin` (token を referer で漏らさない)
- OGP image は token 非依存にする (シェア時の token 露出を防ぐ)

---

## §5. メール送信サービス選定

### 5-1. 推奨: **Resend** (`resend` npm パッケージ)

| 項目 | Resend | SendGrid | Postmark |
|---|---|---|---|
| 無料枠 | 3,000 通/月、100/日 | 100 通/日 | 14 日試用後有料 |
| API 簡潔さ | ◎ (1 メソッド) | △ (重い) | ◯ |
| React Email サポート | ◎ ネイティブ | △ | △ |
| Vercel 統合 | ◎ Marketplace 一発 | ◯ | ◯ |
| 配信品質 | ◯ | ◎ | ◎ (最高) |
| ドキュメント | ◎ | △ (古い) | ◯ |
| 価格 (10K/月) | $0 | $19.95 | $15 |

### 5-2. Resend を選ぶ理由 (順)

1. **MVP 規模での無料枠**: 月 3,000 通 = 1 日 100 通の購入が無料。MVP は十分。
2. **React Email**: コンポーネントとして email テンプレートを書ける。既存 React スキルがそのまま使える。
3. **Vercel Marketplace 統合**: 環境変数自動プロビジョニング、DNS 設定ガイド付き。
4. **コードの少なさ**: `resend.emails.send({from, to, subject, react})` の 1 行。
5. **将来の移行コスト**: API が薄いので Postmark/SendGrid へ移行が容易 (もし必要になれば)。

### 5-3. ドメイン設定 (Day 6 でやること)

- カスタムドメイン: `noreply@mail.watashi-torisetsu.com` (サブドメイン推奨)
- 必要 DNS レコード: SPF (TXT), DKIM (CNAME × 2 or TXT), DMARC (TXT)
- Resend ダッシュボードで自動生成される DNS を Cloudflare / Vercel DNS に貼り付け
- 検証完了まで 24-48 時間 (キャッシュ依存)

---

## §6. マジックリンク認証フロー

### 6-1. シーケンス

```
[初回購入時 — メールは Stripe Checkout で収集]
Web/User → /integrated/new → 購入ボタン
       → POST /api/checkout/create-session
       → Stripe Checkout (email 入力フォーム表示)
       → 決済完了
       → Stripe Webhook: checkout.session.completed
         ├── payment_history INSERT
         ├── users.email = customer_details.email を UPDATE
         ├── integrated_trisetsu INSERT (status='pending')
         └── after(): AI 生成キック
       → AI 生成完了
         └── Resend: 「完成しました」メール送信
            └── 本文に /me/[ownerToken]/integrated/[id] への URL を埋め込み

[復元フロー — 別端末でアクセスしたい]
User → /me (token なし) → 「メールアドレスでログイン」ボタン
    → 入力フォーム { email }
    → POST /api/auth/magic-link { email }
       ├── rate limit チェック (同 IP/email で 1 時間 3 通まで)
       ├── users.email = email で検索 (複数ヒット時は最新 created_at を採用)
       │   └── 見つからない場合も同じレスポンス (email enumeration 対策)
       ├── magic_links INSERT (token=nanoid(40), expires_at=now+1h)
       └── Resend: 「ログインリンク」メール送信 (URL に token を含む)
    → ユーザーメール受信 → リンクタップ
    → GET /api/auth/verify?token=xxx
       ├── magic_links WHERE token=xxx AND used_at IS NULL AND expires_at > now()
       ├── 見つからない → /me?error=invalid_link にリダイレクト
       ├── 見つかる:
       │   ├── magic_links.used_at = now() に UPDATE
       │   ├── users.session_token を nanoid(32) で再生成・SET
       │   ├── users.email_verified_at = now() に UPDATE
       │   └── Cookie set + /me/[users.owner_token] に 302 リダイレクト
```

### 6-2. レート制限

- IP + email で `Cookie 経由のスタンプ + 軽量 KV` または DB の `created_at + created_ip` チェック
- 5 通/1h/IP、3 通/1h/email を上限
- 超過時は 429 + `Retry-After` ヘッダ

### 6-3. セキュリティ考慮

| 攻撃 | 対策 |
|---|---|
| トークン総当たり | 40 文字 nanoid (240 bit) + 1 時間期限 + 単発消費 |
| メール乗っ取り | 短期限 (1h) + magic_links 監査ログ |
| Enumeration (email 存在判定) | 成功・失敗ともに同レスポンス & 同 latency |
| Open redirect | verify 後の redirect 先は固定 (`/me/[token]`) |
| CSRF on verify | GET だが副作用あり → token が機密扱い、第三者は token を知らない前提 |
| メール本文の token 露出 | HTTPS + プレーンリンク。HTML メール内でのみ表示 |

---

## §7. 既存 LINE コードの扱い方針

### 7-1. 残置 (Phase 2 で復活想定 / 削除しない)

**コード資産:**
- `src/lib/line-flex.ts` — Flex builder 14 関数すべて
- `src/lib/line-notify.ts` — send* 関数 11 個すべて
- `src/lib/line-bot-client.ts` — Bot SDK ラッパー
- `src/lib/liff-verify.ts` — JWT 検証 (UI からの呼び出しは消えるが、ライブラリは残置)
- `src/app/api/webhook/line/route.ts` — webhook 本体
- `src/app/api/cron/remind-friend-eval/route.ts` — LINE リマインダ (cron) 

**DB:**
- `users.line_user_id` (nullable)
- `line_users` テーブル
- `notification_preferences` テーブル
- `line_messages_sent` テーブル
- `feature_optins` テーブル
- `friend_perceptions.perceiver_line_user_id`
- `integrated_trisetsu.line_user_id`

**設定:**
- `richmenu-config.json` (LINE Manager から再 push できる状態)
- `public/richmenu/main.jpg`
- env: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`

### 7-2. UI から削除

| 削除ページ | 理由 |
|---|---|
| `src/app/line-register/page.tsx` | LINE 紐付け不要 |
| `src/app/torisetsu/redirect/page.tsx` | LIFF endpoint 不要 |
| `src/app/share/page.tsx` | Web Share API で代替 |

**LIFF SDK の dynamic import 削除**: 11 ファイルから `@line/liff` を消す (上記削除ページ含む)。`package.json` の `@line/liff` 依存も最終的には外す。

### 7-3. Feature flag 設計

```ts
// src/lib/feature-flags.ts (新規)
export const LINE_NOTIFICATIONS_ENABLED =
  process.env.LINE_NOTIFICATIONS_ENABLED === 'true';
```

各 `send*Message` 関数の先頭に挿入:

```ts
export async function sendIntegratedCompletePaidMessage(args) {
  if (!LINE_NOTIFICATIONS_ENABLED) {
    return { success: true, skipped: 'line_disabled' };
  }
  // 既存処理...
}
```

これで Stripe Webhook や generator の呼び出し側は変更不要。Phase 2 で env を `true` に戻すだけで復活する。

### 7-4. LINE Webhook の扱い

- LINE Channel 側で webhook URL は残す (follow/unfollow を継続ログ)
- `notification_preferences` / `line_users` の同期は続行 (Phase 2 で復活する用)
- `welcome` 送信は feature flag で抑止
- 既存ユーザーが LINE をブロックしても Web 側に影響なし

---

## §8. Day 2 - Day 14 タスク詳細

### Day 2 (Sun 5/24) — マイグレーション SQL 起草

- `supabase/migrations/premium-v3-week1-web-first-auth.sql` 起草
  - `users.session_token`, `users.email`, `users.email_verified_at` 追加
  - `magic_links` テーブル新設
  - インデックス
- ロールバック SQL 同時作成
- `feature/premium-v3-web-first` ブランチ切る
- **dev DB には未適用** (適用は Day 3)

成果物: SQL ファイル × 2、PR ドラフト

### Day 3 (Mon 5/25) — マイグレーション適用 + セッションヘルパー

- Day 2 の SQL を Supabase dev DB に適用
- `src/lib/session.ts` 実装
  - `getSession()`, `setSessionForUser()`, `regenerateSession()`
- `src/lib/feature-flags.ts` 実装
- Unit test (session 発行・取得・期限切れ・無効 token)

成果物: session module + テスト

### Day 4 (Tue 5/26) — バックエンド認可置換

10 API route の `verifyBearer` → `getSession()` 置換:
- `/api/zukan-mine`
- `/api/checkout/create-session`
- `/api/integrated-trisetsu/[id]/pdf` (PDF 認可: session または共有 token 両対応)
- `/api/integrated-trisetsu`
- `/api/account/delete`
- `/api/diagnosis` (session 自動発行)
- `/api/settings/notifications` (一旦 410 Gone or 503)
- 削除: `/api/line-resolve`, `/api/line-register`
- 変更なし: `/api/friend-answer/v2` (友達は匿名 OK)

API ごとに E2E スモークテスト

### Day 5 (Wed 5/27) — フロント LIFF 剥がし (前半)

- `src/app/diagnosis/page.tsx` — LIFF init 削除、Cookie 自動付与
- `src/app/zukan-mine/page.tsx` — Bearer 不要、`credentials: 'include'` で fetch
- `src/app/integrated/new/page.tsx` — 同上
- `src/app/integrated/[id]/IntegratedDownloadButton.tsx` — 既存の window.open 維持、Bearer 削除
- `src/app/integrated/[id]/IntegratedShareButton.tsx` — `navigator.share()` に置換

### Day 6 (Thu 5/28) — フロント LIFF 剥がし (後半) + Resend 導入

- `src/app/friend/[inviteCode]/page.tsx` — LIFF profile 自動取得を「名前入力フォーム」に置換
- `src/app/share/page.tsx` — Web Share API
- `src/app/result/[ownerToken]/page.tsx` — LIFF 参照削除
- 削除: `line-register/page.tsx`, `torisetsu/redirect/page.tsx`, `settings/page.tsx` (一旦)
- `npm i resend`
- Resend アカウント作成、ドメイン申請、DNS 設定 (DKIM/SPF/DMARC) ← 検証 24-48h

### Day 7 (Fri 5/29) — マジックリンク API + メール送信

- `src/lib/email.ts` (Resend ラッパー + テンプレート)
- `src/emails/MagicLinkEmail.tsx` (React Email)
- `src/emails/IntegratedCompleteEmail.tsx`
- `POST /api/auth/magic-link/route.ts`
- `GET /api/auth/verify/route.ts`
- Rate limit middleware (KV または DB ベース簡易版)
- Day 6 の DNS が通っていれば送信テスト

### Day 8 (Sat 5/30) — Stripe Checkout 統合 + email 永続化

- `/api/checkout/create-session` で `customer_email` 必須化
- 事前に email 入力フォームを `/integrated/new` に追加
- Stripe Webhook: `customer_details.email` を `users.email` に保存
- AI 生成完了 hook で完成メール送信 (LINE 通知の代替)
- Stripe Test mode で full flow テスト

### Day 9 (Sun 5/31) — `/me/[token]` ページ実装

- 新ルート: `src/app/me/[token]/page.tsx`
- 既存 `/report/[ownerToken]` のコンテンツを移植
- `/me/[token]/integrated/[id]` で PDF プレビュー
- 認可: token (read) / session 一致 (write)
- 旧パスは 301 redirect で残す

### Day 10 (Mon 6/1) — LINE 通知 OFF + メール通知 ON

- `LINE_NOTIFICATIONS_ENABLED=false` を `.env.production` に設定
- 各 `send*` 関数に早期 return 挿入
- Stripe Webhook: LINE 呼び出しコードは触らず、feature flag で抑止
- Generator: 完成時に Resend で email 送信を追加

### Day 11 (Tue 6/2) — 友達評価フロー E2E

- `/friend/[inviteCode]` の名前入力 → 30 問 → 送信
- 友達評価は依然として認可不要 (現状維持)
- target user 側: メール通知 (email あれば) or 次回訪問時の UI バナー
- 3 人達成時のメール送信を実装

### Day 12 (Wed 6/3) — 統合 E2E + バグ修正

- フル疎通: 匿名 → 診断 → シェア → 友達 3 人回答 → 統合トリセツ購入 → メール → 別端末でリンクタップ → 永続表示
- Lighthouse / 主要ブラウザ (Safari, Chrome, iOS, Android) 動作確認
- バグ修正バッファ

### Day 13 (Thu 6/4) — Vercel preview デプロイ + α テスト

- Vercel preview にデプロイ
- 3-5 名の α テスター招集
- フィードバック収集、致命傷のみ修正

### Day 14 (Fri 6/5) — 本番デプロイ + 監視

- `feature/premium-v3-web-first` → `main` マージ
- 本番デプロイ
- ログ監視 (Resend dashboard, Vercel logs, Supabase)
- ホットフィックスバッファ

---

## §9. 想定リスク + 対処

| # | リスク | 影響度 | 対処 |
|---|---|---|---|
| 1 | Resend ドメイン認証 DNS 反映待ちで Day 7 ブロック | 高 | Day 6 朝イチで DNS 設定。検証 48h を想定して Day 7 を予備日扱い |
| 2 | Cookie 削除でユーザーがデータ喪失 | 中 | 購入後 email 必須化で復元路あり。未購入ユーザーは再診断で復元 |
| 3 | Resend が spam folder に入る | 中 | SPF/DKIM/DMARC 完備、送信元名を実在ブランドに、内容を transactional に寄せる |
| 4 | Magic link スパム送信 | 中 | IP+email rate limit、CAPTCHA は MVP では入れない (UX 重視) |
| 5 | owner_token URL 漏洩 (referer 経由) | 低 | `Referrer-Policy: same-origin`、OGP image は token 非依存にする |
| 6 | LINE webhook 受信は継続するが処理が空振り | 低 | feature flag で notify をスキップ、ログのみ残す |
| 7 | 既存 LIFF ユーザーが旧 URL を踏む | 中 | Day 9 で旧パスを 301 redirect。LIFF endpoint URL は LINE Manager 側で `/me/[token]` 系へ向け直し |
| 8 | Stripe Checkout で email 取得失敗 (ゲスト購入) | 中 | `customer_email` を必須にする。Stripe 側設定で `billing_address_collection: 'required'` も合わせ技 |
| 9 | 14 日は短すぎる | 中 | Day 12-14 を全バッファ。Day 6 と Day 8 は独立並行可能 (Resend と Stripe で分担) |
| 10 | 友達評価フローでログイン不要を保ったまま、悪意ある回答スパム | 中 | invite_code を 1 用途 (target_user_id ごと) に絞り、IP rate limit。MVP では監視で対応 |
| 11 | `users.email` に複数行が同 email で並ぶ (再診断) | 低 | Magic link で最新 created_at を採用、または email を入れた時点で過去 users 行を SET NULL |
| 12 | PDF メール添付 vs リンク誘導の選択 | 低 | **リンク誘導** で確定。添付は容量制限・スパム判定のリスク |
| 13 | LINE_NOTIFICATIONS_ENABLED の戻し忘れで Phase 2 開発が混乱 | 低 | env 変数の用途を `.env.example` に明記、Phase 2 着手時に CI でも検証 |
| 14 | Web Share API 非対応ブラウザ (古い PC ブラウザ) | 低 | フォールバックで「URL をコピー」ボタンを併設 |
| 15 | 既存テストが Bearer 前提で大量に壊れる | 中 | Day 3 で session fixture を整備、各テストは順次 fix。MVP は手動 E2E でカバー |

---

## 付録 A: クリティカルパス

```
Day 2 ──┬─→ Day 3 ─→ Day 4 ─→ Day 5 ─→ Day 9 ──→ Day 12 ─→ Day 13 ─→ Day 14
        │                                  ↑
        └─→ Day 6 (DNS) ─→ Day 7 ──→ Day 8 ─┤
                                            └─→ Day 10 ──→ Day 11 ──┘
```

ボトルネック:
- Day 6 の DNS 設定 → 検証完了まで 48h 想定
- Day 8 の Stripe email 統合 → Day 7 完了が前提

## 付録 B: やらないこと (Phase 2 以降)

- LINE 通知の復活 (`LINE_NOTIFICATIONS_ENABLED=true`)
- LINE 友達紐付け (`/line-register`, `notification_preferences` UI)
- LIFF endpoint pages の復活
- 高校生版 / 社会人版
- 10 人 / 20 人アンロック
- Compass 送客機能
- 多デバイスセッション (`user_sessions` テーブル分離)
- Email 通知設定 UI (購入後の必須メール以外)

## 付録 C: Day 1 で確定した設計判断

1. ✅ `owner_token` を共有 URL token として再利用 (新規 token は作らない)
2. ✅ Cookie 名 `wn_session`, nanoid(32), HttpOnly + Lax + 1 年
3. ✅ Resend 採用
4. ✅ LINE コードは全面残置、UI から剥がす + env feature flag
5. ✅ 追加カラム: `users.session_token`, `users.email`, `users.email_verified_at`
6. ✅ 新規テーブル: `magic_links`
7. ✅ Magic link 有効期限 1 時間、単発消費
8. ✅ PDF はメール添付ではなくリンク誘導
9. ✅ Phase 2 復活は env 1 変数で済む構成
