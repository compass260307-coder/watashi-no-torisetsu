-- Alice app Phase 1: account + immutable base profile transfer foundation.
-- Apply before deploying /api/app/v1/transfer/*.

begin;

alter table public.users
  add column if not exists diagnosis_logic_version text not null default 'web-big-five-v1',
  add column if not exists diagnosis_updated_at timestamptz;

update public.users
   set diagnosis_updated_at = coalesce(diagnosis_updated_at, created_at, now())
 where diagnosis_updated_at is null;

create or replace function public.touch_user_diagnosis_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.diagnosis_logic_version := coalesce(nullif(new.diagnosis_logic_version, ''), 'web-big-five-v1');
  new.diagnosis_updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_users_touch_diagnosis_version on public.users;
create trigger trg_users_touch_diagnosis_version
before insert or update of type_id, scores on public.users
for each row execute function public.touch_user_diagnosis_version();

create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  active_base_profile_snapshot_id uuid null,
  locale text not null default 'ja-JP',
  timezone text not null default 'Asia/Tokyo',
  guide text not null default 'alice',
  is_review_account boolean not null default false,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_locale_not_blank check (char_length(locale) between 2 and 35),
  constraint accounts_timezone_not_blank check (char_length(timezone) between 1 and 100),
  constraint accounts_guide_check check (guide in ('alice', 'harry'))
);

create unique index if not exists uq_accounts_single_review_account
  on public.accounts (is_review_account)
  where is_review_account = true;

create or replace function public.touch_alice_account_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_accounts_touch_updated_at on public.accounts;
create trigger trg_accounts_touch_updated_at
before update on public.accounts
for each row execute function public.touch_alice_account_updated_at();

create table if not exists public.base_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_user_id uuid not null,
  source_canonical_user_id_at_copy uuid not null,
  logic_version text not null,
  schema_version integer not null default 1,
  copied_at timestamptz not null default now(),
  type_id text not null,
  scores jsonb not null,
  facet_scores jsonb null,
  self_report jsonb null,
  perceived_report jsonb null,
  friend_view_base jsonb null,
  source_updated_at timestamptz null,
  superseded_by_snapshot_id uuid null references public.base_profile_snapshots(id) on delete set null,
  constraint base_profile_snapshots_schema_version_positive check (schema_version > 0)
);

create index if not exists idx_base_profile_snapshots_account_copied
  on public.base_profile_snapshots(account_id, copied_at desc);

do $$
begin
  alter table public.accounts
    add constraint accounts_active_snapshot_fk
    foreign key (active_base_profile_snapshot_id)
    references public.base_profile_snapshots(id)
    on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.app_transfer_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  source_user_id uuid not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  consumed_by_account_id uuid null references public.accounts(id) on delete set null,
  claim_ticket_hash text null,
  claim_ticket_expires_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_transfer_codes_source_active
  on public.app_transfer_codes(source_user_id, expires_at desc)
  where consumed_at is null;

create unique index if not exists uq_app_transfer_codes_claim_ticket_hash
  on public.app_transfer_codes(claim_ticket_hash)
  where claim_ticket_hash is not null;

create table if not exists public.account_diagnosis_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_user_id uuid not null,
  linked_at timestamptz not null default now(),
  linked_via_transfer_code_id uuid null references public.app_transfer_codes(id) on delete set null,
  base_profile_snapshot_id uuid not null references public.base_profile_snapshots(id) on delete restrict,
  constraint account_diagnosis_links_account_source_unique unique (account_id, source_user_id)
);

create index if not exists idx_account_diagnosis_links_account
  on public.account_diagnosis_links(account_id, linked_at desc);

alter table public.accounts enable row level security;
alter table public.base_profile_snapshots enable row level security;
alter table public.account_diagnosis_links enable row level security;
alter table public.app_transfer_codes enable row level security;

drop policy if exists "account owner can read account" on public.accounts;
create policy "account owner can read account"
  on public.accounts for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "account owner can update safe preferences" on public.accounts;
create policy "account owner can update safe preferences"
  on public.accounts for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "account owner can read snapshots" on public.base_profile_snapshots;
create policy "account owner can read snapshots"
  on public.base_profile_snapshots for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can read diagnosis links" on public.account_diagnosis_links;
create policy "account owner can read diagnosis links"
  on public.account_diagnosis_links for select to authenticated
  using ((select auth.uid()) = account_id);

grant select on public.accounts, public.base_profile_snapshots, public.account_diagnosis_links
  to authenticated;
grant update (locale, timezone, guide) on public.accounts to authenticated;

revoke all on public.app_transfer_codes from anon, authenticated;

create or replace function public.consume_alice_transfer(
  p_claim_ticket_hash text,
  p_account_id uuid,
  p_locale text default 'ja-JP',
  p_timezone text default 'Asia/Tokyo',
  p_guide text default 'alice'
)
returns table(active_snapshot_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_code public.app_transfer_codes%rowtype;
  v_source_user_id uuid;
  v_canonical_user_id uuid;
  v_merged_into uuid;
  v_type_id text;
  v_scores jsonb;
  v_source_updated_at timestamptz;
  v_logic_version text;
  v_snapshot_id uuid;
  v_existing_snapshot_id uuid;
  v_friend_count integer;
  v_friend_scores jsonb;
  v_seen uuid[] := array[]::uuid[];
  v_hops integer := 0;
begin
  if p_guide not in ('alice', 'harry') then
    raise exception using errcode = 'P0001', message = 'invalid_guide';
  end if;

  select *
    into v_code
    from public.app_transfer_codes
   where claim_ticket_hash = p_claim_ticket_hash
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_claim_ticket';
  end if;

  if v_code.consumed_at is not null then
    if v_code.consumed_by_account_id = p_account_id then
      select l.base_profile_snapshot_id
        into v_existing_snapshot_id
        from public.account_diagnosis_links l
       where l.account_id = p_account_id
         and l.source_user_id = v_code.source_user_id;
      if v_existing_snapshot_id is not null then
        return query select v_existing_snapshot_id;
        return;
      end if;
    end if;
    raise exception using errcode = 'P0001', message = 'claim_ticket_already_used';
  end if;

  if v_code.expires_at <= now()
     or v_code.claim_ticket_expires_at is null
     or v_code.claim_ticket_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'claim_ticket_expired';
  end if;

  v_source_user_id := v_code.source_user_id;
  v_canonical_user_id := v_source_user_id;

  loop
    if v_canonical_user_id = any(v_seen) or v_hops >= 8 then
      raise exception using errcode = 'P0001', message = 'source_merge_chain_invalid';
    end if;
    v_seen := array_append(v_seen, v_canonical_user_id);

    select u.merged_into,
           u.type_id,
           u.scores,
           coalesce(u.diagnosis_updated_at, u.created_at),
           u.diagnosis_logic_version
      into v_merged_into, v_type_id, v_scores, v_source_updated_at, v_logic_version
      from public.users u
     where u.id = v_canonical_user_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'source_diagnosis_not_found';
    end if;

    exit when v_merged_into is null;
    v_canonical_user_id := v_merged_into;
    v_hops := v_hops + 1;
  end loop;

  insert into public.accounts (id, locale, timezone, guide)
  values (
    p_account_id,
    coalesce(nullif(p_locale, ''), 'ja-JP'),
    coalesce(nullif(p_timezone, ''), 'Asia/Tokyo'),
    p_guide
  )
  on conflict (id) do update
    set locale = excluded.locale,
        timezone = excluded.timezone,
        guide = excluded.guide,
        updated_at = now();

  select l.base_profile_snapshot_id
    into v_existing_snapshot_id
    from public.account_diagnosis_links l
   where l.account_id = p_account_id
     and l.source_user_id = v_source_user_id;

  if v_existing_snapshot_id is not null then
    update public.accounts
       set active_base_profile_snapshot_id = v_existing_snapshot_id,
           updated_at = now()
     where id = p_account_id;

    update public.app_transfer_codes
       set consumed_at = now(), consumed_by_account_id = p_account_id
     where id = v_code.id;

    return query select v_existing_snapshot_id;
    return;
  end if;

  select count(*)::integer,
         jsonb_strip_nulls(jsonb_build_object(
           'E', avg(case when jsonb_typeof(fp.perceived_scores -> 'E') = 'number' then (fp.perceived_scores ->> 'E')::numeric end),
           'A', avg(case when jsonb_typeof(fp.perceived_scores -> 'A') = 'number' then (fp.perceived_scores ->> 'A')::numeric end),
           'O', avg(case when jsonb_typeof(fp.perceived_scores -> 'O') = 'number' then (fp.perceived_scores ->> 'O')::numeric end),
           'C', avg(case when jsonb_typeof(fp.perceived_scores -> 'C') = 'number' then (fp.perceived_scores ->> 'C')::numeric end),
           'N', avg(case when jsonb_typeof(fp.perceived_scores -> 'N') = 'number' then (fp.perceived_scores ->> 'N')::numeric end)
         ))
    into v_friend_count, v_friend_scores
    from public.friend_perceptions fp
   where fp.target_user_id = v_canonical_user_id;

  insert into public.base_profile_snapshots (
    account_id,
    source_user_id,
    source_canonical_user_id_at_copy,
    logic_version,
    schema_version,
    type_id,
    scores,
    facet_scores,
    self_report,
    perceived_report,
    friend_view_base,
    source_updated_at
  ) values (
    p_account_id,
    v_source_user_id,
    v_canonical_user_id,
    coalesce(v_logic_version, 'web-big-five-v1'),
    1,
    v_type_id,
    v_scores,
    v_scores -> 'facetScores',
    jsonb_strip_nulls(jsonb_build_object(
      'fullCode', v_scores -> 'fullCode',
      'modifierLabel', v_scores -> 'modifierLabel'
    )),
    null,
    case when v_friend_count > 0 then jsonb_build_object(
      'responseCount', v_friend_count,
      'scores', coalesce(v_friend_scores, '{}'::jsonb),
      'summary', null
    ) else null end,
    v_source_updated_at
  )
  returning id into v_snapshot_id;

  insert into public.account_diagnosis_links (
    account_id,
    source_user_id,
    linked_via_transfer_code_id,
    base_profile_snapshot_id
  ) values (
    p_account_id,
    v_source_user_id,
    v_code.id,
    v_snapshot_id
  );

  update public.accounts
     set active_base_profile_snapshot_id = v_snapshot_id,
         updated_at = now()
   where id = p_account_id;

  update public.app_transfer_codes
     set consumed_at = now(), consumed_by_account_id = p_account_id
   where id = v_code.id;

  return query select v_snapshot_id;
end;
$$;

revoke all on function public.consume_alice_transfer(text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_alice_transfer(text, uuid, text, text, text)
  to service_role;

commit;
