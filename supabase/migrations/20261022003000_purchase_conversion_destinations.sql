-- Additive rollout: old webhooks can keep using the legacy provider/session
-- outbox until the app is deployed. Only v2 workers claim pixel-specific jobs.
begin;

create table public.purchase_conversion_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('meta', 'tiktok')),
  destination_id text not null,
  stripe_session_id text not null,
  user_id text,
  product text not null,
  paid_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'expired')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, destination_id, stripe_session_id),
  check ((provider = 'meta' and destination_id = '') or
         (provider = 'tiktok' and destination_id ~ '^[A-Z0-9]{20}$'))
);
create index purchase_conversion_delivery_due
  on public.purchase_conversion_delivery_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');
create index purchase_conversion_delivery_lease
  on public.purchase_conversion_delivery_outbox (updated_at)
  where status = 'processing';

alter table public.purchase_conversion_delivery_outbox enable row level security;
revoke all on table public.purchase_conversion_delivery_outbox from public, anon, authenticated;
grant select, insert, update on table public.purchase_conversion_delivery_outbox to service_role;

alter table public.purchase_conversion_outbox
  drop constraint purchase_conversion_outbox_status_check;
alter table public.purchase_conversion_outbox
  add constraint purchase_conversion_outbox_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'expired', 'expanded'));

-- No tokens or customer payloads are copied. Historical TikTok deliveries refer
-- to D9V8IIBC77UFF28NGHK0, the sole destination of the previous integration.
create function public.prepare_purchase_conversion_deliveries(p_session_id text default null)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  expired_count integer;
  old_expired_count integer;
begin
  -- Expire before selecting a limited batch: stale jobs must not starve recent ones.
  update public.purchase_conversion_outbox
  set status = 'expired',
      last_error = case provider
        when 'meta' then 'event_expired: Meta web event exceeds the 7-day upload window'
        else 'event_expired: TikTok web event exceeds the local 7-day replay policy' end,
      updated_at = now()
  where paid_at <= now() - interval '7 days'
    and (status in ('pending', 'failed') or
         (status = 'processing' and updated_at <= now() - interval '15 minutes'));
  get diagnostics old_expired_count = row_count;

  insert into public.purchase_conversion_delivery_outbox (
    provider, destination_id, stripe_session_id, user_id, product, paid_at,
    status, attempts, last_error
  )
  select legacy.provider, destinations.destination_id, legacy.stripe_session_id,
         legacy.user_id, legacy.product, legacy.paid_at,
         case when legacy.status = 'sent' and
             (legacy.provider = 'meta' or destinations.destination_id = 'D9V8IIBC77UFF28NGHK0')
           then 'sent' else 'pending' end,
         case when legacy.provider = 'meta' or destinations.destination_id = 'D9V8IIBC77UFF28NGHK0'
           then legacy.attempts else 0 end,
         case when legacy.status = 'sent' then null else legacy.last_error end
  from public.purchase_conversion_outbox legacy
  cross join lateral (
    select ''::text as destination_id where legacy.provider = 'meta'
    union all
    select code from (values
      ('D9V8IIBC77UFF28NGHK0'), ('DAUFBCRC77U5PB60GLP0'), ('DAV7P7RC77UA36CC79E0')
    ) as pixels(code) where legacy.provider = 'tiktok'
  ) destinations
  where legacy.paid_at > now() - interval '7 days'
    and (legacy.status in ('pending', 'failed', 'sent', 'expanded') or
         (legacy.status = 'processing' and legacy.updated_at <= now() - interval '15 minutes'))
    and (p_session_id is null or legacy.stripe_session_id = p_session_id)
  on conflict (provider, destination_id, stripe_session_id) do nothing;

  -- Retain the legacy attempts and payment timestamp for audit.
  update public.purchase_conversion_outbox
  set status = 'expanded',
      last_error = 'expanded: transferred to purchase_conversion_delivery_outbox',
      updated_at = now()
  where paid_at > now() - interval '7 days'
    and (status in ('pending', 'failed') or
         (status = 'processing' and updated_at <= now() - interval '15 minutes'))
    and (p_session_id is null or stripe_session_id = p_session_id);

  update public.purchase_conversion_delivery_outbox
  set status = 'expired',
      last_error = case provider
        when 'meta' then 'event_expired: Meta web event exceeds the 7-day upload window'
        else 'event_expired: TikTok web event exceeds the local 7-day replay policy' end,
      updated_at = now()
  where paid_at <= now() - interval '7 days'
    and (status in ('pending', 'failed') or
         (status = 'processing' and updated_at <= now() - interval '15 minutes'));
  get diagnostics expired_count = row_count;
  return old_expired_count + expired_count;
end;
$$;

create function public.claim_due_purchase_conversion_deliveries(
  p_limit integer default 25, p_session_id text default null
)
returns setof public.purchase_conversion_delivery_outbox
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.prepare_purchase_conversion_deliveries(p_session_id);
  return query
  with due as (
    select queue.id
    from public.purchase_conversion_delivery_outbox queue
    where (p_session_id is null or queue.stripe_session_id = p_session_id)
      and queue.paid_at > now() - interval '7 days'
      and (
        (queue.status in ('pending', 'failed') and queue.next_attempt_at <= now())
        or (queue.status = 'processing' and queue.updated_at <= now() - interval '15 minutes')
      )
    order by queue.next_attempt_at, queue.created_at, queue.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.purchase_conversion_delivery_outbox queue
  set status = 'processing', attempts = queue.attempts + 1, updated_at = now()
  from due where queue.id = due.id
  returning queue.*;
end;
$$;

revoke all on function public.prepare_purchase_conversion_deliveries(text) from public, anon, authenticated;
revoke all on function public.claim_due_purchase_conversion_deliveries(integer, text) from public, anon, authenticated;
grant execute on function public.prepare_purchase_conversion_deliveries(text) to service_role;
grant execute on function public.claim_due_purchase_conversion_deliveries(integer, text) to service_role;

-- Clean up existing failed rows and expand only the unexpired purchases.
select public.prepare_purchase_conversion_deliveries(null);
commit;
