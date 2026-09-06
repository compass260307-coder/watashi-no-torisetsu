-- Protect browser bundles that still POST directly to /rest/v1/events while the
-- RPC-capable bundle propagates through already-open tabs and in-app browsers.
--
-- Direct anonymous inserts are rate limited for 24 hours. After that grace
-- period they are quietly skipped (HTTP success with zero inserted rows), so
-- old clients never fall back to Vercel's /api/event endpoint. The RPC and all
-- service-role/server inserts bypass this compatibility trigger.

begin;

alter table private.event_ingest_settings
  add column if not exists legacy_direct_insert_until timestamptz;

update private.event_ingest_settings
set
  enforce_ip = true,
  legacy_direct_insert_until = coalesce(
    legacy_direct_insert_until,
    clock_timestamp() + interval '24 hours'
  )
where singleton;

-- Mark inserts performed by the validated RPC. The setting is transaction-local
-- and cannot be supplied by a browser request, so the compatibility trigger can
-- distinguish the RPC from the legacy table endpoint without trusting a header.
create or replace function public.ingest_client_events(p_events jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_headers jsonb;
  v_trusted_ip text;
begin
  perform set_config('app.client_event_rpc', '1', true);

  v_headers := coalesce(
    nullif(current_setting('request.headers', true), ''),
    '{}'
  )::jsonb;

  v_trusted_ip := btrim(coalesce(v_headers ->> 'cf-connecting-ip', ''));

  if v_trusted_ip = '' then
    -- Never trust a caller-supplied X-Forwarded-For value. If the hosted
    -- gateway ever stops providing CF-Connecting-IP, the session limit still
    -- applies and legitimate analytics are not redirected through Vercel.
    v_headers := v_headers - 'x-forwarded-for';
  else
    v_headers := jsonb_set(
      v_headers,
      '{x-forwarded-for}',
      to_jsonb(v_trusted_ip),
      true
    );
  end if;

  perform set_config('request.headers', v_headers::text, true);
  return public.ingest_client_events_impl(p_events);
end;
$function$;

revoke all on function public.ingest_client_events(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_client_events(jsonb) to anon;

create or replace function private.guard_legacy_client_event_insert()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;

  v_claims_text text;
  v_claims jsonb;
  v_request_role text;
  v_request_path text;

  v_headers_text text;
  v_headers jsonb;
  v_ip_text text;
  v_client_ip inet;

  v_hash_salt text;
  v_session_limit integer;
  v_ip_limit integer;
  v_enforce_ip boolean;
  v_legacy_until timestamptz;

  v_session_hash text;
  v_ip_hash text;
  v_session_count bigint;
  v_ip_count bigint;
  v_batch_session_id text;
begin
  -- The current client uses the validated RPC. Keep this first so RPC batches
  -- incur no per-row compatibility-trigger work and are not counted twice.
  if coalesce(current_setting('app.client_event_rpc', true), '') = '1' then
    return new;
  end if;

  -- Fail open unless both trusted PostgREST values identify the exact legacy
  -- anonymous table endpoint. This prevents service-role checkout, webhook, and
  -- LINE/Alice events from ever being silently discarded.
  v_claims_text := current_setting('request.jwt.claims', true);
  v_request_path := split_part(
    coalesce(current_setting('request.path', true), ''),
    '?',
    1
  );

  begin
    if v_claims_text is null or btrim(v_claims_text) = '' then
      return new;
    end if;

    v_claims := v_claims_text::jsonb;
    v_request_role := v_claims ->> 'role';
  exception
    when others then
      return new;
  end;

  if v_request_role is distinct from 'anon' then
    return new;
  end if;

  if v_request_path not in ('events', '/events', '/rest/v1/events') then
    return new;
  end if;

  -- Once one row in a confirmed legacy batch is rejected, skip its remaining
  -- rows without repeatedly touching rate-limit counters. This check comes
  -- after role/path detection so service-role work can never inherit the flag.
  if coalesce(
    current_setting('app.legacy_event_drop_remaining', true),
    ''
  ) = '1' then
    return null;
  end if;

  select
    settings.hash_salt,
    settings.session_limit_per_minute,
    settings.ip_limit_per_minute,
    settings.enforce_ip,
    settings.legacy_direct_insert_until
  into
    v_hash_salt,
    v_session_limit,
    v_ip_limit,
    v_enforce_ip,
    v_legacy_until
  from private.event_ingest_settings as settings
  where settings.singleton;

  if not found then
    perform set_config('app.legacy_event_drop_remaining', '1', true);
    return null;
  end if;

  -- After the grace period, old bundles receive a successful PostgREST response
  -- but no longer create rows or perform counter writes. That avoids both data
  -- abuse and a burst of fallback traffic through Vercel.
  if v_legacy_until is null or v_now >= v_legacy_until then
    perform set_config('app.legacy_event_drop_remaining', '1', true);
    return null;
  end if;

  if
    new.session_id is null
    or char_length(new.session_id) not between 1 and 128
    or new.session_id !~ '^[A-Za-z0-9_-]+$'
  then
    perform set_config('app.legacy_event_drop_remaining', '1', true);
    return null;
  end if;

  -- The current client and every known legacy bundle send one session per
  -- batch. Enforcing that invariant prevents opposite session lock orders in a
  -- crafted multi-row request from creating a counter deadlock.
  v_batch_session_id := current_setting(
    'app.legacy_event_session_id',
    true
  );

  if coalesce(v_batch_session_id, '') = '' then
    perform set_config(
      'app.legacy_event_session_id',
      new.session_id,
      true
    );
  elsif v_batch_session_id <> new.session_id then
    perform set_config('app.legacy_event_drop_remaining', '1', true);
    return null;
  end if;

  v_headers_text := current_setting('request.headers', true);

  begin
    if v_headers_text is not null and btrim(v_headers_text) <> '' then
      v_headers := v_headers_text::jsonb;
      v_ip_text := btrim(coalesce(v_headers ->> 'cf-connecting-ip', ''));

      if v_ip_text <> '' then
        v_client_ip := v_ip_text::inet;
      end if;
    end if;
  exception
    when others then
      v_client_ip := null;
  end;

  -- The production gateway supplies CF-Connecting-IP and rejects caller
  -- overrides. If that trusted value disappears, fail closed only for this
  -- legacy browser endpoint; the RPC still applies its session limit.
  if v_client_ip is null and v_enforce_ip then
    perform set_config('app.legacy_event_drop_remaining', '1', true);
    return null;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / 60) * 60
  );

  v_session_hash := encode(
    sha256(
      convert_to(
        v_hash_salt || chr(31) || 'session' || chr(31) || new.session_id,
        'UTF8'
      )
    ),
    'hex'
  );

  -- Lock order matches ingest_client_events_impl: IP first, then session.
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
    values ('ip-60s', v_ip_hash, v_window_start, 1, v_now)
    on conflict (scope, identifier_hash, window_started_at)
    do update set
      event_count = current_bucket.event_count + 1,
      updated_at = excluded.updated_at
    returning event_count into v_ip_count;

    if v_enforce_ip and v_ip_count > v_ip_limit then
      perform set_config('app.legacy_event_drop_remaining', '1', true);
      return null;
    end if;
  end if;

  insert into private.event_ingest_rate_limits as current_bucket (
    scope,
    identifier_hash,
    window_started_at,
    event_count,
    updated_at
  )
  values ('session-60s', v_session_hash, v_window_start, 1, v_now)
  on conflict (scope, identifier_hash, window_started_at)
  do update set
    event_count = current_bucket.event_count + 1,
    updated_at = excluded.updated_at
  returning event_count into v_session_count;

  if v_session_count > v_session_limit then
    perform set_config('app.legacy_event_drop_remaining', '1', true);
    return null;
  end if;

  return new;
end;
$function$;

revoke all on function private.guard_legacy_client_event_insert()
  from public, anon, authenticated, service_role;

drop trigger if exists guard_legacy_client_event_insert on public.events;

create trigger guard_legacy_client_event_insert
before insert on public.events
for each row execute function private.guard_legacy_client_event_insert();

notify pgrst, 'reload schema';

commit;
