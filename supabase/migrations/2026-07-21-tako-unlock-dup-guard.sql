-- tako_unlock の二重課金を DB レベルで防止 (2026-07-21)
--
-- 背景: /api/checkout/create-tako-unlock-session はアプリ層の hasTakoAccess
-- チェック (check-then-create) しか持たず、2 タブで同時に Checkout を開いて
-- 両方支払うと 2 回課金され、webhook は stripe_session_id が異なるため
-- 両方 completed で記録していた。perception_unlock の部分 UNIQUE
-- (idx_payment_unlocked_perception) に相当する防御を tako_unlock にも張る。
--
-- 部分 UNIQUE: 同一 user_id の tako_unlock completed は 1 行まで。
-- - failed / pending / refunded は対象外 → 返金後の再購入は妨げない
-- - webhook 側 (handleTakoUnlockCompleted) は 23505 を「二重課金 = 要返金」
--   として Slack 通知 + 200 受領する (リトライしても解消しない毒イベントのため)
--
-- 適用: Supabase SQL Editor で本ファイルを実行する (自動適用はされない)。
-- 注意: 既に二重課金の行が存在すると index 作成が失敗する。先に下の
--   「事前確認クエリ」で重複を洗い出し、返金済みの行を status='refunded' に
--   直してから実行すること。

-- 事前確認クエリ (重複があれば 1 行以上返る):
-- select user_id, count(*) from payment_history
--   where payment_kind = 'tako_unlock' and status = 'completed'
--   group by user_id having count(*) > 1;

create unique index if not exists idx_payment_tako_unlock_once
  on payment_history (user_id)
  where payment_kind = 'tako_unlock' and status = 'completed';

-- 動作確認 (実行は任意):
-- select indexname from pg_indexes
--   where tablename = 'payment_history'
--     and indexname = 'idx_payment_tako_unlock_once';
