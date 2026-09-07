-- Stripe payment facts must never depend on an advertising provider being up.
-- Persist one durable job per provider and retry it independently after the
-- webhook has saved access, payment_history, and purchase_completed.

begin;

create table if not exists public.purchase_conversion_outbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta', 'tiktok')),
  stripe_session_id text not null,
  user_id text,
  product text not null,
  paid_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, stripe_session_id)
);

create index if not exists idx_purchase_conversion_outbox_due
  on public.purchase_conversion_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.purchase_conversion_outbox enable row level security;
revoke all on table public.purchase_conversion_outbox
  from public, anon, authenticated;
grant select, insert, update on table public.purchase_conversion_outbox
  to service_role;

-- Recover recent live purchases that happened before the outbox existed.
-- Advertising APIs generally reject old web events, so keep this bounded to
-- the current attribution window instead of replaying the full payment ledger.
insert into public.purchase_conversion_outbox (
  provider,
  stripe_session_id,
  user_id,
  product,
  paid_at
)
select
  providers.provider,
  payments.stripe_session_id,
  payments.user_id::text,
  coalesce(
    nullif(payments.metadata ->> 'product', ''),
    nullif(payments.payment_kind, ''),
    'unknown'
  ),
  coalesce(payments.paid_at, payments.created_at)
from public.payment_history as payments
cross join (values ('meta'), ('tiktok')) as providers(provider)
where payments.status in ('completed', 'refunded')
  and payments.stripe_session_id like 'cs_live_%'
  and coalesce(payments.paid_at, payments.created_at) >= now() - interval '6 days'
  and greatest(
    coalesce(payments.amount_jpy, 0) - coalesce(payments.amount_refunded_minor, 0),
    0
  ) > 0
on conflict (provider, stripe_session_id) do nothing;

-- Claim jobs atomically so overlapping cron/webhook workers do not normally
-- send the same job together. Provider event_id deduplication remains the final
-- safety net. A 15-minute lease recovers a function that stopped mid-request.
create or replace function public.claim_due_purchase_conversions(
  p_limit integer default 25,
  p_session_id text default null
)
returns setof public.purchase_conversion_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select queue.id
    from public.purchase_conversion_outbox as queue
    where (p_session_id is null or queue.stripe_session_id = p_session_id)
      and (
        (
          queue.status in ('pending', 'failed')
          and queue.next_attempt_at <= now()
        )
        or (
          queue.status = 'processing'
          and queue.updated_at <= now() - interval '15 minutes'
        )
      )
    order by queue.next_attempt_at, queue.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.purchase_conversion_outbox as queue
  set
    status = 'processing',
    attempts = queue.attempts + 1,
    updated_at = now()
  from due
  where queue.id = due.id
  returning queue.*;
end;
$$;

revoke all on function public.claim_due_purchase_conversions(integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_due_purchase_conversions(integer, text)
  to service_role;

commit;
