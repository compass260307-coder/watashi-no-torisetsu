-- =================================================================
-- ロールバック: プレミアム化 v2 Week 2 T2-8 (payment_history)
--   - 対応マイグレーション: premium-v2-week2-payment-history.sql
--   - 適用先: 本マイグレーションを適用済みの DB
--   - すべて DROP 系、追加なし
--   - IF EXISTS / DROP TABLE で再実行安全 (idempotent)
--
-- 注意:
--   ロールバック時点で integrated_trisetsu.payment_id に NULL でない値が
--   入っている (= Stripe 決済が記録された) レコードがある場合、
--   FK 制約を外しても integrated_trisetsu.payment_id 列の値は残ります。
--   payment_history テーブル自体は DROP するので、その値は意味を失います。
--   完全な綺麗な状態にするには、別途以下を流してください:
--     update integrated_trisetsu set payment_id = null where payment_id is not null;
-- =================================================================

-- =============================================================
-- 1. integrated_trisetsu.payment_id の FK を解除
-- =============================================================
alter table integrated_trisetsu
  drop constraint if exists integrated_trisetsu_payment_id_fkey;


-- =============================================================
-- 2. payment_history テーブルを削除
-- =============================================================
-- インデックス + 各種制約 + テーブル自体を一括削除
-- (DROP TABLE は依存するインデックス・制約を自動的に削除)
drop table if exists payment_history cascade;


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- A. payment_history が消えているか:
--
--   select count(*) from pg_tables where tablename = 'payment_history';
--   -- 期待: 0
--
-- B. integrated_trisetsu.payment_id 列は残っているか (T1-5 の追加分は維持):
--
--   select column_name from information_schema.columns
--    where table_name = 'integrated_trisetsu' and column_name = 'payment_id';
--   -- 期待: 1 行 (列は残置、FK のみ解除済み)
--
-- =============================================================
-- End of ロールバック
-- =============================================================
