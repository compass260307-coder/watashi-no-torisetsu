-- Aggregate diagnosis question reach in one indexed database query instead of
-- issuing 50 exact-count requests from every admin/metrics invocation.

create index if not exists idx_events_question_reach_aggregate
  on public.events ((metadata ->> 'questionId'), locale, created_at)
  where event_name = 'diagnosis_question_answered';

create or replace function public.admin_question_reach(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_locale text default null
)
returns table(question_id integer, event_count bigint)
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '30s'
as $$
declare
  aggregate_sql text := $query$
    select
      (e.metadata ->> 'questionId')::integer as question_id,
      count(*)::bigint as event_count
    from public.events as e
    where e.event_name = 'diagnosis_question_answered'
      and (e.metadata ->> 'questionId') ~ '^[1-9][0-9]*$'
  $query$;
begin
  -- Add only the filters that are actually present. Keeping `p_from is null or`
  -- out of the final SQL lets PostgreSQL use its created_at/locale indexes for
  -- daily and locale-specific admin views. The uncached all-time aggregation
  -- can exceed Supabase's default 8-second API limit, so this read-only RPC has
  -- a bounded 30-second timeout; the caller caches that snapshot for 24 hours.
  if p_from is not null then
    aggregate_sql := aggregate_sql || ' and e.created_at >= $1';
  end if;
  if p_to is not null then
    aggregate_sql := aggregate_sql || ' and e.created_at <= $2';
  end if;
  if p_locale is not null then
    aggregate_sql := aggregate_sql || ' and e.locale = $3';
  end if;

  aggregate_sql := aggregate_sql ||
    ' group by (e.metadata ->> ''questionId'')::integer' ||
    ' order by (e.metadata ->> ''questionId'')::integer';

  return query execute aggregate_sql using p_from, p_to, p_locale;
end;
$$;

revoke all on function public.admin_question_reach(timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.admin_question_reach(timestamptz, timestamptz, text)
  to service_role;
