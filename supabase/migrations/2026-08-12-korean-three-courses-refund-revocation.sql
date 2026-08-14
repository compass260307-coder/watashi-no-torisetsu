-- 日韓3コースと運命の設計図の返金時権限再計算に必要な決済種別を統一する。
-- unmei / unmei_upgrade も payment_history に保存し、charge.refunded から
-- 対象ユーザーと残存権限を安全に特定できるようにする。

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
      'premium_bundle',
      'unmei',
      'unmei_upgrade'
    )
  )
  not valid;

alter table public.payment_history
  validate constraint payment_history_payment_kind_check;

create index if not exists idx_payment_history_unmei_user
  on public.payment_history (user_id, paid_at)
  where payment_kind in ('unmei', 'unmei_upgrade', 'premium_bundle')
    and status = 'completed';

create index if not exists idx_payment_history_payment_intent
  on public.payment_history (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
