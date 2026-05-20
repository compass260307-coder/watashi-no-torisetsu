-- =================================================================
-- プレミアム化 v2 Week 2 T2-8 (計画書では T2-9): payment_history テーブル新設
--   - 計画書 docs/PREMIUM_PLAN.md § 12 / § 13 / § 10 に準拠
--   - Stripe 決済 1 件 = payment_history 1 行 (Idempotency 第 1 層)
--   - integrated_trisetsu.payment_id (T1-5 で uuid 型のみ追加済) に FK を後付け
--   - 既存 RLS 設定 (PR-FIX-1 lockdown) を踏襲: RLS 有効化、policy なし
--     (service role のみアクセス可、anon/authenticated は遮断)
--   - すべて add 系 (CREATE TABLE / ADD CONSTRAINT / CREATE INDEX)、列削除なし
--   - IF NOT EXISTS / DO ブロックで再実行安全 (idempotent)
--   - 実行: Supabase Dashboard → SQL Editor で全文コピペ実行
--   - 本番適用タイミング: T1-5 と同じく、追加のみで破壊性なし。
--     T2-9 (Webhook 実装) の前までに本番適用しておくと、Webhook 着信→INSERT の
--     ローカル/Vercel Preview テストがすぐ通る。
-- =================================================================

-- =============================================================
-- 1. payment_history テーブル新設
-- =============================================================
create table if not exists payment_history (
  id uuid primary key default gen_random_uuid(),

  -- 決済を行ったユーザー (users 削除時は決済履歴も削除 = CASCADE)
  -- 削除後の経理確認が必要なら、別途 events / line_messages_sent に痕跡を残す
  user_id uuid not null references users(id) on delete cascade,

  -- Stripe Checkout Session ID (Idempotency 第 1 層、UNIQUE 制約は別途 ADD)
  -- 同じ session_id で Webhook が複数回飛んできても DB レベルで弾く
  stripe_session_id text not null,

  -- 関連する PaymentIntent ID (返金時に使用、Webhook 種別によっては null)
  stripe_payment_intent_id text,

  -- 売上金額 (JPY 整数、税込)
  amount_jpy integer not null,

  -- 通貨コード (Stripe 仕様、現状は 'jpy' のみ想定)
  currency text not null default 'jpy',

  -- 決済ステータス: pending | completed | failed | refunded
  status text not null,

  -- ステータス遷移タイムスタンプ
  paid_at timestamptz,
  refunded_at timestamptz,

  -- 追加メタ (perception_ids 配列、include_self 等、Stripe metadata から複製)
  metadata jsonb,

  created_at timestamptz default now(),

  -- アプリ側 UPDATE で `set updated_at = now()` 必須 (トリガは敢えて入れない)
  updated_at timestamptz default now()
);


-- =============================================================
-- 2. UNIQUE 制約 (Idempotency 第 1 層)
-- =============================================================
-- ADD CONSTRAINT は IF NOT EXISTS をサポートしないため DO ブロックで idempotent 化
do $$
begin
  alter table payment_history
    add constraint payment_history_stripe_session_id_unique
    unique (stripe_session_id);
exception when duplicate_object then null;
end $$;


-- =============================================================
-- 3. status の CHECK 制約 (列挙値の固定)
-- =============================================================
do $$
begin
  alter table payment_history
    add constraint payment_history_status_check
    check (status in ('pending', 'completed', 'failed', 'refunded'));
exception when duplicate_object then null;
end $$;


-- =============================================================
-- 4. インデックス
-- =============================================================
-- ユーザーごとの決済一覧 (settings の課金履歴セクション、Admin 集計)
create index if not exists idx_payment_history_user_id
  on payment_history(user_id);

-- 失敗/未完了レコードの監視 (Slack アラート、整合性スクリプト)
-- completed は除外して肥大化を抑制
create index if not exists idx_payment_history_status_pending
  on payment_history(status)
  where status <> 'completed';

-- 注: stripe_session_id は UNIQUE 制約で自動インデックス化されるため別途不要


-- =============================================================
-- 5. integrated_trisetsu.payment_id に FK 追加 (Idempotency 第 2 層連結)
-- =============================================================
-- T1-5 で uuid 型のみ追加、payment_history テーブル不在で FK 未付与だった列に
-- ここで参照整合性制約を付与する。
--
-- ON DELETE SET NULL の理由:
--   - payment_history を「物理削除」する運用は想定していない (refund も論理状態のみ)
--   - 万一 GDPR 等で個別削除する場合でも、integrated_trisetsu (有料コンテンツ実体)
--     は履歴として残す方が安全
--   - users 削除時は users → payment_history CASCADE + users → integrated_trisetsu CASCADE
--     が両方走るので、SET NULL が問題になる経路はない
do $$
begin
  alter table integrated_trisetsu
    add constraint integrated_trisetsu_payment_id_fkey
    foreign key (payment_id) references payment_history(id)
    on delete set null;
exception when duplicate_object then null;
end $$;


-- =============================================================
-- 6. RLS 有効化 (lockdown: policy 無し = service role のみアクセス可)
-- =============================================================
-- 既存 integrated_trisetsu / users 等と同じ PR-FIX-1 パターン
alter table payment_history enable row level security;


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- A. テーブルと制約の存在確認:
--
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_name = 'payment_history'
--    order by ordinal_position;
--
--   select conname, contype
--     from pg_constraint
--    where conrelid = 'payment_history'::regclass;
--   -- 期待: payment_history_pkey (p)
--   --      payment_history_user_id_fkey (f)
--   --      payment_history_stripe_session_id_unique (u)
--   --      payment_history_status_check (c)
--
-- B. integrated_trisetsu.payment_id の FK 存在確認:
--
--   select conname, contype, confdeltype
--     from pg_constraint
--    where conname = 'integrated_trisetsu_payment_id_fkey';
--   -- 期待: confdeltype = 'n' (SET NULL)
--
-- C. UNIQUE 制約の動作確認 (失敗を期待):
--
--   insert into payment_history (user_id, stripe_session_id, amount_jpy, status)
--   values (gen_random_uuid(), 'cs_test_dup', 500, 'pending'),
--          (gen_random_uuid(), 'cs_test_dup', 500, 'pending');
--   -- 期待: ERROR: duplicate key value violates unique constraint
--
-- D. CHECK 制約の動作確認 (失敗を期待):
--
--   insert into payment_history (user_id, stripe_session_id, amount_jpy, status)
--   values (gen_random_uuid(), 'cs_test_check', 500, 'invalid_status');
--   -- 期待: ERROR: new row for relation "payment_history" violates check constraint
--
-- =============================================================
-- End of プレミアム化 v2 Week 2 T2-8 マイグレーション
-- =============================================================
