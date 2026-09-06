-- Browser analytics ingress without a Vercel Function hop.
--
-- This RPC is deliberately isolated from pgrst.db_pre_request so limits cannot
-- affect checkout, webhooks, Alice, or other Supabase Data API traffic.
-- Migration 20260906113000 closes the legacy anon table INSERT after the client
-- bundle has switched to this RPC.

begin;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.event_ingest_settings (
  singleton boolean primary key default true check (singleton),
  hash_salt text not null check (char_length(hash_salt) >= 64),
  session_limit_per_minute integer not null default 120
    check (session_limit_per_minute between 1 and 100000),
  ip_limit_per_minute integer not null default 6000
    check (ip_limit_per_minute between 1 and 1000000),
  enforce_ip boolean not null default false
);

insert into private.event_ingest_settings (
  singleton,
  hash_salt,
  session_limit_per_minute,
  ip_limit_per_minute,
  enforce_ip
)
values (
  true,
  gen_random_uuid()::text || gen_random_uuid()::text,
  120,
  6000,
  false
)
on conflict (singleton) do nothing;

create table if not exists private.event_ingest_rate_limits (
  scope text not null check (scope in ('ip-60s', 'session-60s')),
  identifier_hash text not null check (identifier_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  event_count bigint not null check (event_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, identifier_hash, window_started_at)
);

create index if not exists event_ingest_rate_limits_window_idx
  on private.event_ingest_rate_limits (window_started_at);

alter table private.event_ingest_settings enable row level security;
alter table private.event_ingest_rate_limits enable row level security;

revoke all on table private.event_ingest_settings
  from public, anon, authenticated;
revoke all on table private.event_ingest_rate_limits
  from public, anon, authenticated;

create or replace function public.ingest_client_events(p_events jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_retry_after integer;
  v_batch_size integer;

  v_event jsonb;
  v_event_name text;
  v_session_id text;
  v_batch_session_id text;
  v_invite_code text;
  v_owner_token text;
  v_locale text;
  v_metadata jsonb;
  v_metadata_key_count integer;
  v_invalid_metadata boolean;

  v_headers_text text;
  v_headers jsonb;
  v_ip_text text;
  v_client_ip inet;

  v_hash_salt text;
  v_session_limit integer;
  v_ip_limit integer;
  v_enforce_ip boolean;

  v_session_hash text;
  v_ip_hash text;
  v_session_count bigint;
  v_ip_count bigint;
begin
  perform set_config(
    'response.headers',
    '[{"Cache-Control":"no-store"}]',
    true
  );

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    perform set_config('response.status', '400', true);
    return jsonb_build_object(
      'ok', false,
      'error', 'events_must_be_an_array',
      'accepted', 0
    );
  end if;

  v_batch_size := jsonb_array_length(p_events);

  if v_batch_size < 1 or v_batch_size > 10 then
    perform set_config('response.status', '400', true);
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_batch_size',
      'accepted', 0
    );
  end if;

  if octet_length(convert_to(p_events::text, 'UTF8')) > 60000 then
    perform set_config('response.status', '413', true);
    return jsonb_build_object(
      'ok', false,
      'error', 'payload_too_large',
      'accepted', 0
    );
  end if;

  for v_event in
    select item.value
    from jsonb_array_elements(p_events) as item(value)
  loop
    if jsonb_typeof(v_event) <> 'object' then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_event_shape',
        'accepted', 0
      );
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_event) as field(key)
      where field.key not in (
        'event_name',
        'session_id',
        'invite_code',
        'owner_token',
        'locale',
        'metadata'
      )
    ) then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'unknown_event_field',
        'accepted', 0
      );
    end if;

    if jsonb_typeof(v_event -> 'event_name') is distinct from 'string' then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_event_name',
        'accepted', 0
      );
    end if;

    v_event_name := v_event ->> 'event_name';

    if v_event_name not in (
      'top_viewed',
      'top_cta_clicked',
      'diagnosis_started',
      'diagnosis_question_answered',
      'diagnosis_completed',
      'friend_landing_viewed',
      'friend_answer_started',
      'friend_answer_scale_completed',
      'friend_answer_completed',
      'friend_to_diagnosis_clicked',
      'friend_to_diagnosis_invite_clicked',
      'friend_invite_clicked',
      'share_clicked',
      'share_ui_shown',
      'share_landing_viewed',
      'share_to_diagnosis_clicked',
      'result_viewed',
      'result_revisited',
      'three_friends_unlocked',
      'tako_nav_badge_shown',
      'tako_nav_badge_clicked',
      'tako_viewed',
      'tako_invite_ui_shown',
      'unmei_nav_badge_shown',
      'unmei_nav_badge_clicked',
      'unmei_lp_view',
      'unmei_purchase_start',
      'unmei_reading_view',
      'unmei_checkout_step_view',
      'unmei_purchase_complete_embedded',
      'paywall_viewed',
      'paywall_plan_viewed',
      'paywall_scroll_clicked',
      'purchase_cta_clicked',
      'uranai_interstitial_view',
      'uranai_interstitial_close',
      'uranai_interstitial_cta',
      'birth_form_view',
      'birth_form_submit',
      'birth_form_skip',
      'hoshiyomi_page_viewed',
      'hoshiyomi_paywall_opened',
      'hoshiyomi_message_sent',
      'hoshiyomi_response_completed',
      'hoshiyomi_response_failed',
      'line_alice_card_viewed',
      'line_alice_add_friend_clicked',
      'line_alice_link_code_requested',
      'line_alice_link_code_issued',
      'line_alice_link_code_failed'
    ) then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_event_name',
        'accepted', 0
      );
    end if;

    if jsonb_typeof(v_event -> 'session_id') is distinct from 'string' then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_session_id',
        'accepted', 0
      );
    end if;

    v_session_id := v_event ->> 'session_id';

    if
      char_length(v_session_id) not between 1 and 128
      or v_session_id !~ '^[A-Za-z0-9_-]+$'
    then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_session_id',
        'accepted', 0
      );
    end if;

    if v_batch_session_id is null then
      v_batch_session_id := v_session_id;
    elsif v_session_id <> v_batch_session_id then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'mixed_session_ids',
        'accepted', 0
      );
    end if;

    if
      v_event ? 'invite_code'
      and jsonb_typeof(v_event -> 'invite_code') not in ('null', 'string')
    then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_invite_code',
        'accepted', 0
      );
    end if;

    if
      v_event ? 'owner_token'
      and jsonb_typeof(v_event -> 'owner_token') not in ('null', 'string')
    then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_owner_token',
        'accepted', 0
      );
    end if;

    v_invite_code := v_event ->> 'invite_code';
    v_owner_token := v_event ->> 'owner_token';

    if
      v_invite_code is not null
      and (
        char_length(v_invite_code) not between 1 and 128
        or v_invite_code !~ '^[A-Za-z0-9_-]+$'
      )
    then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_invite_code',
        'accepted', 0
      );
    end if;

    if
      v_owner_token is not null
      and (
        char_length(v_owner_token) not between 1 and 128
        or v_owner_token !~ '^[A-Za-z0-9_-]+$'
      )
    then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_owner_token',
        'accepted', 0
      );
    end if;

    if jsonb_typeof(v_event -> 'locale') is distinct from 'string' then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_locale',
        'accepted', 0
      );
    end if;

    v_locale := v_event ->> 'locale';

    if v_locale not in ('ja', 'ko') then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_locale',
        'accepted', 0
      );
    end if;

    v_metadata := case
      when not (v_event ? 'metadata')
        or jsonb_typeof(v_event -> 'metadata') = 'null'
      then '{}'::jsonb
      else v_event -> 'metadata'
    end;

    if
      jsonb_typeof(v_metadata) <> 'object'
      or pg_column_size(v_metadata) >= 8192
    then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_metadata',
        'accepted', 0
      );
    end if;

    select count(*)
      into v_metadata_key_count
      from jsonb_object_keys(v_metadata);

    if v_metadata_key_count > 20 then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_metadata',
        'accepted', 0
      );
    end if;

    select exists (
      select 1
      from jsonb_each(v_metadata) as item(key, value)
      where
        item.key !~ '^[A-Za-z0-9_.-]{1,50}$'
        or jsonb_typeof(item.value) not in (
          'null',
          'boolean',
          'number',
          'string'
        )
        or (
          jsonb_typeof(item.value) = 'string'
          and char_length(item.value #>> '{}') > 200
        )
    )
    into v_invalid_metadata;

    if v_invalid_metadata then
      perform set_config('response.status', '400', true);
      return jsonb_build_object(
        'ok', false,
        'error', 'invalid_metadata',
        'accepted', 0
      );
    end if;
  end loop;

  select
    settings.hash_salt,
    settings.session_limit_per_minute,
    settings.ip_limit_per_minute,
    settings.enforce_ip
  into
    v_hash_salt,
    v_session_limit,
    v_ip_limit,
    v_enforce_ip
  from private.event_ingest_settings as settings
  where settings.singleton;

  if not found then
    perform set_config('response.status', '503', true);
    return jsonb_build_object(
      'ok', false,
      'error', 'rate_limit_unavailable',
      'accepted', 0
    );
  end if;

  v_headers_text := current_setting('request.headers', true);

  begin
    if v_headers_text is not null and btrim(v_headers_text) <> '' then
      v_headers := v_headers_text::jsonb;
      v_ip_text := btrim(
        split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)
      );

      if v_ip_text <> '' then
        v_client_ip := v_ip_text::inet;
      end if;
    end if;
  exception
    when others then
      v_client_ip := null;
  end;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / 60) * 60
  );

  v_session_hash := encode(
    sha256(
      convert_to(
        v_hash_salt || chr(31) || 'session' || chr(31) || v_batch_session_id,
        'UTF8'
      )
    ),
    'hex'
  );

  if v_client_ip is not null then
    v_ip_hash := encode(
      sha256(
        convert_to(
          v_hash_salt || chr(31) || 'ip' || chr(31) || host(v_client_ip),
          'UTF8'
        )
      ),
      'hex'
    );

    insert into private.event_ingest_rate_limits as current_bucket (
      scope,
      identifier_hash,
      window_started_at,
      event_count,
      updated_at
    )
    values (
      'ip-60s',
      v_ip_hash,
      v_window_start,
      v_batch_size,
      v_now
    )
    on conflict (scope, identifier_hash, window_started_at)
    do update set
      event_count = current_bucket.event_count + excluded.event_count,
      updated_at = excluded.updated_at
    returning event_count into v_ip_count;
  end if;

  -- The lock order is always IP then session, avoiding lock-order deadlocks.
  insert into private.event_ingest_rate_limits as current_bucket (
    scope,
    identifier_hash,
    window_started_at,
    event_count,
    updated_at
  )
  values (
    'session-60s',
    v_session_hash,
    v_window_start,
    v_batch_size,
    v_now
  )
  on conflict (scope, identifier_hash, window_started_at)
  do update set
    event_count = current_bucket.event_count + excluded.event_count,
    updated_at = excluded.updated_at
  returning event_count into v_session_count;

  if random() < 0.01 then
    delete from private.event_ingest_rate_limits
    where window_started_at < v_now - interval '2 days';
  end if;

  if
    v_session_count > v_session_limit
    or (
      v_enforce_ip
      and v_ip_count is not null
      and v_ip_count > v_ip_limit
    )
  then
    v_retry_after := greatest(
      1,
      ceil(
        extract(
          epoch from (v_window_start + interval '1 minute' - v_now)
        )
      )::integer
    );

    perform set_config('response.status', '429', true);
    perform set_config(
      'response.headers',
      jsonb_build_array(
        jsonb_build_object('Retry-After', v_retry_after::text),
        jsonb_build_object('Cache-Control', 'no-store')
      )::text,
      true
    );

    return jsonb_build_object(
      'ok', false,
      'error', 'rate_limited',
      'accepted', 0,
      'retry_after_seconds', v_retry_after,
      'ip_observed', v_client_ip is not null
    );
  end if;

  insert into public.events (
    event_name,
    session_id,
    invite_code,
    owner_token,
    locale,
    metadata,
    created_at
  )
  select
    item.value ->> 'event_name',
    item.value ->> 'session_id',
    item.value ->> 'invite_code',
    item.value ->> 'owner_token',
    item.value ->> 'locale',
    case
      when not (item.value ? 'metadata')
        or jsonb_typeof(item.value -> 'metadata') = 'null'
      then '{}'::jsonb
      else item.value -> 'metadata'
    end,
    v_now
  from jsonb_array_elements(p_events) as item(value);

  return jsonb_build_object(
    'ok', true,
    'accepted', v_batch_size,
    'ip_observed', v_client_ip is not null
  );
end;
$function$;

revoke all on function public.ingest_client_events(jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.ingest_client_events(jsonb) to anon;

notify pgrst, 'reload schema';

commit;
