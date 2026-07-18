-- =================================================================
-- プレミアム化 v2 Week 3 T3-1: DB データ完全リセット
--   - スキーマは保持、データのみ削除
--   - 既存テストアカウント 6 名分 + Stripe テスト決済 + AI 統合トリセツ
--     その他派生データを一括 TRUNCATE
--   - CASCADE で外部キー連鎖削除に対応
--   - 実行: Supabase Dashboard → SQL Editor で全文コピペ実行
--
-- 適用前チェックリスト:
--   [ ] 既存テストアカウント 6 名は全員プロジェクトメンバーで通知不要を確認済
--   [ ] Supabase の自動バックアップ (PITR) がここ 24h 以内に取られている確認
--   [ ] T1-5 / T2-8 / T3-3 のマイグレーションが本番 DB に適用済
--   [ ] dev サーバを停止する必要は無い (本番 DB 直接操作)
--
-- 想定実行時間: < 5 秒 (テーブル合計 ~4000 行)
-- =================================================================

-- =============================================================
-- 1. リセット前: 行数の事前記録 (実行前に手動で確認しても OK)
-- =============================================================
-- 実行前に以下を別途実行して件数記録するのを推奨:
--   select 'users' as tbl, count(*) from users
--    union all select 'line_users', count(*) from line_users
--    union all select 'friend_answers', count(*) from friend_answers
--    union all select 'friend_perceptions', count(*) from friend_perceptions
--    union all select 'integrated_trisetsu', count(*) from integrated_trisetsu
--    union all select 'payment_history', count(*) from payment_history
--    union all select 'notification_preferences', count(*) from notification_preferences
--    union all select 'line_messages_sent', count(*) from line_messages_sent
--    union all select 'feature_optins', count(*) from feature_optins
--    union all select 'events', count(*) from events;


-- =============================================================
-- 2. TRUNCATE 実行 (CASCADE で外部キー連鎖)
-- =============================================================
-- 順序は CASCADE があるので技術的には任意だが、可読性のため
-- 「派生から本体へ」(下流 → 上流) で記述。
truncate table
  events,                     -- 分析イベント (3,897 行、依存なし、独立)
  line_messages_sent,         -- LINE 送信ログ
  notification_preferences,   -- 通知設定 (line_users 経由で users 紐付け)
  integrated_trisetsu,        -- AI 統合トリセツ (users + payment_history 参照)
  payment_history,            -- Stripe 決済履歴 (users 参照)
  friend_perceptions,         -- 友達評価派生 (friend_answers + users 参照)
  friend_answers,             -- 友達評価生回答 (users 参照)
  feature_optins,             -- 機能オプトイン (line_user_id 紐付け、users 直接参照なし)
  line_users,                 -- LINE ユーザー紐付け (users 参照)
  users                       -- 自己診断 (本体、全ての起点)
restart identity cascade;

-- restart identity:
--   schema は uuid default gen_random_uuid() なので auto-increment 列はないが
--   将来的に sequence が増えても安全のため明示


-- =============================================================
-- 3. リセット後検証: 全テーブル 0 件確認
-- =============================================================
-- 以下を実行して全部 0 になっていることを確認:
--
--   select 'users' as tbl, count(*) from users
--    union all select 'line_users', count(*) from line_users
--    union all select 'friend_answers', count(*) from friend_answers
--    union all select 'friend_perceptions', count(*) from friend_perceptions
--    union all select 'integrated_trisetsu', count(*) from integrated_trisetsu
--    union all select 'payment_history', count(*) from payment_history
--    union all select 'notification_preferences', count(*) from notification_preferences
--    union all select 'line_messages_sent', count(*) from line_messages_sent
--    union all select 'feature_optins', count(*) from feature_optins
--    union all select 'events', count(*) from events;
--
--   期待: 全行 count = 0


-- =============================================================
-- 4. スキーマ無事確認: 主要テーブル/列が残っていることを確認
-- =============================================================
--   select table_name from information_schema.tables
--    where table_schema = 'public'
--    order by table_name;
--   -- 期待: 上記 10 テーブル全部
--
--   select column_name from information_schema.columns
--    where table_name = 'friend_perceptions' and column_name like 'pdf_consent%';
--   -- 期待: pdf_consent / pdf_consent_at / pdf_consent_revoked_at (T3-3 で追加)
--
--   select column_name from information_schema.columns
--    where table_name = 'integrated_trisetsu'
--      and column_name in ('generated_chapters','generated_subtitle','status','payment_id');
--   -- 期待: 4 行 (T1-5)
--
--   select count(*) from information_schema.tables
--    where table_name = 'payment_history';
--   -- 期待: 1 (T2-8)

-- =============================================================
-- End of プレミアム化 v2 Week 3 T3-1 リセット SQL
-- =============================================================
