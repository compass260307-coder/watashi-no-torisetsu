-- Extend locale persistence and client-event ingestion for the Indonesian launch.
-- Apply this migration before deploying the application code that writes locale='id'.

alter table public.users
  drop constraint if exists users_acquisition_locale_check;

alter table public.users
  add constraint users_acquisition_locale_check
  check (acquisition_locale in ('ja', 'ko', 'en', 'id'));

alter table public.users
  drop constraint if exists users_preferred_locale_check;

alter table public.users
  add constraint users_preferred_locale_check
  check (preferred_locale in ('ja', 'ko', 'en', 'id'));

alter table public.events
  drop constraint if exists events_locale_check;

alter table public.events
  add constraint events_locale_check
  check (locale in ('ja', 'ko', 'en', 'id'));

-- Preserve the current RPC body and expand only its locale allow-list.
do $migration$
declare
  function_definition text;
  updated_definition text;
begin
  select pg_get_functiondef('public.ingest_client_events_impl(jsonb)'::regprocedure)
    into function_definition;

  updated_definition := replace(
    function_definition,
    'v_locale not in (''ja'', ''ko'', ''en'')',
    'v_locale not in (''ja'', ''ko'', ''en'', ''id'')'
  );

  if updated_definition = function_definition then
    raise exception 'ingest_client_events_impl locale validation pattern was not found';
  end if;

  execute updated_definition;
end
$migration$;
