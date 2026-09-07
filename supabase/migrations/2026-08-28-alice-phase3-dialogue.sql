-- Alice app Phase 3: subscription-gated dialogue, idempotent message storage,
-- memory context, and atomic Tier A usage accounting.
-- Requires Phase 1 and Phase 2 Alice migrations.

begin;

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

commit;
