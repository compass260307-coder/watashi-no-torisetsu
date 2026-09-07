-- LINE連携を LIFF (URLトークン) と手入力コードに分離し、明示的な連携先切替を支える。
-- コード平文は保存せず、既存どおりHMACだけを保持する。

begin;

alter table public.line_link_codes
  add column if not exists kind text not null default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'line_link_codes_kind_check'
      and conrelid = 'public.line_link_codes'::regclass
  ) then
    alter table public.line_link_codes
      add constraint line_link_codes_kind_check
      check (kind in ('liff', 'manual'));
  end if;
end;
$$;

create index if not exists idx_line_link_codes_user_kind
  on public.line_link_codes(user_id, kind, created_at desc);

-- 移行前に同一ユーザーの未使用コードが複数ある場合は最新だけを残す。
-- 以後は同時発行でも有効な同種コードが1つを超えないようDBで保証する。
delete from public.line_link_codes older
using public.line_link_codes newer
where older.user_id = newer.user_id
  and older.kind = newer.kind
  and older.consumed_at is null
  and newer.consumed_at is null
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists uq_line_link_codes_active_user_kind
  on public.line_link_codes(user_id, kind)
  where consumed_at is null;

-- LINEアカウントの連携先を切り替えた履歴。切替前の連携日時も保存する。
create table if not exists public.line_account_link_history (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  -- ユーザー削除後も切替監査を残すため、ここは意図的にFKを張らない。
  previous_user_id uuid not null,
  new_user_id uuid not null,
  previous_linked_at timestamptz,
  switched_at timestamptz not null default now(),
  source text not null,
  link_code_id uuid references public.line_link_codes(id) on delete set null,
  constraint line_account_link_history_source_check
    check (source in ('liff', 'manual'))
);

create index if not exists idx_line_account_link_history_line_user
  on public.line_account_link_history(line_user_id, switched_at desc);

alter table public.line_account_link_history enable row level security;
-- policyは作らない: service role専用。

-- コード検証・競合判定・履歴保存・コード消費・upsertを1トランザクションで行う。
-- result_status:
--   linked / already_linked / conflict / not_found / used / expired
create or replace function public.consume_line_link_code(
  p_code_hash text,
  p_kind text,
  p_line_user_id text,
  p_force boolean default false,
  p_source text default 'liff'
)
returns table (
  result_status text,
  linked_user_id uuid,
  previous_user_id uuid,
  switched boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.line_link_codes%rowtype;
  v_account public.line_accounts%rowtype;
  v_previous_user_id uuid;
  v_switched boolean := false;
  v_now timestamptz := now();
begin
  if p_kind not in ('liff', 'manual') or p_source not in ('liff', 'manual') then
    return query select 'not_found'::text, null::uuid, null::uuid, false;
    return;
  end if;

  -- 同じLINE userIdへの同時リクエストを直列化する。
  perform pg_advisory_xact_lock(hashtextextended(p_line_user_id, 0));

  select *
    into v_code
    from public.line_link_codes
   where code_hash = p_code_hash
     and kind = p_kind
   order by created_at desc
   limit 1
   for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, false;
    return;
  end if;

  select *
    into v_account
    from public.line_accounts
   where line_user_id = p_line_user_id
   for update;

  if v_code.consumed_at is not null then
    if v_code.consumed_by_line_user_id = p_line_user_id
       and v_account.user_id = v_code.user_id then
      return query select 'already_linked'::text, v_code.user_id, null::uuid, false;
    else
      return query select 'used'::text, v_code.user_id, null::uuid, false;
    end if;
    return;
  end if;

  if v_code.expires_at <= v_now then
    return query select 'expired'::text, v_code.user_id, null::uuid, false;
    return;
  end if;

  v_previous_user_id := v_account.user_id;
  v_switched := v_previous_user_id is not null
    and v_previous_user_id <> v_code.user_id;

  if v_switched and not p_force then
    return query select 'conflict'::text, v_code.user_id, v_previous_user_id, true;
    return;
  end if;

  if v_switched then
    insert into public.line_account_link_history (
      line_user_id,
      previous_user_id,
      new_user_id,
      previous_linked_at,
      source,
      link_code_id
    ) values (
      p_line_user_id,
      v_previous_user_id,
      v_code.user_id,
      v_account.linked_at,
      p_source,
      v_code.id
    );
  end if;

  insert into public.line_accounts (
    line_user_id,
    user_id,
    linked_at,
    created_at,
    updated_at
  ) values (
    p_line_user_id,
    v_code.user_id,
    v_now,
    v_now,
    v_now
  )
  on conflict (line_user_id) do update
    set user_id = excluded.user_id,
        linked_at = excluded.linked_at,
        updated_at = excluded.updated_at;

  update public.line_link_codes
     set consumed_at = v_now,
         consumed_by_line_user_id = p_line_user_id
   where id = v_code.id;

  return query
    select 'linked'::text, v_code.user_id, v_previous_user_id, v_switched;
end;
$$;

revoke all on function public.consume_line_link_code(text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.consume_line_link_code(text, text, text, boolean, text)
  to service_role;

commit;
