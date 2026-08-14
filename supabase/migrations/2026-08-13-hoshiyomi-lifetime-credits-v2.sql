-- 星読みの案内人: 月次上限から「買い切りの生涯チャット回数」へ移行する。
--   完全版 (JPY): 5回 / プレミアム: 30回 / 完全版→プレミアム: +25回
-- 送信時は先に1回予約し、AIエラー時は同じ reservation_id を取り消して1回だけ返却する。

create table if not exists public.hoshiyomi_credit_balances (
  user_id uuid primary key references public.users(id) on delete cascade,
  credits_total integer not null default 0 check (credits_total >= 0),
  credits_remaining integer not null default 0
    check (credits_remaining >= 0 and credits_remaining <= credits_total),
  updated_at timestamptz not null default now()
);

create table if not exists public.hoshiyomi_credit_grants (
  source_key text primary key check (char_length(source_key) between 8 and 200),
  user_id uuid not null references public.users(id) on delete cascade,
  credits integer not null check (credits > 0),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_hoshiyomi_credit_grants_user
  on public.hoshiyomi_credit_grants (user_id, created_at desc);

create table if not exists public.hoshiyomi_credit_reservations (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{8,80}$'),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists idx_hoshiyomi_credit_reservations_user_status
  on public.hoshiyomi_credit_reservations (user_id, status, created_at);

alter table public.hoshiyomi_credit_balances enable row level security;
alter table public.hoshiyomi_credit_grants enable row level security;
alter table public.hoshiyomi_credit_reservations enable row level security;

revoke all on public.hoshiyomi_credit_balances from anon, authenticated;
revoke all on public.hoshiyomi_credit_grants from anon, authenticated;
revoke all on public.hoshiyomi_credit_reservations from anon, authenticated;

create or replace function public.grant_hoshiyomi_credits(
  p_user_id uuid,
  p_source_key text,
  p_credits integer
)
returns table (was_granted boolean, credits_total integer, credits_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_total integer := 0;
  v_remaining integer := 0;
begin
  if p_credits <= 0 or char_length(p_source_key) not between 8 and 200 then
    raise exception 'invalid hoshiyomi credit grant';
  end if;

  insert into public.hoshiyomi_credit_grants (source_key, user_id, credits)
  values (p_source_key, p_user_id, p_credits)
  on conflict (source_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    insert into public.hoshiyomi_credit_balances (
      user_id, credits_total, credits_remaining, updated_at
    ) values (p_user_id, p_credits, p_credits, now())
    on conflict (user_id) do update
      set credits_total = hoshiyomi_credit_balances.credits_total + excluded.credits_total,
          credits_remaining = hoshiyomi_credit_balances.credits_remaining + excluded.credits_remaining,
          updated_at = now();
  end if;

  select b.credits_total, b.credits_remaining
    into v_total, v_remaining
    from public.hoshiyomi_credit_balances b
   where b.user_id = p_user_id;

  return query select v_inserted = 1, coalesce(v_total, 0), coalesce(v_remaining, 0);
end;
$$;

create or replace function public.release_stale_hoshiyomi_reservations(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released integer := 0;
begin
  -- created_at の索引と行ロックにより、同時実行されても1予約を二重返却しない。
  with released as (
    update public.hoshiyomi_credit_reservations
       set status = 'released', settled_at = now()
     where user_id = p_user_id
       and status = 'reserved'
       and created_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*)::integer into v_released from released;

  if v_released > 0 then
    update public.hoshiyomi_credit_balances
       set credits_remaining = least(credits_total, credits_remaining + v_released),
           updated_at = now()
     where user_id = p_user_id;
  end if;

  return v_released;
end;
$$;

create or replace function public.reserve_hoshiyomi_credit(
  p_user_id uuid,
  p_reservation_id text
)
returns table (allowed boolean, credits_total integer, credits_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_remaining integer := 0;
begin
  if p_reservation_id !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'invalid hoshiyomi reservation id';
  end if;

  -- 通信断などで settle できなかった予約は10分後に自動返却する。
  perform public.release_stale_hoshiyomi_reservations(p_user_id);

  update public.hoshiyomi_credit_balances as balance
     set credits_remaining = balance.credits_remaining - 1,
         updated_at = now()
   where balance.user_id = p_user_id
     and balance.credits_remaining > 0
  returning balance.credits_total,
            balance.credits_remaining
       into v_total, v_remaining;

  if found then
    insert into public.hoshiyomi_credit_reservations (id, user_id)
    values (p_reservation_id, p_user_id);
    return query select true, v_total, v_remaining;
    return;
  end if;

  select b.credits_total, b.credits_remaining
    into v_total, v_remaining
    from public.hoshiyomi_credit_balances b
   where b.user_id = p_user_id;
  return query select false, coalesce(v_total, 0), coalesce(v_remaining, 0);
end;
$$;

create or replace function public.settle_hoshiyomi_credit(
  p_user_id uuid,
  p_reservation_id text,
  p_commit boolean
)
returns table (credits_total integer, credits_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed uuid;
  v_total integer := 0;
  v_remaining integer := 0;
begin
  update public.hoshiyomi_credit_reservations
     set status = case when p_commit then 'committed' else 'released' end,
         settled_at = now()
   where id = p_reservation_id
     and user_id = p_user_id
     and status = 'reserved'
  returning user_id into v_changed;

  if v_changed is not null and not p_commit then
    update public.hoshiyomi_credit_balances as balance
       set credits_remaining = least(
             balance.credits_total,
             balance.credits_remaining + 1
           ),
           updated_at = now()
     where balance.user_id = p_user_id;
  end if;

  select b.credits_total, b.credits_remaining
    into v_total, v_remaining
    from public.hoshiyomi_credit_balances b
   where b.user_id = p_user_id;
  return query select coalesce(v_total, 0), coalesce(v_remaining, 0);
end;
$$;

create or replace function public.revoke_hoshiyomi_credit_grant(
  p_source_key text
)
returns table (was_revoked boolean, credits_total integer, credits_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_credits integer;
  v_status text;
  v_remove integer := 0;
  v_total integer := 0;
  v_remaining integer := 0;
begin
  select g.user_id, g.credits, g.status
    into v_user_id, v_credits, v_status
    from public.hoshiyomi_credit_grants g
   where g.source_key = p_source_key
   for update;

  if v_user_id is null or v_status = 'revoked' then
    return query select false, 0, 0;
    return;
  end if;

  update public.hoshiyomi_credit_grants
     set status = 'revoked', revoked_at = now()
   where source_key = p_source_key;

  select least(b.credits_remaining, v_credits)
    into v_remove
    from public.hoshiyomi_credit_balances b
   where b.user_id = v_user_id
   for update;

  -- 消費済みの回数を負数にはせず、この購入で付与した total と
  -- 現在残っている分を回収する。remaining <= total は常に保たれる。
  update public.hoshiyomi_credit_balances as balance
     set credits_total = greatest(balance.credits_total - v_credits, 0),
         credits_remaining = greatest(
           balance.credits_remaining - coalesce(v_remove, 0),
           0
         ),
         updated_at = now()
   where balance.user_id = v_user_id
  returning balance.credits_total,
            balance.credits_remaining
       into v_total, v_remaining;

  return query select true, coalesce(v_total, 0), coalesce(v_remaining, 0);
end;
$$;

revoke all on function public.grant_hoshiyomi_credits(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.release_stale_hoshiyomi_reservations(uuid)
  from public, anon, authenticated;
revoke all on function public.reserve_hoshiyomi_credit(uuid, text)
  from public, anon, authenticated;
revoke all on function public.settle_hoshiyomi_credit(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.revoke_hoshiyomi_credit_grant(text)
  from public, anon, authenticated;
grant execute on function public.grant_hoshiyomi_credits(uuid, text, integer) to service_role;
grant execute on function public.release_stale_hoshiyomi_reservations(uuid) to service_role;
grant execute on function public.reserve_hoshiyomi_credit(uuid, text) to service_role;
grant execute on function public.settle_hoshiyomi_credit(uuid, text, boolean) to service_role;
grant execute on function public.revoke_hoshiyomi_credit_grant(text) to service_role;

-- 既存の日本円購入者にも新仕様を後方互換で付与する。
-- 既存の月次使用数は新商品のボーナスとして引き継がず、満額を付与する。
do $$
declare
  payment record;
  grant_amount integer;
  current_total integer;
  target_total integer;
begin
  for payment in
    select p.stripe_session_id, p.user_id, p.payment_kind, p.metadata,
           p.paid_at, p.created_at, u.email
      from public.payment_history p
      join public.users u on u.id = p.user_id
     where p.status = 'completed'
       and p.currency = 'jpy'
       and p.payment_kind in ('full_access', 'premium_bundle')
     order by p.paid_at asc nulls first, p.created_at asc
  loop
    target_total := case
      when payment.payment_kind = 'premium_bundle' then 30
      else 5
    end;

    select coalesce(sum(b.credits_total), 0)::integer
      into current_total
      from public.hoshiyomi_credit_balances b
      join public.users related_user on related_user.id = b.user_id
     where related_user.id = payment.user_id
        or (
          nullif(lower(trim(payment.email)), '') is not null
          and lower(trim(related_user.email)) = lower(trim(payment.email))
        );

    grant_amount := greatest(target_total - current_total, 0);
    if grant_amount > 0 then
      perform public.grant_hoshiyomi_credits(
        payment.user_id,
        'stripe:' || payment.stripe_session_id,
        grant_amount
      );
    end if;
  end loop;
end;
$$;

-- 日本版の既存完全版に「運命の設計図」も追加する。
update public.users u
   set unmei = true,
       unmei_at = coalesce(u.unmei_at, now())
 where exists (
   select 1
     from public.payment_history p
    where p.user_id = u.id
      and p.status = 'completed'
      and p.currency = 'jpy'
      and p.payment_kind in ('full_access', 'premium_bundle')
 );

insert into public.natal_readings (user_id, reading, model, generated_at)
select u.id, '{}'::jsonb, 'pending', now()
  from public.users u
 where u.unmei = true
on conflict (user_id) do nothing;
