-- =================================================================
-- ロールバック: プレミアム化 v3 Day 2 (Web ファースト認可基盤)
--   - 対応マイグレーション: premium-v3-web-first-users-session.sql
--   - 適用先: 本マイグレーションを適用済みの DB
--   - すべて DROP 系、追加なし
--   - IF EXISTS / DROP TABLE で再実行安全 (idempotent)
--
-- 注意:
--   ロールバック時点で users.email / session_token / email_verified_at に
--   値が入っている (= マジックリンク登録済み or セッション持ち) レコードがあれば、
--   それらの値は永久に失われます。本番ロールバックは慎重に。
--   ステージング/開発 DB の巻き戻しを主な用途として想定。
-- =================================================================


-- =============================================================
-- 1. magic_links テーブルを削除 (依存インデックス・FK・制約も同時に消える)
-- =============================================================
drop table if exists magic_links cascade;


-- =============================================================
-- 2. users から拡張カラムを削除 (UNIQUE 制約と partial index も自動で消える)
-- =============================================================
-- DROP COLUMN は依存する制約・インデックスを CASCADE で削除する
-- ※ idx_users_email は email 列削除で自動消去
-- ※ users_session_token_unique は session_token 列削除で自動消去
alter table users
  drop column if exists email_verified_at,
  drop column if exists email,
  drop column if exists session_token;


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- A. magic_links が消えているか:
--
--   select count(*) from pg_tables where tablename = 'magic_links';
--   -- 期待: 0
--
-- B. users から拡張列が消えているか:
--
--   select column_name from information_schema.columns
--    where table_name = 'users'
--      and column_name in ('session_token', 'email', 'email_verified_at');
--   -- 期待: 0 行
--
-- C. 関連インデックス・制約が消えているか:
--
--   select indexname from pg_indexes
--    where indexname in (
--      'idx_users_email',
--      'idx_magic_links_expires',
--      'idx_magic_links_user_active'
--    );
--   -- 期待: 0 行
--
--   select conname from pg_constraint
--    where conname = 'users_session_token_unique';
--   -- 期待: 0 行
--
-- =============================================================
-- End of ロールバック
-- =============================================================
