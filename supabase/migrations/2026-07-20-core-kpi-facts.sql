-- Core KPI facts (server-side sources of truth)
--
-- 1. users.diagnosis_completed_at
--    Browser events can be blocked or emitted before a save succeeds. This column is
--    written by /api/diagnosis only after the diagnosis payload has been validated.
-- 2. payment_history.payment_kind = 'full_access'
--    Full-access purchases were previously represented only by users.plan and an
--    analytics event. Persisting the Stripe payment makes revenue/ARPU auditable.
-- 3. payment_history.amount_refunded_minor
--    Keeps net revenue correct after full or partial refunds.

alter table public.users
  add column if not exists diagnosis_completed_at timestamptz;

-- Existing normal user rows were created by a successful diagnosis save. The only
-- exception is the paid-before-diagnosis placeholder, which has neutral scores and
-- no display name. Leave that placeholder NULL until the real diagnosis is saved.
update public.users
set diagnosis_completed_at = created_at
where diagnosis_completed_at is null
  and not (
    plan = 'full'
    and display_name is null
    and scores = '{"O": 5, "C": 5, "E": 5, "A": 5, "N": 5}'::jsonb
  );

create index if not exists idx_users_diagnosis_completed_at
  on public.users(diagnosis_completed_at)
  where diagnosis_completed_at is not null;

alter table public.payment_history
  add column if not exists amount_refunded_minor integer not null default 0;

-- Replace the old two-value check so the current product is represented explicitly.
alter table public.payment_history
  drop constraint if exists payment_history_payment_kind_check;

alter table public.payment_history
  add constraint payment_history_payment_kind_check
  check (
    payment_kind in ('integrated_trisetsu', 'perception_unlock', 'full_access')
  ) not valid;

alter table public.payment_history
  validate constraint payment_history_payment_kind_check;

create index if not exists idx_payment_history_full_access_paid_at
  on public.payment_history(paid_at)
  where payment_kind = 'full_access';

create index if not exists idx_payment_history_full_access_user
  on public.payment_history(user_id, paid_at)
  where payment_kind = 'full_access';
