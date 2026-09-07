-- Supabase's public gateway provides CF-Connecting-IP and rejects attempts to
-- override it. X-Forwarded-For is client-settable on non-browser requests, so
-- normalize the internal implementation's input to the trusted header first.

begin;

alter function public.ingest_client_events(jsonb)
  rename to ingest_client_events_impl;

revoke all on function public.ingest_client_events_impl(jsonb)
  from public, anon, authenticated, service_role;

create function public.ingest_client_events(p_events jsonb)
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

notify pgrst, 'reload schema';

commit;
