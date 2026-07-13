-- 公開APIの荒らし・連投対策。
-- 実行: Supabase Dashboard -> SQL Editor で全文実行 (idempotent)。
--
-- 1. Vercelの複数Functionインスタンス間で共有する固定窓レート制限
-- 2. 友達回答の短時間二重送信をDBの一意制約でも防止

create table if not exists public.api_rate_limits (
  scope text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  created_at timestamptz not null default now(),
  primary key (scope, identifier_hash, window_started_at),
  constraint api_rate_limits_scope_length check (char_length(scope) between 1 and 100),
  constraint api_rate_limits_hash_format check (identifier_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists idx_api_rate_limits_window
  on public.api_rate_limits(window_started_at);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_identifier_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
begin
  if p_scope is null or char_length(p_scope) not between 1 and 100 then
    raise exception 'invalid rate-limit scope';
  end if;
  if p_identifier_hash is null or p_identifier_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit identifier';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit window';
  end if;
  if p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate-limit limit';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (
    scope,
    identifier_hash,
    window_started_at,
    request_count
  )
  values (p_scope, p_identifier_hash, v_window_start, 1)
  on conflict (scope, identifier_hash, window_started_at)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  v_retry_after := greatest(
    1,
    ceil(
      extract(
        epoch from (
          v_window_start + make_interval(secs => p_window_seconds) - v_now
        )
      )
    )::integer
  );

  -- 古いバケットを確率的に掃除し、各リクエストの負荷を小さく保つ。
  if random() < 0.01 then
    delete from public.api_rate_limits
      where window_started_at < v_now - interval '2 days';
  end if;

  return query
    select
      v_count <= p_limit,
      greatest(p_limit - v_count, 0),
      v_retry_after;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

alter table public.friend_answers
  add column if not exists submission_hash text null;

create unique index if not exists uq_friend_answers_submission_hash
  on public.friend_answers(user_id, submission_hash)
  where submission_hash is not null;
