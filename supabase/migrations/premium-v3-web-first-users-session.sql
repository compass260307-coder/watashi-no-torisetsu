-- =================================================================
-- プレミアム化 v3 Day 2: Web ファースト認可基盤 — users 拡張 + magic_links
--   - 計画書 docs/PREMIUM_V3_DAY1_MIGRATION_PLAN.md § 2 に準拠
--   - LINE 必須を捨て、Cookie セッション + マジックリンクで認可するための土台
--   - すべて add 系 (ADD COLUMN / CREATE TABLE / CREATE INDEX)、列削除なし
--   - IF NOT EXISTS / DO ブロックで再実行安全 (idempotent)
--   - 既存 RLS lockdown (PR-FIX-1) を踏襲: service role のみアクセス可
--   - 実行: Supabase Dashboard → SQL Editor で全文コピペ実行
--   - 本番適用タイミング: Day 3 のセッションヘルパー実装と接続テストの前
-- =================================================================


-- =============================================================
-- 1. users テーブルにセッション/メール用カラム追加
-- =============================================================
-- - session_token: Cookie 値 (nanoid 32 文字 = 192 bit エントロピー) の DB 側照合キー
--   UNIQUE (重複生成は実用上ゼロだが念のため) / NULL 許容 (生成前のレガシー行のため)
-- - email: Stripe Checkout の customer_details.email で埋まる。再診断で複数行が
--   同じ email を持ち得るため UNIQUE にしない。NOT NULL でもない (未購入ユーザー)
-- - email_verified_at: マジックリンク verify 成功時にセット。未確認 NULL のまま
alter table users
  add column if not exists session_token text,
  add column if not exists email text,
  add column if not exists email_verified_at timestamptz;


-- session_token に UNIQUE 制約 (ADD CONSTRAINT は IF NOT EXISTS 非対応のため DO で idempotent 化)
do $$
begin
  alter table users
    add constraint users_session_token_unique
    unique (session_token);
exception when duplicate_object then null;
end $$;


-- =============================================================
-- 2. インデックス (users)
-- =============================================================
-- - email は WHERE email IS NOT NULL の partial index で肥大化を抑制
--   (未購入ユーザーは email NULL のまま、検索対象外)
create index if not exists idx_users_email
  on users(email)
  where email is not null;

-- 注: session_token は UNIQUE 制約で自動インデックス化されるため別途不要


-- =============================================================
-- 3. magic_links テーブル新設
-- =============================================================
-- - メールアドレスからのログインリンクを管理 (1h 期限、単発消費)
-- - user_id ON DELETE CASCADE: ユーザー削除時にリンクも消す
-- - token は nanoid 40 文字 (240 bit エントロピー) を想定。長くても問題なし
-- - email カラムは送信時の宛先を監査用に記録 (users.email との不一致検出用)
-- - created_ip は rate limit / 監査用 (inet 型で IPv4/IPv6 両対応)
create table if not exists magic_links (
  id uuid primary key default gen_random_uuid(),

  -- リンクが結びつくユーザー (削除時にリンクも消える = CASCADE)
  user_id uuid not null references users(id) on delete cascade,

  -- マジックリンク token (URL 内に含まれる、推測不可)
  token text not null,

  -- 送信先メールアドレス (監査用、users.email と一致するはず)
  email text not null,

  -- 有効期限 (now() + interval '1 hour' を想定)
  expires_at timestamptz not null,

  -- 消費済みタイムスタンプ (NULL = 未使用、now() = 使用済み)
  used_at timestamptz,

  -- 発行リクエストの送信元 IP (rate limit / 監査用、IPv4/IPv6 両対応)
  created_ip inet,

  created_at timestamptz not null default now()
);


-- token UNIQUE 制約 (二重生成防止 + GET /api/auth/verify の高速検索)
do $$
begin
  alter table magic_links
    add constraint magic_links_token_unique
    unique (token);
exception when duplicate_object then null;
end $$;


-- =============================================================
-- 4. インデックス (magic_links)
-- =============================================================
-- - 有効期限切れリンクの掃除バッチ用 (定期的に DELETE WHERE expires_at < now() AND used_at IS NULL)
--   used_at IS NULL の partial index で消費済みは無視 (肥大化抑制)
create index if not exists idx_magic_links_expires
  on magic_links(expires_at)
  where used_at is null;

-- - ユーザーごとの直近リンク (rate limit / 再送防止チェック)
--   used_at IS NULL の partial index で消費済みは無視
create index if not exists idx_magic_links_user_active
  on magic_links(user_id, created_at desc)
  where used_at is null;


-- =============================================================
-- 5. RLS 有効化 (lockdown: policy なし = service role のみアクセス可)
-- =============================================================
-- 既存 integrated_trisetsu / users / payment_history と同じ PR-FIX-1 パターン
-- anon / authenticated ロールからは完全遮断
alter table magic_links enable row level security;


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- A. users 拡張カラムの存在確認:
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_name = 'users'
--      and column_name in ('session_token', 'email', 'email_verified_at')
--    order by column_name;
--   -- 期待: 3 行 (すべて nullable)
--
-- B. users の UNIQUE 制約:
--
--   select conname, contype
--     from pg_constraint
--    where conrelid = 'users'::regclass
--      and conname = 'users_session_token_unique';
--   -- 期待: 1 行 (contype = 'u')
--
-- C. magic_links テーブル + 制約の存在確認:
--
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_name = 'magic_links'
--    order by ordinal_position;
--
--   select conname, contype
--     from pg_constraint
--    where conrelid = 'magic_links'::regclass;
--   -- 期待: magic_links_pkey (p) / magic_links_user_id_fkey (f) / magic_links_token_unique (u)
--
-- D. インデックスの存在確認:
--
--   select indexname from pg_indexes
--    where tablename in ('users', 'magic_links')
--      and indexname in (
--        'idx_users_email',
--        'idx_magic_links_expires',
--        'idx_magic_links_user_active'
--      );
--   -- 期待: 3 行
--
-- E. UNIQUE 制約の動作確認 (失敗を期待):
--
--   -- 一時的に既存ユーザー 2 件に同じ session_token を入れる
--   -- 実 DB では既存行があるので id を指定する形で:
--   --   update users set session_token = 'duplicate_test' where id = '...';
--   --   update users set session_token = 'duplicate_test' where id = '...';
--   -- 期待: 2 件目で ERROR: duplicate key value violates unique constraint
--
-- F. RLS lockdown の動作確認 (anon ロールでアクセス失敗を期待):
--
--   set local role anon;
--   select count(*) from magic_links;
--   -- 期待: 0 件 or permission denied (policy なしで anon は何も見えない)
--   reset role;
--
-- =============================================================
-- End of プレミアム化 v3 Day 2 マイグレーション
-- =============================================================
