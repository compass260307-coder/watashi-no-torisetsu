-- ¥899「完全版 + 運命の設計図」プレミアムコース。
--
-- Webhook は users.plan='full' と users.unmei=true の両方を付与し、
-- 売上の源泉は payment_history.payment_kind='premium_bundle' に1決済1行で保存する。

alter table public.payment_history
  drop constraint if exists payment_history_payment_kind_check;

alter table public.payment_history
  add constraint payment_history_payment_kind_check
  check (
    payment_kind in (
      'integrated_trisetsu',
      'perception_unlock',
      'full_access',
      'tako_unlock',
      'self_report',
      'premium_bundle'
    )
  )
  not valid;

alter table public.payment_history
  validate constraint payment_history_payment_kind_check;

create index if not exists idx_payment_history_premium_bundle_user
  on public.payment_history (user_id, paid_at)
  where payment_kind = 'premium_bundle' and status = 'completed';
