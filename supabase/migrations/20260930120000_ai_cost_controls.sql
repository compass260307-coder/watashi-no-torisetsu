-- AI費用P0対策:
--   1. 全生成経路で共通利用する費用・トークン台帳
--   2. 運命鑑定の原子的な生成ロックと世代キー
--
-- アプリはservice roleだけで書き込む。プロンプトや生成本文は保存しない。

begin;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.users(id) on delete set null,
  feature text not null,
  provider text not null,
  model text not null,
  modality text not null check (modality in ('text', 'image')),
  status text not null check (status in ('succeeded', 'failed')),
  generation_key text,
  attempt integer not null default 1 check (attempt > 0),
  provider_request_id text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  cache_read_input_tokens integer
    check (cache_read_input_tokens is null or cache_read_input_tokens >= 0),
  cache_write_input_tokens integer
    check (cache_write_input_tokens is null or cache_write_input_tokens >= 0),
  image_count integer not null default 0 check (image_count >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  estimated_cost_usd numeric(12, 8)
    check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  error_code text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_feature_created
  on public.ai_usage_events(feature, created_at desc);
create index if not exists idx_ai_usage_events_user_created
  on public.ai_usage_events(user_id, created_at desc)
  where user_id is not null;
create index if not exists idx_ai_usage_events_generation_key
  on public.ai_usage_events(generation_key)
  where generation_key is not null;

alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from public, anon, authenticated;
grant select, insert on public.ai_usage_events to service_role;

comment on table public.ai_usage_events is
  'AI生成の機能別トークン・成否・実行時間台帳。プロンプトと生成本文は保存しない。';
comment on column public.ai_usage_events.estimated_cost_usd is
  '価格表またはGateway Generation Lookupで確定できた場合だけ保存する。';

alter table public.natal_readings
  add column if not exists generation_key uuid;

create or replace function public.acquire_natal_reading_generation(
  p_user_id uuid,
  p_locale text,
  p_max_attempts integer default 3,
  p_stale_after_seconds integer default 180,
  p_force boolean default false,
  p_replace_ready boolean default false
)
returns table (
  acquired boolean,
  attempts integer,
  reason text,
  generation_key uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.natal_readings%rowtype;
  v_attempts integer := 0;
  v_existing_locale text := 'ja';
  v_is_ready boolean := false;
  v_generation_key uuid := gen_random_uuid();
begin
  if p_locale not in ('ja', 'ko', 'en', 'id') then
    raise exception 'unsupported locale';
  end if;
  if p_max_attempts < 1 or p_stale_after_seconds < 1 then
    raise exception 'invalid generation limits';
  end if;

  insert into public.natal_readings (
    user_id,
    reading,
    model,
    generated_at,
    generation_key
  )
  values (
    p_user_id,
    jsonb_build_object(
      'status', 'generating',
      'attempts', 0,
      'locale', p_locale
    ),
    'generating',
    now(),
    v_generation_key
  )
  on conflict (user_id) do nothing;

  if found then
    return query select true, 0, 'acquired'::text, v_generation_key;
    return;
  end if;

  select *
    into v_row
    from public.natal_readings
   where user_id = p_user_id
   for update;

  v_attempts := case
    when coalesce(v_row.reading ->> 'attempts', '') ~ '^[0-9]+$'
      then (v_row.reading ->> 'attempts')::integer
    else 0
  end;
  v_existing_locale := case
    when v_row.reading ->> 'locale' in ('ja', 'ko', 'en', 'id')
      then v_row.reading ->> 'locale'
    else 'ja'
  end;
  v_is_ready :=
    v_row.model is not null
    and v_row.model not in ('pending', 'generating', 'failed', 'local-placeholder')
    and coalesce(v_row.reading ->> 'generated_from', '') <> 'not-implemented'
    and case
      when jsonb_typeof(v_row.reading -> 'sections') = 'array'
        then jsonb_array_length(v_row.reading -> 'sections') > 0
      else false
    end;

  if v_is_ready and v_existing_locale = p_locale and not p_replace_ready then
    return query select false, v_attempts, 'ready'::text, null::uuid;
    return;
  end if;

  if v_row.model = 'generating'
     and v_row.generated_at >= now() - make_interval(secs => p_stale_after_seconds) then
    return query select false, v_attempts, 'in_progress'::text, null::uuid;
    return;
  end if;

  if v_attempts >= p_max_attempts and not p_force then
    return query select false, v_attempts, 'failed'::text, null::uuid;
    return;
  end if;

  update public.natal_readings
     set reading = jsonb_build_object(
           'status', 'generating',
           'attempts', v_attempts,
           'locale', p_locale
         ),
         model = 'generating',
         generated_at = now(),
         generation_key = v_generation_key
   where user_id = p_user_id;

  return query select true, v_attempts, 'acquired'::text, v_generation_key;
end;
$$;

revoke all on function public.acquire_natal_reading_generation(
  uuid,
  text,
  integer,
  integer,
  boolean,
  boolean
) from public, anon, authenticated;
grant execute on function public.acquire_natal_reading_generation(
  uuid,
  text,
  integer,
  integer,
  boolean,
  boolean
) to service_role;

comment on function public.acquire_natal_reading_generation(
  uuid,
  text,
  integer,
  integer,
  boolean,
  boolean
) is 'natal_readings行をロックして生成権を1実行だけに与える。';

commit;
