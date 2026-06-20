-- =================================================================
-- Day 12-C3: users に「SNS媒体別＋キャンペーン別 新規流入元」2カラム追加
--   - acquisition_source   … 媒体名 (tiktok / instagram / note / x / line など)
--   - acquisition_campaign … 任意のキャンペーン/投稿識別子
--
--   ⚠️ これは source_user_id / generation (人単位のバイラル招待ツリー) とは
--      別物。あちらは「誰の招待で来たか」、こちらは「どの媒体/投稿で来たか」。
--      source_user_id / generation には一切触らない。
--
--   - どちらも nullable・text。既存行は NULL のままでよい (後追い計測なので
--     過去ユーザーの媒体は不明 = NULL が正しい)。
--   - すべて追加のみ (ALTER ADD)、既存カラム削除・変更なし。
--   - IF NOT EXISTS で再実行安全 (idempotent)。
--   - RLS は users 既存設定 (PR-FIX-1 lockdown) を継承。
--   - 実行: Supabase Dashboard → SQL Editor で全文コピペ実行。
-- =================================================================

-- =============================================================
-- 1. 2カラム追加
-- =============================================================
alter table users
  add column if not exists acquisition_source text;

alter table users
  add column if not exists acquisition_campaign text;

-- =============================================================
-- 2. インデックス (媒体別/キャンペーン別の集計 WHERE/GROUP BY 用)
-- =============================================================
create index if not exists idx_users_acquisition_source
  on users(acquisition_source);

create index if not exists idx_users_acquisition_campaign
  on users(acquisition_campaign);


-- =============================================================
-- 動作確認クエリ (実行は任意)
-- =============================================================
-- 媒体別の新規ユーザー数:
--
--   select acquisition_source, count(*)
--     from users
--    group by acquisition_source
--    order by count(*) desc;
--
-- 媒体 × キャンペーン:
--
--   select acquisition_source, acquisition_campaign, count(*)
--     from users
--    group by acquisition_source, acquisition_campaign
--    order by count(*) desc;
--
-- =============================================================
-- End of Day 12-C3 acquisition-source-campaign マイグレーション
-- =============================================================
