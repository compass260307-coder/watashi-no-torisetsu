-- Phase 1. Additive, service-role-only aggregate exports. Never export identities.
begin;

create table public.hyper_report_dirty_dates (
  date date primary key,
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.hyper_report_dirty_dates enable row level security;
revoke all on public.hyper_report_dirty_dates from public, anon, authenticated;
grant all on public.hyper_report_dirty_dates to service_role;

-- Existing event_name indexes narrow to follows but do not key the LINE user.
-- Keep lookup cost bounded when an existing user's attribution/link changes.
-- Production: precreate CONCURRENTLY with the standalone operations script and
-- verify its definition/indisvalid first. Do not rebuild it in this transaction.
create index if not exists idx_events_hyper_line_follow_user_created
  on public.events ((metadata->>'line_user_id'), created_at)
  where event_name='line_follow';

create function public.hyper_report_mark_date(p_at timestamptz)
returns void language sql security definer set search_path = '' as $$
  insert into public.hyper_report_dirty_dates(date, changed_at)
  select (p_at at time zone 'Asia/Tokyo')::date, clock_timestamp()
  where p_at is not null
  on conflict (date) do update set changed_at = excluded.changed_at;
$$;

create function public.hyper_report_track_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb; uid uuid; payment record;
begin
  -- Mark BOTH old and new dates, including deleted facts and moved attribution.
  for r in select x from unnest(array[
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  ]) x where x is not null loop
    if tg_table_name = 'users' then
      perform public.hyper_report_mark_date((r->>'diagnosis_completed_at')::timestamptz);
      -- A newly inserted user cannot have related facts. Do not delay diagnosis
      -- saves with payment/subscription/follow searches on the INSERT path.
      if tg_op = 'INSERT' then continue; end if;
      uid := (r->>'id')::uuid;
      for payment in select coalesce(paid_at,created_at) at from public.payment_history where user_id=uid loop
        perform public.hyper_report_mark_date(payment.at);
      end loop;
      for payment in select created_at at from public.line_plus_subscriptions where user_id=uid
        union select e.created_at from public.events e join public.line_accounts a
          on a.line_user_id=e.metadata->>'line_user_id'
          where e.event_name='line_follow' and a.user_id=uid loop
        perform public.hyper_report_mark_date(payment.at);
      end loop;
    elsif tg_table_name = 'payment_history' then
      perform public.hyper_report_mark_date(coalesce((r->>'paid_at')::timestamptz,(r->>'created_at')::timestamptz));
    elsif tg_table_name = 'line_plus_subscriptions' then
      perform public.hyper_report_mark_date((r->>'created_at')::timestamptz);
    elsif tg_table_name = 'events' and r->>'event_name' = 'line_follow' then
      perform public.hyper_report_mark_date((r->>'created_at')::timestamptz);
    elsif tg_table_name = 'line_accounts' then
      for payment in select created_at at from public.events
        where event_name='line_follow' and metadata->>'line_user_id'=r->>'line_user_id' loop
        perform public.hyper_report_mark_date(payment.at);
      end loop;
    end if;
  end loop;
  return null;
end;
$$;

create trigger hyper_report_users_insert_delete after insert or delete on public.users
for each row execute function public.hyper_report_track_change();
create trigger hyper_report_users_update after update on public.users
for each row when (row(old.diagnosis_completed_at,old.acquisition_locale,old.acquisition_source,old.acquisition_medium,old.acquisition_campaign,old.campaign)
  is distinct from row(new.diagnosis_completed_at,new.acquisition_locale,new.acquisition_source,new.acquisition_medium,new.acquisition_campaign,new.campaign))
execute function public.hyper_report_track_change();
create trigger hyper_report_payments after insert or update or delete on public.payment_history
for each row execute function public.hyper_report_track_change();
create trigger hyper_report_subscriptions after insert or update or delete on public.line_plus_subscriptions
for each row execute function public.hyper_report_track_change();
create trigger hyper_report_line_accounts after insert or update or delete on public.line_accounts
for each row execute function public.hyper_report_track_change();
create trigger hyper_report_follows_insert after insert on public.events
for each row when (new.event_name='line_follow') execute function public.hyper_report_track_change();
create trigger hyper_report_follows_update after update on public.events
for each row when (old.event_name='line_follow' or new.event_name='line_follow') execute function public.hyper_report_track_change();
create trigger hyper_report_follows_delete after delete on public.events
for each row when (old.event_name='line_follow') execute function public.hyper_report_track_change();

create function public.hyper_report_plan(p_since timestamptz default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('as_of',statement_timestamp(), 'today',(now() at time zone 'Asia/Tokyo')::date,
    'dates',coalesce((select jsonb_agg(jsonb_build_object('date',date,'version',changed_at) order by date)
      from public.hyper_report_dirty_dates), '[]'::jsonb));
$$;

-- Returns one complete day, hourly buckets included. jsonb avoids PostgREST's
-- default 1000-row table limit silently truncating an export.
create function public.hyper_report_day(p_date date, p_fx jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; start_at timestamptz; end_at timestamptz;
begin
  if p_date is null then raise exception 'date is required'; end if;
  start_at := p_date::timestamp at time zone 'Asia/Tokyo';
  end_at := (p_date+1)::timestamp at time zone 'Asia/Tokyo';
  -- amount_jpy is historically named: KRW is won, USD is cents.
  if exists (select 1 from public.payment_history p join public.users u on u.id=p.user_id
    where coalesce(p.paid_at,p.created_at)>=start_at and coalesce(p.paid_at,p.created_at)<end_at
      and p.status in ('completed','refunded') and p.stripe_session_id not like 'cs_test_%'
      and u.acquisition_locale in ('ja','ko','en') and lower(p.currency)<>'jpy'
      and (lower(p.currency) not in ('krw','usd') or coalesce((p_fx->>lower(p.currency))::numeric,0)<=0))
  then raise exception 'HYPER_REPORT_FX_JPY_PER_UNIT: missing currency rate'; end if;

  with facts as (
    select diagnosis_completed_at at, id user_id, 1::bigint diagnoses, 0::bigint purchases_full,
      0::bigint purchases_upsell, 0::bigint purchases_total, 0::numeric revenue_jpy,
      0::bigint line_follows, 0::bigint sub_starts
    from public.users where diagnosis_completed_at>=start_at and diagnosis_completed_at<end_at
    union all
    select coalesce(p.paid_at,p.created_at), p.user_id,0,
      case when p.payment_kind='full_access' then 1 else 0 end,
      case when p.payment_kind<>'full_access' or p.payment_kind is null then 1 else 0 end,1,
      greatest(p.amount_jpy-coalesce(p.amount_refunded_minor,0),0)::numeric
        / case when lower(p.currency)='usd' then 100 else 1 end
        * case when lower(p.currency)='jpy' then 1 else (p_fx->>lower(p.currency))::numeric end,0,0
    from public.payment_history p
    where coalesce(p.paid_at,p.created_at)>=start_at and coalesce(p.paid_at,p.created_at)<end_at
      and p.status in ('completed','refunded') and p.stripe_session_id not like 'cs_test_%'
    union all
    select e.created_at, a.user_id,0,0,0,0,0,1,0
    from public.events e left join public.line_accounts a on a.line_user_id=e.metadata->>'line_user_id'
    where e.event_name='line_follow' and e.created_at>=start_at and e.created_at<end_at
    union all
    select s.created_at,s.user_id,0,0,0,0,0,0,1 from public.line_plus_subscriptions s
    where s.created_at>=start_at and s.created_at<end_at
      and s.stripe_subscription_id like 'sub_%'
  ), buckets as (
    select extract(hour from f.at at time zone 'Asia/Tokyo')::integer as "hour",
      case coalesce(u.acquisition_locale,'ja') when 'ja' then 'jp' when 'ko' then 'kr' when 'en' then 'us' end country,
      coalesce(u.acquisition_source,'') source, coalesce(u.acquisition_medium,'') medium,
      coalesce(u.acquisition_campaign,u.campaign,'') campaign,
      sum(f.diagnoses) diagnoses,sum(f.purchases_full) purchases_full,
      sum(f.purchases_upsell) purchases_upsell,sum(f.purchases_total) purchases_total,
      sum(f.revenue_jpy) revenue_jpy,sum(f.line_follows) line_follows,sum(f.sub_starts) sub_starts
    from facts f left join public.users u on u.id=f.user_id
    where u.acquisition_locale in ('ja','ko','en') or f.user_id is null
    group by 1,2,3,4,5
  ), daily as (
    select p_date date,country,source,medium,campaign,sum(diagnoses) diagnoses,
      sum(purchases_full) purchases_full,sum(purchases_upsell) purchases_upsell,
      sum(purchases_total) purchases_total,round(sum(revenue_jpy),2) revenue_jpy,
      sum(line_follows) line_follows,sum(sub_starts) sub_starts,
      0 ad_spend_jpy,0 impressions,0 clicks,statement_timestamp() updated_at
    from buckets group by country,source,medium,campaign
  ), hourly as (
    select p_date date,"hour",country,source,medium,campaign,diagnoses,purchases_total,
      round(revenue_jpy,2) revenue_jpy,0 ad_spend_jpy,statement_timestamp() updated_at from buckets
  ) select jsonb_build_object('date',p_date,
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by country,source,medium,campaign) from daily d),'[]'::jsonb),
    'hourly',coalesce((select jsonb_agg(to_jsonb(h) order by "hour",country,source,medium,campaign) from hourly h),'[]'::jsonb)) into result;
  return result;
end;
$$;

revoke all on function public.hyper_report_mark_date(timestamptz) from public, anon, authenticated;
revoke all on function public.hyper_report_track_change() from public, anon, authenticated;
revoke all on function public.hyper_report_plan(timestamptz) from public, anon, authenticated;
revoke all on function public.hyper_report_day(date,jsonb) from public, anon, authenticated;
grant execute on function public.hyper_report_plan(timestamptz),public.hyper_report_day(date,jsonb) to service_role;
commit;
