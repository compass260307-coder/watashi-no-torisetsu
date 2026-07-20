-- 友達診断 (/tako) の課金解放 'tako_unlock' (2026-07-20)
--
-- 商品: 友達診断の隠しコンテンツ解放
--   価格: ¥1,299 / 全解放 (plan='full') 保有者は ¥499 OFF の ¥800
-- 権限は payment_history の completed 行から導出する (users にカラムは足さない)。
-- 判定は src/lib/entitlements.ts hasTakoAccess() に集約。
--
-- 適用: Supabase SQL Editor で本ファイルを実行する (自動適用はされない)。

-- 1. payment_kind CHECK に 'tako_unlock' を追加
alter table payment_history
  drop constraint if exists payment_history_payment_kind_check;

alter table payment_history
  add constraint payment_history_payment_kind_check
  check (
    payment_kind in (
      'integrated_trisetsu',
      'perception_unlock',
      'full_access',
      'tako_unlock'
    )
  )
  not valid;

alter table payment_history
  validate constraint payment_history_payment_kind_check;

-- 2. 権限判定用の部分インデックス (hasTakoAccess の user_id 検索)
create index if not exists idx_payment_history_tako_unlock
  on payment_history (user_id)
  where payment_kind = 'tako_unlock' and status = 'completed';
