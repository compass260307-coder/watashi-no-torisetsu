-- =================================================================
-- ロールバック: プレミアム化 v2 Week 1 T1-5 (integrated_trisetsu 拡張)
--   - 対応マイグレーション: premium-v2-week1-integrated-trisetsu-extensions.sql
--   - 適用先: マイグレーションを適用済みかつ Week 3 リセット (TRUNCATE) 前の DB
--   - Week 3 リセット後は generated_body / generated_summary を別マイグレーションで
--     DROP する想定なので、その後はこのロールバックを実行する意味は薄い
--     (リセット前に問題が見つかった場合の緊急時用)
--   - すべて DROP 系 + alter (set not null)、追加なし
--   - IF EXISTS で再実行安全 (idempotent)
-- =================================================================

-- =============================================================
-- 1. インデックスの削除
-- =============================================================
drop index if exists idx_integrated_trisetsu_status_pending;
drop index if exists idx_integrated_trisetsu_payment_unique;


-- =============================================================
-- 2. CHECK 制約の削除
-- =============================================================
alter table integrated_trisetsu
  drop constraint if exists integrated_trisetsu_status_check;


-- =============================================================
-- 3. 列の削除
-- =============================================================
alter table integrated_trisetsu
  drop column if exists pdf_url,
  drop column if exists pdf_generated_at,
  drop column if exists payment_id,
  drop column if exists retry_count,
  drop column if exists failure_reason,
  drop column if exists status,
  drop column if exists generated_subtitle,
  drop column if exists generated_chapters;


-- =============================================================
-- 4. NOT NULL 制約の復元 (generated_body)
-- =============================================================
-- 注意: ロールバック時点で generated_body が NULL の行が存在すると失敗する。
-- 失敗した場合は以下のいずれかで対応:
--   (a) その NULL 行を generated_body = '' で UPDATE してからロールバック
--   (b) NULL 行は v2 試行データなので DELETE してからロールバック
alter table integrated_trisetsu
  alter column generated_body set not null;


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- 元のスキーマに戻ったか:
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_name = 'integrated_trisetsu'
--    order by ordinal_position;
--
-- 期待: phase-3b-release-1-foundations.sql の定義と完全一致
--
-- =============================================================
-- End of ロールバック
-- =============================================================
