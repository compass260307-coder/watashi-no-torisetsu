-- Restore the Alice app Phase 1-3 schema from the legacy migrations whose
-- filenames are not recognized by the Supabase CLI. Keep this as one transaction.

begin;

-- Alice app Phase 1: account + immutable base profile transfer foundation.
-- Apply before deploying /api/app/v1/transfer/*.


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

-- Alice app Phase 2: personal 7-day cycles, daily Big Five check-ins, and journal.
-- Requires 2026-08-28-alice-phase1-transfer-foundation.sql.


create table if not exists public.weekly_cycles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_number integer not null,
  status text not null default 'active',
  timezone_at_start text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  day_start_at timestamptz[] not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz null,
  constraint weekly_cycles_number_positive check (cycle_number > 0),
  constraint weekly_cycles_status_check check (status in ('active', 'completed')),
  constraint weekly_cycles_time_order check (starts_at < ends_at),
  constraint weekly_cycles_eight_boundaries check (cardinality(day_start_at) = 8),
  constraint weekly_cycles_account_number_unique unique (account_id, cycle_number)
);

create index if not exists idx_weekly_cycles_account_window
  on public.weekly_cycles(account_id, starts_at desc, ends_at desc);

create unique index if not exists uq_weekly_cycles_one_active
  on public.weekly_cycles(account_id)
  where status = 'active';

create table if not exists public.daily_question_bank (
  question_id integer primary key,
  facet_id text not null,
  dimension text not null,
  reversed boolean not null,
  question_logic_version text not null,
  active_from timestamptz not null default now(),
  active_to timestamptz null,
  constraint daily_question_bank_facet_check check (facet_id in (
    'E_assertiveness', 'E_warmth', 'A_cooperation', 'A_sympathy',
    'O_adventurousness', 'O_imagination', 'C_achievement', 'C_orderliness',
    'N_volatility', 'N_anxiety'
  )),
  constraint daily_question_bank_dimension_check check (dimension in ('E', 'A', 'O', 'C', 'N')),
  constraint daily_question_bank_active_window check (active_to is null or active_to > active_from)
);

create table if not exists public.daily_question_texts (
  question_id integer not null references public.daily_question_bank(question_id) on delete cascade,
  locale text not null,
  text text not null,
  primary key (question_id, locale),
  constraint daily_question_text_not_blank check (char_length(text) between 1 and 500)
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles(id) on delete cascade,
  cycle_day integer not null,
  local_date date not null,
  mood text null,
  status text not null default 'in_progress',
  question_ids integer[] not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint daily_checkins_cycle_day_check check (cycle_day between 1 and 7),
  constraint daily_checkins_mood_check check (mood is null or mood in ('clear', 'calm', 'mixed', 'hard')),
  constraint daily_checkins_status_check check (status in ('in_progress', 'completed')),
  constraint daily_checkins_ten_questions check (cardinality(question_ids) = 10),
  constraint daily_checkins_account_cycle_day_unique unique (account_id, cycle_id, cycle_day)
);

create index if not exists idx_daily_checkins_account_started
  on public.daily_checkins(account_id, started_at desc);

create table if not exists public.daily_answers (
  checkin_id uuid not null references public.daily_checkins(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  question_id integer not null references public.daily_question_bank(question_id) on delete restrict,
  facet_id text not null,
  dimension text not null,
  reversed boolean not null,
  answer smallint not null,
  normalized_score numeric(7,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (checkin_id, question_id),
  constraint daily_answers_value_check check (answer between 1 and 7),
  constraint daily_answers_normalized_check check (normalized_score between 0 and 10)
);

create index if not exists idx_daily_answers_account_created
  on public.daily_answers(account_id, created_at desc);

create table if not exists public.daily_results (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles(id) on delete cascade,
  checkin_id uuid not null unique references public.daily_checkins(id) on delete cascade,
  local_date date not null,
  timezone_at_completion text not null,
  facet_scores jsonb not null,
  dimension_scores jsonb not null,
  boundary_distances jsonb not null,
  minimum_boundary_distance numeric(7,4) not null,
  thirty_two_type_id text not null,
  question_set_version text not null,
  scoring_version text not null,
  classification_version text not null,
  completed_at timestamptz not null default now()
);

create index if not exists idx_daily_results_account_date
  on public.daily_results(account_id, local_date desc);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles(id) on delete cascade,
  checkin_id uuid null unique references public.daily_checkins(id) on delete cascade,
  local_date date not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_body_length check (char_length(body) between 1 and 5000)
);

create index if not exists idx_journal_entries_account_date
  on public.journal_entries(account_id, local_date desc);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles(id) on delete cascade,
  report_state text not null,
  thirty_two_type_id text null,
  dimension_scores jsonb not null,
  boundary_distances jsonb not null,
  minimum_boundary_distance numeric(7,4) not null,
  stability_score numeric(7,4) null,
  answered_days integer not null,
  answer_count integer not null,
  question_set_version text not null,
  scoring_version text not null,
  classification_version text not null,
  stability_logic_version text null,
  base_profile_snapshot_id uuid not null references public.base_profile_snapshots(id) on delete restrict,
  generated_at timestamptz not null default now(),
  constraint weekly_reports_state_check check (report_state in ('tendency', 'confirmed')),
  constraint weekly_reports_answered_days_check check (answered_days between 0 and 7),
  constraint weekly_reports_account_cycle_unique unique (account_id, cycle_id)
);

insert into public.daily_question_bank (
  question_id, facet_id, dimension, reversed, question_logic_version
) values
  (1, 'E_assertiveness', 'E', false, 'web-big-five-v1'),
  (2, 'E_assertiveness', 'E', false, 'web-big-five-v1'),
  (3, 'E_assertiveness', 'E', true, 'web-big-five-v1'),
  (4, 'E_assertiveness', 'E', false, 'web-big-five-v1'),
  (5, 'E_assertiveness', 'E', true, 'web-big-five-v1'),
  (6, 'E_warmth', 'E', false, 'web-big-five-v1'),
  (7, 'E_warmth', 'E', false, 'web-big-five-v1'),
  (8, 'E_warmth', 'E', true, 'web-big-five-v1'),
  (9, 'E_warmth', 'E', false, 'web-big-five-v1'),
  (10, 'E_warmth', 'E', true, 'web-big-five-v1'),
  (11, 'A_cooperation', 'A', false, 'web-big-five-v1'),
  (12, 'A_cooperation', 'A', false, 'web-big-five-v1'),
  (13, 'A_cooperation', 'A', true, 'web-big-five-v1'),
  (14, 'A_cooperation', 'A', false, 'web-big-five-v1'),
  (15, 'A_cooperation', 'A', true, 'web-big-five-v1'),
  (16, 'A_sympathy', 'A', false, 'web-big-five-v1'),
  (17, 'A_sympathy', 'A', false, 'web-big-five-v1'),
  (18, 'A_sympathy', 'A', true, 'web-big-five-v1'),
  (19, 'A_sympathy', 'A', false, 'web-big-five-v1'),
  (20, 'A_sympathy', 'A', true, 'web-big-five-v1'),
  (21, 'O_adventurousness', 'O', false, 'web-big-five-v1'),
  (22, 'O_adventurousness', 'O', false, 'web-big-five-v1'),
  (23, 'O_adventurousness', 'O', true, 'web-big-five-v1'),
  (24, 'O_adventurousness', 'O', false, 'web-big-five-v1'),
  (25, 'O_adventurousness', 'O', true, 'web-big-five-v1'),
  (26, 'O_imagination', 'O', false, 'web-big-five-v1'),
  (27, 'O_imagination', 'O', false, 'web-big-five-v1'),
  (28, 'O_imagination', 'O', true, 'web-big-five-v1'),
  (29, 'O_imagination', 'O', false, 'web-big-five-v1'),
  (30, 'O_imagination', 'O', true, 'web-big-five-v1'),
  (31, 'C_achievement', 'C', false, 'web-big-five-v1'),
  (32, 'C_achievement', 'C', false, 'web-big-five-v1'),
  (33, 'C_achievement', 'C', true, 'web-big-five-v1'),
  (34, 'C_achievement', 'C', false, 'web-big-five-v1'),
  (35, 'C_achievement', 'C', true, 'web-big-five-v1'),
  (36, 'C_orderliness', 'C', false, 'web-big-five-v1'),
  (37, 'C_orderliness', 'C', false, 'web-big-five-v1'),
  (38, 'C_orderliness', 'C', true, 'web-big-five-v1'),
  (39, 'C_orderliness', 'C', false, 'web-big-five-v1'),
  (40, 'C_orderliness', 'C', true, 'web-big-five-v1'),
  (41, 'N_volatility', 'N', false, 'web-big-five-v1'),
  (42, 'N_volatility', 'N', false, 'web-big-five-v1'),
  (43, 'N_volatility', 'N', true, 'web-big-five-v1'),
  (44, 'N_volatility', 'N', false, 'web-big-five-v1'),
  (45, 'N_volatility', 'N', true, 'web-big-five-v1'),
  (46, 'N_anxiety', 'N', false, 'web-big-five-v1'),
  (47, 'N_anxiety', 'N', false, 'web-big-five-v1'),
  (48, 'N_anxiety', 'N', true, 'web-big-five-v1'),
  (49, 'N_anxiety', 'N', false, 'web-big-five-v1'),
  (50, 'N_anxiety', 'N', true, 'web-big-five-v1')
on conflict (question_id) do update
  set facet_id = excluded.facet_id,
      dimension = excluded.dimension,
      reversed = excluded.reversed,
      question_logic_version = excluded.question_logic_version;

insert into public.daily_question_texts (question_id, locale, text) values
  (1, 'ja-JP', 'グループで意見が割れたとき、自分の考えをはっきり伝える方だ。'),
  (2, 'ja-JP', 'みんなで「どこ行く？」となったら、自分から候補を出す。'),
  (3, 'ja-JP', '言いたいことがあっても、空気を読んで飲み込むことが多い。'),
  (4, 'ja-JP', '違うと思ったら、相手が誰でも「いや、それは」と言える。'),
  (5, 'ja-JP', '大勢の前で発表とか、できれば避けたいタイプだ。'),
  (6, 'ja-JP', '初対面の人とでも、わりとすぐ仲良くなれる。'),
  (7, 'ja-JP', '友達が元気なさそうだと、こっちから話しかけにいく。'),
  (8, 'ja-JP', '知らない人と話すのは、できれば避けたい。'),
  (9, 'ja-JP', '人と話してると、自然と笑顔になっている。'),
  (10, 'ja-JP', '自分から人に深入りすることは少ない方だ。'),
  (11, 'ja-JP', 'グループ作業では、自分の意見より全体の流れを優先する。'),
  (12, 'ja-JP', '友達と意見が違っても、結局相手に合わせることが多い。'),
  (13, 'ja-JP', '自分のやり方を曲げてまで、人に合わせたくない。'),
  (14, 'ja-JP', 'みんなが楽しめるなら、自分が我慢するのは平気だ。'),
  (15, 'ja-JP', '「自分の意見を通したい」と思うことがよくある。'),
  (16, 'ja-JP', '友達が泣いてると、つられて泣きそうになる。'),
  (17, 'ja-JP', '映画や漫画で、登場人物の気持ちに入り込みやすい。'),
  (18, 'ja-JP', '人の感情の起伏には、わりと無関心なほうだ。'),
  (19, 'ja-JP', '友達の表情が少し変わるだけで、何かあったか気になる。'),
  (20, 'ja-JP', '「気持ちを察してほしい」と言われても、よく分からない。'),
  (21, 'ja-JP', '「行ったことない店」と聞くと、つい行きたくなる。'),
  (22, 'ja-JP', '旅行先では、定番より地元の人しか知らない場所を選ぶ。'),
  (23, 'ja-JP', '新しい場所より、慣れた場所のほうが落ち着く。'),
  (24, 'ja-JP', '「やったことないこと」に誘われると、わりと乗る。'),
  (25, 'ja-JP', '初めての経験には、つい慎重になってしまう。'),
  (26, 'ja-JP', 'ぼーっとしてる時、頭の中で勝手にストーリーが浮かぶ。'),
  (27, 'ja-JP', '同じ景色を見ても、人より色々考えてる気がする。'),
  (28, 'ja-JP', '空想や妄想にふけることは、ほとんどない。'),
  (29, 'ja-JP', '「もし○○だったら」を想像するのが好きだ。'),
  (30, 'ja-JP', '現実的なことだけ考えていたいタイプだ。'),
  (31, 'ja-JP', '「これをやり遂げたい」という目標が、いつも頭にある。'),
  (32, 'ja-JP', 'テストや課題で、平均より上を目指すタイプだ。'),
  (33, 'ja-JP', '「のんびり過ごす」が一番の幸せだと思う。'),
  (34, 'ja-JP', '自分なりの目標を立てて、それに向かって動くほうだ。'),
  (35, 'ja-JP', '特に目標がなくても、毎日それなりに楽しい。'),
  (36, 'ja-JP', '机の上やカバンの中は、わりと整理されている。'),
  (37, 'ja-JP', '予定はスケジュール帳やアプリでちゃんと管理する。'),
  (38, 'ja-JP', '部屋が散らかっていても、あまり気にならない。'),
  (39, 'ja-JP', '何かを始める前に、まず段取りを考えるほうだ。'),
  (40, 'ja-JP', '「あとで片付ければいい」とつい放置してしまう。'),
  (41, 'ja-JP', 'イラっとしたら、つい顔や態度に出てしまう。'),
  (42, 'ja-JP', '嫌なことがあると、しばらく機嫌が直らない方だ。'),
  (43, 'ja-JP', '感情が乱れても、表に出さないほうだ。'),
  (44, 'ja-JP', '友達と喧嘩したとき、感情が抑えられなくなる。'),
  (45, 'ja-JP', 'どんな時でも、わりと冷静でいられる。'),
  (46, 'ja-JP', '寝る前、つい今日のことを思い出して考え込む。'),
  (47, 'ja-JP', 'テストや発表の前は、何度も確認しないと不安だ。'),
  (48, 'ja-JP', '先のことを心配することは、あまりない。'),
  (49, 'ja-JP', '「あの言い方、大丈夫だったかな」とよく振り返る。'),
  (50, 'ja-JP', '何か起きてから対処すればいい、と思える方だ。')
on conflict (question_id, locale) do update set text = excluded.text;

create or replace function public.start_alice_daily(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account public.accounts%rowtype;
  v_cycle public.weekly_cycles%rowtype;
  v_last_cycle public.weekly_cycles%rowtype;
  v_checkin public.daily_checkins%rowtype;
  v_timezone text;
  v_anchor_at timestamptz;
  v_anchor_cycle_number integer;
  v_first_end_at timestamptz;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_start_date date;
  v_first_end_date date;
  v_skip_cycles integer;
  v_cycle_number integer;
  v_day_starts timestamptz[] := array[]::timestamptz[];
  v_cycle_day integer := 1;
  v_question_ids integer[] := array[]::integer[];
  v_facets text[] := array[
    'E_assertiveness', 'E_warmth', 'A_cooperation', 'A_sympathy',
    'O_adventurousness', 'O_imagination', 'C_achievement', 'C_orderliness',
    'N_volatility', 'N_anxiety'
  ];
  v_facet text;
  v_question_count integer;
  v_question_offset integer;
  v_question_id integer;
  v_questions jsonb;
  v_result jsonb;
  v_completed_days integer;
  i integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));

  select *
    into v_account
    from public.accounts
   where id = p_account_id
   for update;

  if not found or v_account.active_base_profile_snapshot_id is null then
    raise exception using errcode = 'P0001', message = 'account_not_linked';
  end if;

  select *
    into v_cycle
    from public.weekly_cycles
   where account_id = p_account_id
     and starts_at <= now()
     and ends_at > now()
   order by cycle_number desc
   limit 1;

  if not found then
    update public.weekly_cycles
       set status = 'completed',
           closed_at = coalesce(closed_at, now())
     where account_id = p_account_id
       and status = 'active'
       and ends_at <= now();

    select *
      into v_last_cycle
      from public.weekly_cycles
     where account_id = p_account_id
     order by cycle_number desc
     limit 1;

    if found then
      v_anchor_at := v_last_cycle.ends_at;
      v_anchor_cycle_number := v_last_cycle.cycle_number + 1;
    else
      v_anchor_at := v_account.registered_at;
      v_anchor_cycle_number := 1;
    end if;

    v_timezone := v_account.timezone;
    if not exists (select 1 from pg_timezone_names where name = v_timezone) then
      v_timezone := 'Asia/Tokyo';
    end if;

    v_first_end_date := (v_anchor_at at time zone v_timezone)::date + 7;
    v_first_end_at := v_first_end_date::timestamp at time zone v_timezone;

    if now() < v_first_end_at then
      v_cycle_number := v_anchor_cycle_number;
      v_starts_at := v_anchor_at;
      v_ends_at := v_first_end_at;
    else
      v_skip_cycles := greatest(
        0,
        floor(
          ((now() at time zone v_timezone)::date - v_first_end_date)::numeric / 7
        )::integer
      );
      v_cycle_number := v_anchor_cycle_number + 1 + v_skip_cycles;
      v_start_date := v_first_end_date + (v_skip_cycles * 7);
      v_starts_at := v_start_date::timestamp at time zone v_timezone;
      v_ends_at := (v_start_date + 7)::timestamp at time zone v_timezone;
    end if;

    v_day_starts := array[v_starts_at];
    v_start_date := (v_starts_at at time zone v_timezone)::date;
    for i in 1..7 loop
      v_day_starts := array_append(
        v_day_starts,
        (v_start_date + i)::timestamp at time zone v_timezone
      );
    end loop;

    insert into public.weekly_cycles (
      account_id,
      cycle_number,
      status,
      timezone_at_start,
      starts_at,
      ends_at,
      day_start_at
    ) values (
      p_account_id,
      v_cycle_number,
      'active',
      v_timezone,
      v_starts_at,
      v_ends_at,
      v_day_starts
    )
    on conflict (account_id, cycle_number) do update
      set status = case
            when public.weekly_cycles.ends_at > now() then 'active'
            else public.weekly_cycles.status
          end
    returning * into v_cycle;
  end if;

  for i in 1..7 loop
    if now() >= v_cycle.day_start_at[i]
       and now() < v_cycle.day_start_at[i + 1] then
      v_cycle_day := i;
      exit;
    end if;
  end loop;

  foreach v_facet in array v_facets loop
    select count(*)::integer
      into v_question_count
      from public.daily_question_bank
     where facet_id = v_facet
       and active_from <= now()
       and (active_to is null or active_to > now());

    if v_question_count = 0 then
      raise exception using errcode = 'P0001', message = 'daily_question_bank_incomplete';
    end if;

    v_question_offset := (
      mod(
        mod(
          hashtextextended(
            p_account_id::text || ':' || v_cycle.id::text || ':' || v_facet,
            0
          )::numeric,
          v_question_count
        ) + v_question_count,
        v_question_count
      )::integer + v_cycle_day - 1
    ) % v_question_count;

    select question_id
      into v_question_id
      from public.daily_question_bank
     where facet_id = v_facet
       and active_from <= now()
       and (active_to is null or active_to > now())
     order by question_id
     offset v_question_offset
     limit 1;

    v_question_ids := array_append(v_question_ids, v_question_id);
  end loop;

  insert into public.daily_checkins (
    account_id,
    cycle_id,
    cycle_day,
    local_date,
    question_ids
  ) values (
    p_account_id,
    v_cycle.id,
    v_cycle_day,
    (now() at time zone v_cycle.timezone_at_start)::date,
    v_question_ids
  )
  on conflict (account_id, cycle_id, cycle_day) do update
    set updated_at = now()
  returning * into v_checkin;

  select jsonb_agg(
           jsonb_build_object(
             'question_id', bank.question_id,
             'facet_id', bank.facet_id,
             'dimension', bank.dimension,
             'text', coalesce(local_text.text, ja_text.text),
             'logic_version', bank.question_logic_version
           )
           order by array_position(v_checkin.question_ids, bank.question_id)
         )
    into v_questions
    from public.daily_question_bank bank
    left join public.daily_question_texts local_text
      on local_text.question_id = bank.question_id
     and local_text.locale = v_account.locale
    left join public.daily_question_texts ja_text
      on ja_text.question_id = bank.question_id
     and ja_text.locale = 'ja-JP'
   where bank.question_id = any(v_checkin.question_ids);

  select jsonb_build_object(
           'daily_result_id', id,
           'thirty_two_type_id', thirty_two_type_id,
           'dimension_scores', dimension_scores,
           'minimum_boundary_distance', minimum_boundary_distance,
           'completed_at', completed_at
         )
    into v_result
    from public.daily_results
   where checkin_id = v_checkin.id;

  select count(*)::integer
    into v_completed_days
    from public.daily_checkins
   where account_id = p_account_id
     and cycle_id = v_cycle.id
     and status = 'completed';

  return jsonb_build_object(
    'checkin', jsonb_build_object(
      'id', v_checkin.id,
      'status', v_checkin.status,
      'mood', v_checkin.mood,
      'local_date', v_checkin.local_date,
      'started_at', v_checkin.started_at,
      'completed_at', v_checkin.completed_at
    ),
    'cycle', jsonb_build_object(
      'id', v_cycle.id,
      'cycle_number', v_cycle.cycle_number,
      'day_number', v_cycle_day,
      'completed_days', v_completed_days,
      'starts_at', v_cycle.starts_at,
      'ends_at', v_cycle.ends_at,
      'timezone', v_cycle.timezone_at_start
    ),
    'questions', coalesce(v_questions, '[]'::jsonb),
    'result', v_result
  );
end;
$$;

create or replace function public.prepare_alice_daily_answer()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  v_checkin public.daily_checkins%rowtype;
  v_question public.daily_question_bank%rowtype;
  v_corrected numeric;
begin
  if tg_op = 'UPDATE'
     and (new.checkin_id <> old.checkin_id or new.question_id <> old.question_id) then
    raise exception using errcode = 'P0001', message = 'daily_answer_identity_locked';
  end if;

  select *
    into v_checkin
    from public.daily_checkins
   where id = new.checkin_id;

  if not found
     or v_checkin.status <> 'in_progress'
     or not (new.question_id = any(v_checkin.question_ids)) then
    raise exception using errcode = 'P0001', message = 'daily_answer_not_allowed';
  end if;

  select *
    into v_question
    from public.daily_question_bank
   where question_id = new.question_id;

  if not found or new.answer not between 1 and 7 then
    raise exception using errcode = 'P0001', message = 'daily_answer_invalid';
  end if;

  v_corrected := case when v_question.reversed then 8 - new.answer else new.answer end;
  new.account_id := v_checkin.account_id;
  new.facet_id := v_question.facet_id;
  new.dimension := v_question.dimension;
  new.reversed := v_question.reversed;
  new.normalized_score := round(((v_corrected - 1) / 6) * 10, 4);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_daily_answers_prepare on public.daily_answers;
create trigger trg_daily_answers_prepare
before insert or update on public.daily_answers
for each row execute function public.prepare_alice_daily_answer();

create or replace function public.complete_alice_daily(
  p_account_id uuid,
  p_checkin_id uuid,
  p_mood text,
  p_answers jsonb,
  p_journal_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account public.accounts%rowtype;
  v_checkin public.daily_checkins%rowtype;
  v_cycle public.weekly_cycles%rowtype;
  v_existing_result public.daily_results%rowtype;
  v_result public.daily_results%rowtype;
  v_answer_count integer;
  v_distinct_count integer;
  v_invalid_count integer;
  v_facet_count integer;
  v_dimension_count integer;
  v_facet_scores jsonb;
  v_dimension_scores jsonb;
  v_boundary_distances jsonb;
  v_minimum_distance numeric;
  v_question_set_version text;
  v_type_key text;
  v_base_type text;
  v_type_id text;
  v_completed_days integer;
  v_journal text;
begin
  if p_mood not in ('clear', 'calm', 'mixed', 'hard') then
    raise exception using errcode = 'P0001', message = 'daily_mood_invalid';
  end if;

  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 10 then
    raise exception using errcode = 'P0001', message = 'daily_answers_incomplete';
  end if;

  select *
    into v_account
    from public.accounts
   where id = p_account_id;

  if not found or v_account.active_base_profile_snapshot_id is null then
    raise exception using errcode = 'P0001', message = 'account_not_linked';
  end if;

  select *
    into v_checkin
    from public.daily_checkins
   where id = p_checkin_id
     and account_id = p_account_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'daily_checkin_not_found';
  end if;

  if v_checkin.status = 'completed' then
    select *
      into v_existing_result
      from public.daily_results
     where checkin_id = v_checkin.id;

    if not found then
      raise exception using errcode = 'P0001', message = 'daily_result_missing';
    end if;

    select count(*)::integer
      into v_completed_days
      from public.daily_checkins
     where account_id = p_account_id
       and cycle_id = v_checkin.cycle_id
       and status = 'completed';

    return jsonb_build_object(
      'checkin_id', v_checkin.id,
      'status', 'completed',
      'cycle_id', v_checkin.cycle_id,
      'cycle_day', v_checkin.cycle_day,
      'completed_days', v_completed_days,
      'result', jsonb_build_object(
        'daily_result_id', v_existing_result.id,
        'thirty_two_type_id', v_existing_result.thirty_two_type_id,
        'dimension_scores', v_existing_result.dimension_scores,
        'minimum_boundary_distance', v_existing_result.minimum_boundary_distance,
        'completed_at', v_existing_result.completed_at
      )
    );
  end if;

  select count(*)::integer,
         count(distinct answer.question_id)::integer,
         count(*) filter (
           where answer.question_id is null
              or answer.value is null
              or answer.value not between 1 and 7
              or not (answer.question_id = any(v_checkin.question_ids))
         )::integer
    into v_answer_count, v_distinct_count, v_invalid_count
    from jsonb_to_recordset(p_answers) as answer(question_id integer, value integer);

  if v_answer_count <> 10 or v_distinct_count <> 10 or v_invalid_count <> 0 then
    raise exception using errcode = 'P0001', message = 'daily_answers_invalid';
  end if;

  insert into public.daily_answers (
    checkin_id,
    account_id,
    question_id,
    facet_id,
    dimension,
    reversed,
    answer,
    normalized_score
  )
  select v_checkin.id,
         p_account_id,
         answer.question_id,
         bank.facet_id,
         bank.dimension,
         bank.reversed,
         answer.value,
         0
    from jsonb_to_recordset(p_answers) as answer(question_id integer, value integer)
    join public.daily_question_bank bank on bank.question_id = answer.question_id
  on conflict (checkin_id, question_id) do update
    set answer = excluded.answer,
        updated_at = now();

  select count(distinct facet_id)::integer,
         jsonb_object_agg(facet_id, score order by facet_id)
    into v_facet_count, v_facet_scores
    from (
      select facet_id, round(avg(normalized_score), 4) as score
        from public.daily_answers
       where checkin_id = v_checkin.id
       group by facet_id
    ) facet_aggregate;

  select count(*)::integer,
         jsonb_object_agg(dimension, score order by dimension)
    into v_dimension_count, v_dimension_scores
    from (
      select dimension, round(avg(normalized_score), 4) as score
        from public.daily_answers
       where checkin_id = v_checkin.id
       group by dimension
    ) dimension_aggregate;

  if v_facet_count <> 10 or v_dimension_count <> 5 then
    raise exception using errcode = 'P0001', message = 'daily_scoring_incomplete';
  end if;

  v_boundary_distances := jsonb_build_object(
    'E', round(abs((v_dimension_scores ->> 'E')::numeric - 5) / 5, 4),
    'A', round(abs((v_dimension_scores ->> 'A')::numeric - 5) / 5, 4),
    'O', round(abs((v_dimension_scores ->> 'O')::numeric - 5) / 5, 4),
    'C', round(abs((v_dimension_scores ->> 'C')::numeric - 5) / 5, 4),
    'N', round(abs((v_dimension_scores ->> 'N')::numeric - 5) / 5, 4)
  );
  v_minimum_distance := least(
    (v_boundary_distances ->> 'E')::numeric,
    (v_boundary_distances ->> 'A')::numeric,
    (v_boundary_distances ->> 'O')::numeric,
    (v_boundary_distances ->> 'C')::numeric,
    (v_boundary_distances ->> 'N')::numeric
  );

  v_type_key :=
    case when (v_dimension_scores ->> 'O')::numeric >= 5 then '+' else '-' end ||
    case when (v_dimension_scores ->> 'C')::numeric >= 5 then '+' else '-' end ||
    case when (v_dimension_scores ->> 'E')::numeric >= 5 then '+' else '-' end ||
    case when (v_dimension_scores ->> 'A')::numeric >= 5 then '+' else '-' end;

  v_base_type := case v_type_key
    when '++++' then 'sparkle-dolphin'
    when '+++-' then 'ambition-lion'
    when '++-+' then 'quiet-owl'
    when '++--' then 'seeker-wolf'
    when '+-++' then 'idea-monkey'
    when '+-+-' then 'whim-fox'
    when '+--+' then 'dreamer-rabbit'
    when '+---' then 'fantasy-cat'
    when '-+++' then 'caretaker-dog'
    when '-++-' then 'brisk-tiger'
    when '-+-+' then 'earnest-elephant'
    when '-+--' then 'steady-turtle'
    when '--++' then 'smiley-panda'
    when '--+-' then 'playful-raccoon'
    when '---+' then 'gentle-koala'
    else 'solo-hedgehog'
  end;
  v_type_id := v_base_type || case
    when (v_dimension_scores ->> 'N')::numeric >= 5 then '__N'
    else '__R'
  end;

  select string_agg(
           distinct bank.question_logic_version,
           ',' order by bank.question_logic_version
         )
    into v_question_set_version
    from public.daily_question_bank bank
   where bank.question_id = any(v_checkin.question_ids);

  select *
    into v_cycle
    from public.weekly_cycles
   where id = v_checkin.cycle_id;

  insert into public.daily_results (
    account_id,
    cycle_id,
    checkin_id,
    local_date,
    timezone_at_completion,
    facet_scores,
    dimension_scores,
    boundary_distances,
    minimum_boundary_distance,
    thirty_two_type_id,
    question_set_version,
    scoring_version,
    classification_version
  ) values (
    p_account_id,
    v_checkin.cycle_id,
    v_checkin.id,
    v_checkin.local_date,
    v_cycle.timezone_at_start,
    v_facet_scores,
    v_dimension_scores,
    v_boundary_distances,
    v_minimum_distance,
    v_type_id,
    coalesce(v_question_set_version, 'web-big-five-v1'),
    'alice-daily-big-five-v1',
    'classify-thirty-two-v1'
  )
  returning * into v_result;

  v_journal := nullif(btrim(coalesce(p_journal_body, '')), '');
  if v_journal is null then
    delete from public.journal_entries where checkin_id = v_checkin.id;
  else
    if char_length(v_journal) > 5000 then
      raise exception using errcode = 'P0001', message = 'journal_too_long';
    end if;

    insert into public.journal_entries (
      account_id,
      cycle_id,
      checkin_id,
      local_date,
      body
    ) values (
      p_account_id,
      v_checkin.cycle_id,
      v_checkin.id,
      v_checkin.local_date,
      v_journal
    )
    on conflict (checkin_id) do update
      set body = excluded.body,
          updated_at = now();
  end if;

  update public.daily_checkins
     set mood = p_mood,
         status = 'completed',
         completed_at = now(),
         updated_at = now()
   where id = v_checkin.id;

  select count(*)::integer
    into v_completed_days
    from public.daily_checkins
   where account_id = p_account_id
     and cycle_id = v_checkin.cycle_id
     and status = 'completed';

  return jsonb_build_object(
    'checkin_id', v_checkin.id,
    'status', 'completed',
    'cycle_id', v_checkin.cycle_id,
    'cycle_day', v_checkin.cycle_day,
    'completed_days', v_completed_days,
    'result', jsonb_build_object(
      'daily_result_id', v_result.id,
      'thirty_two_type_id', v_result.thirty_two_type_id,
      'dimension_scores', v_result.dimension_scores,
      'minimum_boundary_distance', v_result.minimum_boundary_distance,
      'completed_at', v_result.completed_at
    )
  );
end;
$$;

create or replace function public.touch_alice_mutable_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prepare_alice_journal_entry()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  v_checkin public.daily_checkins%rowtype;
begin
  if new.checkin_id is null then
    raise exception using errcode = 'P0001', message = 'journal_checkin_required';
  end if;

  if tg_op = 'UPDATE'
     and (
       new.account_id <> old.account_id
       or new.cycle_id <> old.cycle_id
       or new.checkin_id <> old.checkin_id
       or new.local_date <> old.local_date
     ) then
    raise exception using errcode = 'P0001', message = 'journal_identity_locked';
  end if;

  select *
    into v_checkin
    from public.daily_checkins
   where id = new.checkin_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'journal_not_allowed';
  end if;

  new.account_id := v_checkin.account_id;
  new.cycle_id := v_checkin.cycle_id;
  new.local_date := v_checkin.local_date;
  new.body := btrim(new.body);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_journal_entries_prepare on public.journal_entries;
create trigger trg_journal_entries_prepare
before insert or update on public.journal_entries
for each row execute function public.prepare_alice_journal_entry();

drop trigger if exists trg_daily_checkins_touch_updated_at on public.daily_checkins;
create trigger trg_daily_checkins_touch_updated_at
before update on public.daily_checkins
for each row execute function public.touch_alice_mutable_updated_at();

drop trigger if exists trg_journal_entries_touch_updated_at on public.journal_entries;
create trigger trg_journal_entries_touch_updated_at
before update on public.journal_entries
for each row execute function public.touch_alice_mutable_updated_at();

alter table public.weekly_cycles enable row level security;
alter table public.daily_question_bank enable row level security;
alter table public.daily_question_texts enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.daily_answers enable row level security;
alter table public.daily_results enable row level security;
alter table public.journal_entries enable row level security;
alter table public.weekly_reports enable row level security;

drop policy if exists "account owner can read cycles" on public.weekly_cycles;
create policy "account owner can read cycles"
  on public.weekly_cycles for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "authenticated can read daily question bank" on public.daily_question_bank;
create policy "authenticated can read daily question bank"
  on public.daily_question_bank for select to authenticated
  using (true);

drop policy if exists "authenticated can read daily question texts" on public.daily_question_texts;
create policy "authenticated can read daily question texts"
  on public.daily_question_texts for select to authenticated
  using (true);

drop policy if exists "account owner can read daily checkins" on public.daily_checkins;
create policy "account owner can read daily checkins"
  on public.daily_checkins for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can update daily checkin draft" on public.daily_checkins;
create policy "account owner can update daily checkin draft"
  on public.daily_checkins for update to authenticated
  using ((select auth.uid()) = account_id and status = 'in_progress')
  with check ((select auth.uid()) = account_id and status = 'in_progress');

drop policy if exists "account owner can read daily answers" on public.daily_answers;
create policy "account owner can read daily answers"
  on public.daily_answers for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can insert daily answer drafts" on public.daily_answers;
create policy "account owner can insert daily answer drafts"
  on public.daily_answers for insert to authenticated
  with check (
    (select auth.uid()) = account_id
    and exists (
      select 1
        from public.daily_checkins checkin
       where checkin.id = checkin_id
         and checkin.account_id = (select auth.uid())
         and checkin.status = 'in_progress'
    )
  );

drop policy if exists "account owner can update daily answer drafts" on public.daily_answers;
create policy "account owner can update daily answer drafts"
  on public.daily_answers for update to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id);

drop policy if exists "account owner can delete daily answer drafts" on public.daily_answers;
create policy "account owner can delete daily answer drafts"
  on public.daily_answers for delete to authenticated
  using (
    (select auth.uid()) = account_id
    and exists (
      select 1
        from public.daily_checkins checkin
       where checkin.id = checkin_id
         and checkin.status = 'in_progress'
    )
  );

drop policy if exists "account owner can read daily results" on public.daily_results;
create policy "account owner can read daily results"
  on public.daily_results for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can manage journals" on public.journal_entries;
create policy "account owner can manage journals"
  on public.journal_entries for all to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id);

drop policy if exists "account owner can read weekly reports" on public.weekly_reports;
create policy "account owner can read weekly reports"
  on public.weekly_reports for select to authenticated
  using ((select auth.uid()) = account_id);

grant select on
  public.weekly_cycles,
  public.daily_question_bank,
  public.daily_question_texts,
  public.daily_checkins,
  public.daily_answers,
  public.daily_results,
  public.journal_entries,
  public.weekly_reports
to authenticated;

grant update (mood, updated_at) on public.daily_checkins to authenticated;
grant insert (checkin_id, question_id, answer) on public.daily_answers to authenticated;
grant update (checkin_id, question_id, answer) on public.daily_answers to authenticated;
grant delete on public.daily_answers to authenticated;
grant insert (account_id, cycle_id, checkin_id, local_date, body)
  on public.journal_entries to authenticated;
grant update (account_id, cycle_id, checkin_id, local_date, body, updated_at)
  on public.journal_entries to authenticated;
grant delete on public.journal_entries to authenticated;

revoke all on function public.start_alice_daily(uuid) from public, anon, authenticated;
revoke all on function public.complete_alice_daily(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.start_alice_daily(uuid) to service_role;
grant execute on function public.complete_alice_daily(uuid, uuid, text, jsonb, text)
  to service_role;

-- Alice app Phase 3: subscription-gated dialogue, idempotent message storage,
-- memory context, and atomic Tier A usage accounting.
-- Requires Phase 1 and Phase 2 Alice migrations.


create table if not exists public.subscription_entitlements (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  state text not null default 'none',
  entitlement_id text null,
  product_id text null,
  store text null,
  expires_at timestamptz null,
  grace_period_expires_at timestamptz null,
  source_event_id text null,
  updated_at timestamptz not null default now(),
  constraint subscription_entitlements_state_check check (
    state in ('none', 'trialing', 'active', 'grace_period', 'billing_issue', 'expired')
  )
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null default 'active',
  context_prefix_revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint chat_threads_status_check check (status in ('active', 'archived')),
  constraint chat_threads_context_revision_positive check (context_prefix_revision > 0)
);

create unique index if not exists uq_chat_threads_one_active
  on public.chat_threads(account_id)
  where status = 'active';

create index if not exists idx_chat_threads_account_updated
  on public.chat_threads(account_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  role text not null,
  content text not null default '',
  status text not null,
  client_message_id uuid null,
  response_to_client_message_id uuid null,
  usage_local_date date not null,
  attempt_count smallint not null default 1,
  model text null,
  finish_reason text null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  error_code text null,
  generation_started_at timestamptz null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint chat_messages_role_check check (role in ('user', 'assistant')),
  constraint chat_messages_status_check check (
    status in ('generating', 'completed', 'failed', 'aborted')
  ),
  constraint chat_messages_content_length check (
    (role = 'user' and char_length(content) between 1 and 4000)
    or (role = 'assistant' and char_length(content) <= 12000)
  ),
  constraint chat_messages_identity_check check (
    (role = 'user' and client_message_id is not null and response_to_client_message_id is null)
    or
    (role = 'assistant' and client_message_id is null and response_to_client_message_id is not null)
  ),
  constraint chat_messages_user_completed_check check (
    role <> 'user' or status = 'completed'
  ),
  constraint chat_messages_generation_started_check check (
    (role = 'assistant' and generation_started_at is not null)
    or (role = 'user' and generation_started_at is null)
  ),
  constraint chat_messages_attempt_check check (attempt_count between 1 and 3),
  constraint chat_messages_token_check check (input_tokens >= 0 and output_tokens >= 0)
);

create unique index if not exists uq_chat_messages_user_client_id
  on public.chat_messages(account_id, client_message_id)
  where role = 'user';

create unique index if not exists uq_chat_messages_assistant_response
  on public.chat_messages(account_id, response_to_client_message_id)
  where role = 'assistant';

create index if not exists idx_chat_messages_thread_created
  on public.chat_messages(thread_id, created_at asc, id asc);

create table if not exists public.conversation_summaries (
  thread_id uuid primary key references public.chat_threads(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  content text not null,
  through_message_created_at timestamptz not null,
  model text null,
  prompt_version text not null,
  updated_at timestamptz not null default now(),
  constraint conversation_summaries_content_length check (char_length(content) between 1 and 12000)
);

create table if not exists public.memory_candidates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_kind text not null,
  source_id uuid null,
  category text not null,
  content text not null,
  status text not null default 'pending',
  model text null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz null,
  constraint memory_candidates_source_check check (source_kind in ('chat', 'journal')),
  constraint memory_candidates_status_check check (status in ('pending', 'approved', 'rejected', 'merged')),
  constraint memory_candidates_content_length check (char_length(content) between 1 and 2000)
);

create index if not exists idx_memory_candidates_account_status
  on public.memory_candidates(account_id, status, created_at desc);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_candidate_id uuid null references public.memory_candidates(id) on delete set null,
  category text not null,
  content text not null,
  importance smallint not null default 3,
  is_pinned boolean not null default false,
  use_count integer not null default 0,
  last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_content_length check (char_length(content) between 1 and 2000),
  constraint memories_importance_check check (importance between 1 and 5),
  constraint memories_use_count_check check (use_count >= 0)
);

create index if not exists idx_memories_context_ranking
  on public.memories(account_id, is_pinned desc, importance desc, last_used_at desc, created_at desc);

create table if not exists public.ai_plan_limits (
  plan_key text not null,
  feature text not null,
  daily_accepted_limit integer not null,
  rolling_30d_accepted_limit integer not null,
  max_input_characters integer not null,
  max_output_tokens integer not null,
  version integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_key, feature),
  constraint ai_plan_limits_positive check (
    daily_accepted_limit > 0
    and rolling_30d_accepted_limit >= daily_accepted_limit
    and max_input_characters > 0
    and max_output_tokens > 0
    and version > 0
  )
);

insert into public.ai_plan_limits (
  plan_key,
  feature,
  daily_accepted_limit,
  rolling_30d_accepted_limit,
  max_input_characters,
  max_output_tokens,
  version
) values (
  'testflight-plus-v1',
  'dialogue',
  60,
  1200,
  4000,
  900,
  1
)
on conflict (plan_key, feature) do update
  set daily_accepted_limit = excluded.daily_accepted_limit,
      rolling_30d_accepted_limit = excluded.rolling_30d_accepted_limit,
      max_input_characters = excluded.max_input_characters,
      max_output_tokens = excluded.max_output_tokens,
      version = excluded.version,
      is_active = true,
      updated_at = now();

create table if not exists public.ai_daily_usage (
  account_id uuid not null references public.accounts(id) on delete cascade,
  local_date date not null,
  feature text not null,
  accepted_user_messages integer not null default 0,
  reserved_requests integer not null default 0,
  completed_requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_jpy numeric(12,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (account_id, local_date, feature),
  constraint ai_daily_usage_nonnegative check (
    accepted_user_messages >= 0
    and reserved_requests >= 0
    and completed_requests >= 0
    and input_tokens >= 0
    and output_tokens >= 0
    and estimated_cost_jpy >= 0
  )
);

create table if not exists public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  feature text not null,
  tier text not null,
  user_message_id uuid null references public.chat_messages(id) on delete set null,
  assistant_message_id uuid null references public.chat_messages(id) on delete set null,
  client_message_id uuid null,
  attempt_number smallint not null default 1,
  status text not null,
  model text null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_jpy numeric(12,4) not null default 0,
  finish_reason text null,
  error_code text null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  constraint ai_generation_logs_tier_check check (tier in ('A', 'B', 'C')),
  constraint ai_generation_logs_status_check check (status in ('completed', 'failed', 'aborted')),
  constraint ai_generation_logs_attempt_check check (attempt_number between 1 and 3),
  constraint ai_generation_logs_token_check check (input_tokens >= 0 and output_tokens >= 0),
  constraint ai_generation_logs_attempt_unique unique (assistant_message_id, attempt_number)
);

create index if not exists idx_ai_generation_logs_account_started
  on public.ai_generation_logs(account_id, started_at desc);

create or replace function public.reserve_alice_chat_message(
  p_account_id uuid,
  p_client_message_id uuid,
  p_content text,
  p_thread_id uuid default null,
  p_bypass_entitlement boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account public.accounts%rowtype;
  v_entitlement public.subscription_entitlements%rowtype;
  v_thread public.chat_threads%rowtype;
  v_user public.chat_messages%rowtype;
  v_assistant public.chat_messages%rowtype;
  v_limit public.ai_plan_limits%rowtype;
  v_usage public.ai_daily_usage%rowtype;
  v_timezone text;
  v_local_date date;
  v_rolling_count integer;
  v_content text;
  v_is_retry boolean := false;
  v_reclaim_stale boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text || ':alice-chat', 0));

  select *
    into v_account
    from public.accounts
   where id = p_account_id;

  if not found or v_account.active_base_profile_snapshot_id is null then
    raise exception using errcode = 'P0001', message = 'account_not_linked';
  end if;

  v_content := trim(coalesce(p_content, ''));
  if char_length(v_content) not between 1 and 4000 then
    raise exception using errcode = 'P0001', message = 'chat_message_invalid';
  end if;

  select *
    into v_user
    from public.chat_messages
   where account_id = p_account_id
     and client_message_id = p_client_message_id
     and role = 'user';

  if found then
    if v_user.content <> v_content then
      raise exception using errcode = 'P0001', message = 'client_message_id_conflict';
    end if;

    select *
      into v_assistant
      from public.chat_messages
     where account_id = p_account_id
       and response_to_client_message_id = p_client_message_id
       and role = 'assistant'
     for update;

    if found and v_assistant.status = 'completed' then
      return jsonb_build_object(
        'duplicate', true,
        'reserved', false,
        'thread_id', v_user.thread_id,
        'user_message_id', v_user.id,
        'assistant_message_id', v_assistant.id,
        'assistant_status', v_assistant.status,
        'assistant_content', v_assistant.content,
        'attempt_count', v_assistant.attempt_count
      );
    end if;

    if found and v_assistant.status = 'generating' then
      if coalesce(v_assistant.generation_started_at, v_assistant.created_at)
         > now() - interval '5 minutes' then
        return jsonb_build_object(
          'duplicate', true,
          'reserved', false,
          'thread_id', v_user.thread_id,
          'user_message_id', v_user.id,
          'assistant_message_id', v_assistant.id,
          'assistant_status', v_assistant.status,
          'assistant_content', v_assistant.content,
          'attempt_count', v_assistant.attempt_count
        );
      end if;
      v_reclaim_stale := true;
    end if;

    if not found or v_assistant.attempt_count >= 3 then
      raise exception using errcode = 'P0001', message = 'chat_retry_limit_reached';
    end if;
    v_is_retry := true;
  end if;

  select *
    into v_entitlement
    from public.subscription_entitlements
   where account_id = p_account_id;

  if not p_bypass_entitlement
     and not v_account.is_review_account
     and (
       not found
       or v_entitlement.state not in ('trialing', 'active', 'grace_period')
       or (
         v_entitlement.state in ('trialing', 'active')
         and v_entitlement.expires_at is not null
         and v_entitlement.expires_at <= now()
       )
       or (
         v_entitlement.state = 'grace_period'
         and v_entitlement.grace_period_expires_at is not null
         and v_entitlement.grace_period_expires_at <= now()
       )
     ) then
    raise exception using errcode = 'P0001', message = 'subscription_required';
  end if;

  select *
    into v_limit
    from public.ai_plan_limits
   where feature = 'dialogue'
     and is_active = true
   order by version desc
   limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'ai_plan_limit_missing';
  end if;

  if char_length(v_content) > v_limit.max_input_characters then
    raise exception using errcode = 'P0001', message = 'chat_message_too_long';
  end if;

  v_timezone := v_account.timezone;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    v_timezone := 'Asia/Tokyo';
  end if;
  v_local_date := (now() at time zone v_timezone)::date;

  if v_is_retry then
    v_local_date := v_user.usage_local_date;
  end if;

  insert into public.ai_daily_usage (account_id, local_date, feature)
  values (p_account_id, v_local_date, 'dialogue')
  on conflict (account_id, local_date, feature) do nothing;

  select *
    into v_usage
    from public.ai_daily_usage
   where account_id = p_account_id
     and local_date = v_local_date
     and feature = 'dialogue'
   for update;

  select coalesce(sum(accepted_user_messages), 0)::integer
    into v_rolling_count
    from public.ai_daily_usage
   where account_id = p_account_id
     and feature = 'dialogue'
     and local_date between v_local_date - 29 and v_local_date;

  if not v_is_retry and v_usage.accepted_user_messages >= v_limit.daily_accepted_limit then
    raise exception using errcode = 'P0001', message = 'ai_daily_limit_reached';
  end if;
  if not v_is_retry and v_rolling_count >= v_limit.rolling_30d_accepted_limit then
    raise exception using errcode = 'P0001', message = 'ai_rolling_limit_reached';
  end if;

  update public.ai_daily_usage
     set accepted_user_messages = accepted_user_messages + case when v_is_retry then 0 else 1 end,
         reserved_requests = greatest(
           reserved_requests - case when v_reclaim_stale then 1 else 0 end,
           0
         ) + 1,
         updated_at = now()
   where account_id = p_account_id
     and local_date = v_local_date
     and feature = 'dialogue';

  if v_is_retry then
    if v_reclaim_stale then
      insert into public.ai_generation_logs (
        account_id, feature, tier, user_message_id, assistant_message_id,
        client_message_id, attempt_number, status, error_code, finished_at
      ) values (
        p_account_id, 'dialogue', 'A', v_user.id, v_assistant.id,
        p_client_message_id, v_assistant.attempt_count, 'aborted',
        'stale_reservation_reclaimed', now()
      ) on conflict (assistant_message_id, attempt_number) do nothing;
    end if;

    update public.chat_messages
       set status = 'generating',
           content = '',
           error_code = null,
           model = null,
           finish_reason = null,
           input_tokens = 0,
           output_tokens = 0,
           completed_at = null,
           generation_started_at = now(),
           attempt_count = attempt_count + 1
     where id = v_assistant.id
    returning * into v_assistant;

    update public.chat_threads set updated_at = now() where id = v_user.thread_id;

    return jsonb_build_object(
      'duplicate', true,
      'reserved', true,
      'thread_id', v_user.thread_id,
      'user_message_id', v_user.id,
      'assistant_message_id', v_assistant.id,
      'assistant_status', v_assistant.status,
      'assistant_content', v_assistant.content,
      'attempt_count', v_assistant.attempt_count
    );
  end if;

  if p_thread_id is not null then
    select *
      into v_thread
      from public.chat_threads
     where id = p_thread_id
       and account_id = p_account_id
       and status = 'active';
    if not found then
      raise exception using errcode = 'P0001', message = 'chat_thread_not_found';
    end if;
  else
    select *
      into v_thread
      from public.chat_threads
     where account_id = p_account_id
       and status = 'active'
     limit 1;

    if not found then
      insert into public.chat_threads (account_id)
      values (p_account_id)
      returning * into v_thread;
    end if;
  end if;

  insert into public.chat_messages (
    thread_id,
    account_id,
    role,
    content,
    status,
    client_message_id,
    usage_local_date
  ) values (
    v_thread.id,
    p_account_id,
    'user',
    v_content,
    'completed',
    p_client_message_id,
    v_local_date
  ) returning * into v_user;

  insert into public.chat_messages (
    thread_id,
    account_id,
    role,
    content,
    status,
    response_to_client_message_id,
    usage_local_date,
    generation_started_at
  ) values (
    v_thread.id,
    p_account_id,
    'assistant',
    '',
    'generating',
    p_client_message_id,
    v_local_date,
    now()
  ) returning * into v_assistant;

  update public.chat_threads set updated_at = now() where id = v_thread.id;

  return jsonb_build_object(
    'duplicate', false,
    'reserved', true,
    'thread_id', v_thread.id,
    'user_message_id', v_user.id,
    'assistant_message_id', v_assistant.id,
    'assistant_status', v_assistant.status,
    'assistant_content', v_assistant.content,
    'attempt_count', v_assistant.attempt_count
  );
end;
$$;

create or replace function public.settle_alice_chat_message(
  p_account_id uuid,
  p_client_message_id uuid,
  p_content text,
  p_model text,
  p_finish_reason text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_jpy numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user public.chat_messages%rowtype;
  v_assistant public.chat_messages%rowtype;
  v_content text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text || ':alice-chat', 0));

  select * into v_user
    from public.chat_messages
   where account_id = p_account_id
     and client_message_id = p_client_message_id
     and role = 'user';

  select * into v_assistant
    from public.chat_messages
   where account_id = p_account_id
     and response_to_client_message_id = p_client_message_id
     and role = 'assistant'
   for update;

  if v_user.id is null or v_assistant.id is null then
    raise exception using errcode = 'P0001', message = 'chat_message_not_found';
  end if;
  if v_assistant.status = 'completed' then
    return jsonb_build_object(
      'assistant_message_id', v_assistant.id,
      'status', v_assistant.status,
      'content', v_assistant.content,
      'completed_at', v_assistant.completed_at
    );
  end if;
  if v_assistant.status <> 'generating' then
    raise exception using errcode = 'P0001', message = 'chat_message_not_generating';
  end if;

  v_content := trim(coalesce(p_content, ''));
  if char_length(v_content) not between 1 and 12000 then
    raise exception using errcode = 'P0001', message = 'assistant_message_invalid';
  end if;

  update public.chat_messages
     set content = v_content,
         status = 'completed',
         model = p_model,
         finish_reason = p_finish_reason,
         input_tokens = greatest(coalesce(p_input_tokens, 0), 0),
         output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
         error_code = null,
         completed_at = now()
   where id = v_assistant.id
  returning * into v_assistant;

  update public.ai_daily_usage
     set reserved_requests = greatest(reserved_requests - 1, 0),
         completed_requests = completed_requests + 1,
         input_tokens = input_tokens + v_assistant.input_tokens,
         output_tokens = output_tokens + v_assistant.output_tokens,
         estimated_cost_jpy = estimated_cost_jpy + greatest(coalesce(p_estimated_cost_jpy, 0), 0),
         updated_at = now()
   where account_id = p_account_id
     and local_date = v_user.usage_local_date
     and feature = 'dialogue';

  insert into public.ai_generation_logs (
    account_id, feature, tier, user_message_id, assistant_message_id,
    client_message_id, attempt_number, status, model, input_tokens,
    output_tokens, estimated_cost_jpy, finish_reason, finished_at
  ) values (
    p_account_id, 'dialogue', 'A', v_user.id, v_assistant.id,
    p_client_message_id, v_assistant.attempt_count, 'completed', p_model,
    v_assistant.input_tokens, v_assistant.output_tokens,
    greatest(coalesce(p_estimated_cost_jpy, 0), 0), p_finish_reason, now()
  ) on conflict (assistant_message_id, attempt_number) do nothing;

  update public.chat_threads set updated_at = now() where id = v_user.thread_id;

  return jsonb_build_object(
    'assistant_message_id', v_assistant.id,
    'status', v_assistant.status,
    'content', v_assistant.content,
    'completed_at', v_assistant.completed_at
  );
end;
$$;

create or replace function public.release_alice_chat_message(
  p_account_id uuid,
  p_client_message_id uuid,
  p_status text,
  p_error_code text default null,
  p_model text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user public.chat_messages%rowtype;
  v_assistant public.chat_messages%rowtype;
begin
  if p_status not in ('failed', 'aborted') then
    raise exception using errcode = 'P0001', message = 'chat_release_status_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text || ':alice-chat', 0));

  select * into v_user
    from public.chat_messages
   where account_id = p_account_id
     and client_message_id = p_client_message_id
     and role = 'user';

  select * into v_assistant
    from public.chat_messages
   where account_id = p_account_id
     and response_to_client_message_id = p_client_message_id
     and role = 'assistant'
   for update;

  if v_user.id is null or v_assistant.id is null or v_assistant.status <> 'generating' then
    return;
  end if;

  update public.chat_messages
     set status = p_status,
         model = p_model,
         error_code = left(coalesce(p_error_code, p_status), 120),
         completed_at = now()
   where id = v_assistant.id
  returning * into v_assistant;

  update public.ai_daily_usage
     set reserved_requests = greatest(reserved_requests - 1, 0),
         updated_at = now()
   where account_id = p_account_id
     and local_date = v_user.usage_local_date
     and feature = 'dialogue';

  insert into public.ai_generation_logs (
    account_id, feature, tier, user_message_id, assistant_message_id,
    client_message_id, attempt_number, status, model, error_code, finished_at
  ) values (
    p_account_id, 'dialogue', 'A', v_user.id, v_assistant.id,
    p_client_message_id, v_assistant.attempt_count, p_status, p_model,
    left(coalesce(p_error_code, p_status), 120), now()
  ) on conflict (assistant_message_id, attempt_number) do nothing;
end;
$$;

create or replace function public.mark_alice_memories_used(
  p_account_id uuid,
  p_memory_ids uuid[]
)
returns void
language sql
security definer
set search_path = public, auth
as $$
  update public.memories
     set use_count = use_count + 1,
         last_used_at = now(),
         updated_at = now()
   where account_id = p_account_id
     and id = any(coalesce(p_memory_ids, array[]::uuid[]));
$$;

drop trigger if exists trg_subscription_entitlements_touch on public.subscription_entitlements;
create trigger trg_subscription_entitlements_touch
before update on public.subscription_entitlements
for each row execute function public.touch_alice_mutable_updated_at();

drop trigger if exists trg_chat_threads_touch on public.chat_threads;
create trigger trg_chat_threads_touch
before update on public.chat_threads
for each row execute function public.touch_alice_mutable_updated_at();

drop trigger if exists trg_memories_touch on public.memories;
create trigger trg_memories_touch
before update on public.memories
for each row execute function public.touch_alice_mutable_updated_at();

drop trigger if exists trg_ai_plan_limits_touch on public.ai_plan_limits;
create trigger trg_ai_plan_limits_touch
before update on public.ai_plan_limits
for each row execute function public.touch_alice_mutable_updated_at();

alter table public.subscription_entitlements enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.conversation_summaries enable row level security;
alter table public.memory_candidates enable row level security;
alter table public.memories enable row level security;
alter table public.ai_plan_limits enable row level security;
alter table public.ai_daily_usage enable row level security;
alter table public.ai_generation_logs enable row level security;

drop policy if exists "account owner can read subscription entitlement" on public.subscription_entitlements;
create policy "account owner can read subscription entitlement"
  on public.subscription_entitlements for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can read chat threads" on public.chat_threads;
create policy "account owner can read chat threads"
  on public.chat_threads for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can read chat messages" on public.chat_messages;
create policy "account owner can read chat messages"
  on public.chat_messages for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can read conversation summaries" on public.conversation_summaries;
create policy "account owner can read conversation summaries"
  on public.conversation_summaries for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can read memory candidates" on public.memory_candidates;
create policy "account owner can read memory candidates"
  on public.memory_candidates for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can read memories" on public.memories;
create policy "account owner can read memories"
  on public.memories for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can read own ai usage" on public.ai_daily_usage;
create policy "account owner can read own ai usage"
  on public.ai_daily_usage for select to authenticated
  using ((select auth.uid()) = account_id);

grant select on public.subscription_entitlements, public.chat_threads,
  public.chat_messages, public.conversation_summaries,
  public.memory_candidates, public.memories, public.ai_daily_usage
to authenticated;

revoke all on public.ai_plan_limits, public.ai_generation_logs from public, anon, authenticated;

revoke all on function public.reserve_alice_chat_message(uuid, uuid, text, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.settle_alice_chat_message(uuid, uuid, text, text, text, integer, integer, numeric)
  from public, anon, authenticated;
revoke all on function public.release_alice_chat_message(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.mark_alice_memories_used(uuid, uuid[])
  from public, anon, authenticated;

grant execute on function public.reserve_alice_chat_message(uuid, uuid, text, uuid, boolean)
  to service_role;
grant execute on function public.settle_alice_chat_message(uuid, uuid, text, text, text, integer, integer, numeric)
  to service_role;
grant execute on function public.release_alice_chat_message(uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.mark_alice_memories_used(uuid, uuid[])
  to service_role;

notify pgrst, 'reload schema';

commit;
