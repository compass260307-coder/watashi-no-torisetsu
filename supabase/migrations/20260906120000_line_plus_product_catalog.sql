-- Alice Plus: 月額/年額プランと期間パスの商品識別子を保存する。
-- 期間パスは、同一ユーザーの有効期限に購入日数を加算する。
-- RPC内でusers行をロックし、並行WebhookとStripe再送の両方を冪等にする。

begin;

alter table public.line_plus_subscriptions
  add column if not exists plan_key text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists access_days integer,
  add column if not exists purchased_at timestamptz;

-- 旧行はstatus/合成IDから可能な限り復元し、通常のStripeサブスクは月額扱いにする。
update public.line_plus_subscriptions
   set plan_key = case
     when status = 'lifetime' or stripe_subscription_id like 'lifetime-%'
       then 'lifetime'
     when status = 'week_pass' or stripe_subscription_id like 'week-%'
       then 'week'
     else 'monthly'
   end
 where plan_key is null;

alter table public.line_plus_subscriptions
  alter column plan_key set default 'monthly',
  alter column plan_key set not null;

alter table public.line_plus_subscriptions
  add constraint line_plus_subscriptions_plan_key_check check (
    plan_key in ('monthly', 'annual', 'day', 'week', 'month_pass', 'lifetime')
  ),
  add constraint line_plus_subscriptions_time_pass_shape_check check (
    status <> 'time_pass'
    or (
      plan_key in ('day', 'week', 'month_pass')
      and access_days = case plan_key
        when 'day' then 1
        when 'week' then 7
        when 'month_pass' then 30
      end
      and stripe_checkout_session_id is not null
      and stripe_payment_intent_id is not null
      and stripe_price_id is not null
      and purchased_at is not null
      and current_period_end is not null
    )
  );

create unique index if not exists uq_line_plus_subscriptions_checkout_session
  on public.line_plus_subscriptions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists uq_line_plus_subscriptions_payment_intent
  on public.line_plus_subscriptions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists idx_line_plus_subscriptions_plan_status
  on public.line_plus_subscriptions (plan_key, status, current_period_end);

-- Stripe Customerをアプリユーザーへ固定し、Checkout作成をユーザー単位で
-- 直列化する。外部API呼び出し中はDBトランザクションを保持できないため、
-- 短い期限付きleaseを使う。プロセスが途中終了しても期限後に自動回復する。
create table if not exists public.line_plus_checkout_controls (
  user_id uuid primary key references public.users(id) on delete cascade,
  last_line_user_id text not null,
  customer_request_id uuid not null default gen_random_uuid(),
  stripe_customer_id text unique,
  customer_mapping_conflict boolean not null default false,
  checkout_attempt_id uuid,
  checkout_attempt_fingerprint text,
  checkout_session_id text unique,
  checkout_plan_key text,
  checkout_session_expires_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_plus_checkout_plan_key_check check (
    checkout_plan_key is null
    or checkout_plan_key in ('monthly', 'annual', 'day', 'week', 'month_pass')
  ),
  constraint line_plus_checkout_lease_pair_check check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  ),
  constraint line_plus_checkout_attempt_pair_check check (
    (checkout_attempt_id is null and checkout_attempt_fingerprint is null)
    or (
      checkout_attempt_id is not null
      and checkout_attempt_fingerprint is not null
    )
  ),
  constraint line_plus_checkout_session_group_check check (
    (
      checkout_session_id is null
      and checkout_plan_key is null
      and checkout_session_expires_at is null
    )
    or (
      checkout_session_id is not null
      and checkout_plan_key is not null
      and checkout_session_expires_at is not null
      and checkout_attempt_id is not null
    )
  )
);

alter table public.line_plus_checkout_controls enable row level security;
-- policyは作らない。Checkout Routeのservice roleだけが利用する。

-- 既存購入者はCustomerが一意なら引き継ぐ。複数Customerがあっても、
-- 管理対象サブスクのCustomerだけが一意ならそれを正とする。それ以外は
-- conflictを保存し、Route側で新規課金をfail closedにして手動確認へ回す。
insert into public.line_plus_checkout_controls (
  user_id,
  last_line_user_id,
  stripe_customer_id,
  customer_mapping_conflict,
  created_at,
  updated_at
)
with customer_counts as (
  select
    s.user_id,
    count(distinct s.stripe_customer_id) as customer_count,
    count(distinct s.stripe_customer_id) filter (
      where s.status in (
        'active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused'
      )
    ) as manageable_customer_count
  from public.line_plus_subscriptions s
  where s.stripe_customer_id is not null
    and char_length(s.stripe_customer_id) >= 8
  group by s.user_id
)
select
  counts.user_id,
  latest.line_user_id,
  case
    when counts.manageable_customer_count = 1
      then manageable.stripe_customer_id
    when counts.customer_count = 1
      then latest.stripe_customer_id
    else null
  end,
  (
    counts.manageable_customer_count > 1
    or (
      counts.manageable_customer_count = 0
      and counts.customer_count > 1
    )
  ),
  now(),
  now()
from customer_counts counts
cross join lateral (
  select s.line_user_id, s.stripe_customer_id
  from public.line_plus_subscriptions s
  where s.user_id = counts.user_id
    and s.stripe_customer_id is not null
    and char_length(s.stripe_customer_id) >= 8
  order by s.updated_at desc, s.created_at desc, s.id desc
  limit 1
) latest
left join lateral (
  select s.stripe_customer_id
  from public.line_plus_subscriptions s
  where s.user_id = counts.user_id
    and s.status in (
      'active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused'
    )
    and s.stripe_customer_id is not null
    and char_length(s.stripe_customer_id) >= 8
  order by s.updated_at desc, s.created_at desc, s.id desc
  limit 1
) manageable on true
on conflict (user_id) do update
  set last_line_user_id = excluded.last_line_user_id,
      stripe_customer_id = coalesce(
        line_plus_checkout_controls.stripe_customer_id,
        excluded.stripe_customer_id
      ),
      customer_mapping_conflict =
        line_plus_checkout_controls.customer_mapping_conflict
        or excluded.customer_mapping_conflict,
      updated_at = now();

create or replace function public.acquire_line_plus_checkout_lease(
  p_user_id uuid,
  p_line_user_id text,
  p_lease_token uuid,
  p_lease_seconds integer
)
returns table (
  acquired boolean,
  customer_request_id uuid,
  stripe_customer_id text,
  customer_mapping_conflict boolean,
  checkout_attempt_id uuid,
  checkout_attempt_fingerprint text,
  checkout_session_id text,
  checkout_plan_key text,
  checkout_session_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_control public.line_plus_checkout_controls%rowtype;
begin
  if p_user_id is null
     or p_line_user_id is null
     or char_length(p_line_user_id) < 1
     or p_lease_token is null
     or p_lease_seconds is null
     or p_lease_seconds < 15
     or p_lease_seconds > 120 then
    raise exception 'invalid Alice Plus checkout lease';
  end if;

  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Alice Plus user not found';
  end if;

  insert into public.line_plus_checkout_controls (
    user_id,
    last_line_user_id,
    lease_token,
    lease_expires_at,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_line_user_id,
    p_lease_token,
    v_now + make_interval(secs => p_lease_seconds),
    v_now,
    v_now
  )
  on conflict (user_id) do nothing;

  update public.line_plus_checkout_controls c
     set last_line_user_id = p_line_user_id,
         lease_token = p_lease_token,
         lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
         updated_at = v_now
   where c.user_id = p_user_id
     and (
       c.lease_token = p_lease_token
       or c.lease_expires_at is null
       or c.lease_expires_at <= v_now
     )
  returning c.* into v_control;

  if found then
    return query select
      true,
      v_control.customer_request_id,
      v_control.stripe_customer_id,
      v_control.customer_mapping_conflict,
      v_control.checkout_attempt_id,
      v_control.checkout_attempt_fingerprint,
      v_control.checkout_session_id,
      v_control.checkout_plan_key,
      v_control.checkout_session_expires_at;
    return;
  end if;

  select *
    into v_control
    from public.line_plus_checkout_controls c
   where c.user_id = p_user_id;

  return query select
    false,
    v_control.customer_request_id,
    v_control.stripe_customer_id,
    v_control.customer_mapping_conflict,
    v_control.checkout_attempt_id,
    v_control.checkout_attempt_fingerprint,
    v_control.checkout_session_id,
    v_control.checkout_plan_key,
    v_control.checkout_session_expires_at;
end;
$$;

revoke all on function public.acquire_line_plus_checkout_lease(
  uuid, text, uuid, integer
) from public, anon, authenticated;
grant execute on function public.acquire_line_plus_checkout_lease(
  uuid, text, uuid, integer
) to service_role;

create or replace function public.save_line_plus_checkout_customer(
  p_user_id uuid,
  p_lease_token uuid,
  p_stripe_customer_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_customer_id text;
begin
  if p_user_id is null
     or p_lease_token is null
     or p_stripe_customer_id is null
     or char_length(p_stripe_customer_id) < 8 then
    raise exception 'invalid Alice Plus checkout customer';
  end if;

  select c.stripe_customer_id
    into v_existing_customer_id
    from public.line_plus_checkout_controls c
   where c.user_id = p_user_id
     and c.lease_token = p_lease_token
     and c.lease_expires_at > clock_timestamp()
     and not c.customer_mapping_conflict
   for update;
  if not found then
    return false;
  end if;

  if v_existing_customer_id is not null
     and v_existing_customer_id <> p_stripe_customer_id then
    raise exception 'Alice Plus Stripe Customer mismatch';
  end if;

  update public.line_plus_checkout_controls
     set stripe_customer_id = p_stripe_customer_id,
         updated_at = clock_timestamp()
   where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.save_line_plus_checkout_customer(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_line_plus_checkout_customer(uuid, uuid, text)
  to service_role;

create or replace function public.prepare_line_plus_checkout_attempt(
  p_user_id uuid,
  p_lease_token uuid,
  p_attempt_fingerprint text,
  p_force_new boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_control public.line_plus_checkout_controls%rowtype;
  v_attempt_id uuid;
begin
  if p_user_id is null
     or p_lease_token is null
     or p_attempt_fingerprint is null
     or char_length(p_attempt_fingerprint) < 8
     or char_length(p_attempt_fingerprint) > 500
     or p_force_new is null then
    raise exception 'invalid Alice Plus checkout attempt';
  end if;

  select *
    into v_control
    from public.line_plus_checkout_controls c
   where c.user_id = p_user_id
     and c.lease_token = p_lease_token
     and c.lease_expires_at > clock_timestamp()
     and not c.customer_mapping_conflict
   for update;
  if not found then
    return null;
  end if;

  if not p_force_new
     and v_control.checkout_attempt_id is not null
     and v_control.checkout_attempt_fingerprint = p_attempt_fingerprint then
    return v_control.checkout_attempt_id;
  end if;

  v_attempt_id := gen_random_uuid();
  update public.line_plus_checkout_controls
     set checkout_attempt_id = v_attempt_id,
         checkout_attempt_fingerprint = p_attempt_fingerprint,
         checkout_session_id = null,
         checkout_plan_key = null,
         checkout_session_expires_at = null,
         updated_at = clock_timestamp()
   where user_id = p_user_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.prepare_line_plus_checkout_attempt(
  uuid, uuid, text, boolean
) from public, anon, authenticated;
grant execute on function public.prepare_line_plus_checkout_attempt(
  uuid, uuid, text, boolean
) to service_role;

create or replace function public.save_line_plus_checkout_session(
  p_user_id uuid,
  p_lease_token uuid,
  p_stripe_customer_id text,
  p_checkout_session_id text,
  p_plan_key text,
  p_session_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved_user_id uuid;
begin
  if p_user_id is null
     or p_lease_token is null
     or p_stripe_customer_id is null
     or char_length(p_stripe_customer_id) < 8
     or p_checkout_session_id is null
     or char_length(p_checkout_session_id) < 8
     or p_plan_key not in ('monthly', 'annual', 'day', 'week', 'month_pass')
     or p_session_expires_at is null then
    raise exception 'invalid Alice Plus checkout session';
  end if;

  update public.line_plus_checkout_controls c
     set checkout_session_id = p_checkout_session_id,
         checkout_plan_key = p_plan_key,
         checkout_session_expires_at = p_session_expires_at,
         lease_token = null,
         lease_expires_at = null,
         updated_at = clock_timestamp()
   where c.user_id = p_user_id
     and c.stripe_customer_id = p_stripe_customer_id
     and c.checkout_attempt_id is not null
     and c.lease_token = p_lease_token
     and c.lease_expires_at > clock_timestamp()
  returning c.user_id into v_saved_user_id;

  return v_saved_user_id is not null;
end;
$$;

revoke all on function public.save_line_plus_checkout_session(
  uuid, uuid, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.save_line_plus_checkout_session(
  uuid, uuid, text, text, text, timestamptz
) to service_role;

create or replace function public.release_line_plus_checkout_lease(
  p_user_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released_user_id uuid;
begin
  update public.line_plus_checkout_controls c
     set lease_token = null,
         lease_expires_at = null,
         updated_at = clock_timestamp()
   where c.user_id = p_user_id
     and c.lease_token = p_lease_token
  returning c.user_id into v_released_user_id;

  return v_released_user_id is not null;
end;
$$;

revoke all on function public.release_line_plus_checkout_lease(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_line_plus_checkout_lease(uuid, uuid)
  to service_role;

-- Checkoutが確定・失効・支払い失敗になった後、次の購入に進めるよう
-- 保存中のattemptだけを片付ける。進行中Routeのleaseは触らない。
create or replace function public.clear_line_plus_checkout_attempt(
  p_checkout_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cleared_user_id uuid;
begin
  if p_checkout_session_id is null
     or char_length(p_checkout_session_id) < 8 then
    raise exception 'invalid Alice Plus checkout session';
  end if;

  update public.line_plus_checkout_controls c
     set checkout_attempt_id = null,
         checkout_attempt_fingerprint = null,
         checkout_session_id = null,
         checkout_plan_key = null,
         checkout_session_expires_at = null,
         updated_at = clock_timestamp()
   where c.checkout_session_id = p_checkout_session_id
  returning c.user_id into v_cleared_user_id;

  return v_cleared_user_id is not null;
end;
$$;

revoke all on function public.clear_line_plus_checkout_attempt(text)
  from public, anon, authenticated;
grant execute on function public.clear_line_plus_checkout_attempt(text)
  to service_role;

create or replace function public.grant_line_plus_time_pass(
  p_user_id uuid,
  p_line_user_id text,
  p_stripe_customer_id text,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_plan_key text,
  p_stripe_price_id text,
  p_access_days integer,
  p_purchased_at timestamptz
)
returns table (expires_at timestamptz, was_granted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_end timestamptz;
  v_expires_at timestamptz;
  v_cursor timestamptz;
  v_row record;
begin
  if p_user_id is null
     or p_line_user_id is null
     or char_length(p_line_user_id) < 1
     or p_plan_key is null
     or p_plan_key not in ('day', 'week', 'month_pass')
     or p_access_days is null
     or p_access_days <> (case p_plan_key
       when 'day' then 1
       when 'week' then 7
       when 'month_pass' then 30
     end)
     or p_stripe_checkout_session_id is null
     or char_length(p_stripe_checkout_session_id) < 8
     or p_stripe_payment_intent_id is null
     or char_length(p_stripe_payment_intent_id) < 8
     or p_stripe_price_id is null
     or char_length(p_stripe_price_id) < 8
     or p_purchased_at is null then
    raise exception 'invalid Alice Plus time pass grant';
  end if;

  -- users行は必ず存在する(FK)。ユーザー単位で期限計算を直列化する。
  perform 1 from public.users where id = p_user_id for update;
  if not found then
    raise exception 'Alice Plus user not found';
  end if;

  select s.current_period_end
    into v_existing_end
    from public.line_plus_subscriptions s
   where s.stripe_checkout_session_id = p_stripe_checkout_session_id
   limit 1;
  if found then
    select max(s.current_period_end)
      into v_existing_end
      from public.line_plus_subscriptions s
     where s.user_id = p_user_id
       and s.status in ('time_pass', 'week_pass');
    return query select v_existing_end, false;
    return;
  end if;

  insert into public.line_plus_subscriptions (
    user_id,
    line_user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_price_id,
    plan_key,
    access_days,
    purchased_at,
    status,
    current_period_end,
    cancel_at_period_end,
    updated_at
  ) values (
    p_user_id,
    p_line_user_id,
    p_stripe_customer_id,
    'pass-' || p_stripe_checkout_session_id,
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    p_stripe_price_id,
    p_plan_key,
    p_access_days,
    p_purchased_at,
    'time_pass',
    p_purchased_at + make_interval(days => p_access_days),
    true,
    now()
  );

  -- Webhookの到着順は購入順と一致しない。全パスを購入時刻順に毎回
  -- 再計算し、遅着イベントが後続パスの期限を過大延長しないようにする。
  -- 旧week_passは過去に案内済みのcurrent_period_endを保護し、その満了を
  -- 新パスの起点にする。旧行の期限をcreated_atから作り直さない。
  select max(s.current_period_end)
    into v_cursor
    from public.line_plus_subscriptions s
   where s.user_id = p_user_id
     and s.status = 'week_pass';

  for v_row in
    select s.id, s.purchased_at, s.access_days
      from public.line_plus_subscriptions s
     where s.user_id = p_user_id
       and s.status = 'time_pass'
       and s.purchased_at is not null
       and s.access_days is not null
     order by s.purchased_at asc, s.created_at asc, s.id asc
  loop
    v_cursor := greatest(
      coalesce(v_cursor, v_row.purchased_at),
      v_row.purchased_at
    ) + make_interval(days => v_row.access_days);

    update public.line_plus_subscriptions
       set current_period_end = v_cursor,
           updated_at = now()
     where id = v_row.id;
  end loop;

  select max(s.current_period_end)
    into v_expires_at
    from public.line_plus_subscriptions s
   where s.user_id = p_user_id
     and s.status in ('time_pass', 'week_pass');

  return query select v_expires_at, true;
end;
$$;

revoke all on function public.grant_line_plus_time_pass(
  uuid, text, text, text, text, text, text, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.grant_line_plus_time_pass(
  uuid, text, text, text, text, text, text, integer, timestamptz
) to service_role;

create or replace function public.revoke_line_plus_time_pass(
  p_stripe_payment_intent_id text,
  p_refunded_at timestamptz
)
returns table (was_found boolean, user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_cursor timestamptz;
  v_row record;
begin
  select s.user_id
    into v_user_id
    from public.line_plus_subscriptions s
   where s.stripe_payment_intent_id = p_stripe_payment_intent_id
   limit 1;
  if not found then
    return query select false, null::uuid;
    return;
  end if;

  perform 1 from public.users where id = v_user_id for update;

  update public.line_plus_subscriptions
     set status = 'refunded',
         updated_at = p_refunded_at
   where stripe_payment_intent_id = p_stripe_payment_intent_id
     and status <> 'refunded';

  -- 返金後の残りパスを購入時刻順に再計算する。返金対象でない
  -- 旧week_passの案内済み期限はアンカーとして保護する。
  select max(s.current_period_end)
    into v_cursor
    from public.line_plus_subscriptions s
   where s.user_id = v_user_id
     and s.status = 'week_pass';

  for v_row in
    select s.id, s.purchased_at, s.access_days
      from public.line_plus_subscriptions s
     where s.user_id = v_user_id
       and s.status = 'time_pass'
       and s.purchased_at is not null
       and s.access_days is not null
     order by s.purchased_at asc, s.created_at asc, s.id asc
  loop
    v_cursor := greatest(
      coalesce(v_cursor, v_row.purchased_at),
      v_row.purchased_at
    ) + make_interval(days => v_row.access_days);

    update public.line_plus_subscriptions
       set current_period_end = v_cursor,
           updated_at = p_refunded_at
     where id = v_row.id;
  end loop;

  return query select true, v_user_id;
end;
$$;

revoke all on function public.revoke_line_plus_time_pass(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.revoke_line_plus_time_pass(text, timestamptz)
  to service_role;

commit;
