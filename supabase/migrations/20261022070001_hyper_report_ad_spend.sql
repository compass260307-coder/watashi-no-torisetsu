-- Phase 2 depends on 20261022050000. No advertising writes or token storage.
begin;
create table public.ad_spend (
  platform text not null check (platform='tiktok'),
  account_id text not null,
  ad_id text not null,
  date date not null,
  hour integer not null check (hour between 0 and 23),
  country text not null check (country in ('jp','kr','us')),
  source text not null,
  ad_name text not null check (length(ad_name) between 1 and 1000),
  spend_jpy numeric not null check (spend_jpy>=0),
  impressions bigint not null check (impressions>=0),
  clicks bigint not null check (clicks>=0),
  updated_at timestamptz not null default now(),
  primary key (platform,account_id,ad_id,date,hour)
);
create index hyper_ad_spend_date on public.ad_spend(date);
create table public.hyper_ad_sync_state (
  account_id text primary key,
  country text not null check (country in ('jp','kr','us')),
  source text not null,
  active boolean not null default true,
  last_success_at timestamptz,
  failed boolean not null default false
);
create table public.hyper_ad_sync_lock (
  singleton boolean primary key default true check (singleton),
  lease uuid not null,
  expires_at timestamptz not null
);
alter table public.ad_spend enable row level security;
alter table public.hyper_ad_sync_state enable row level security;
alter table public.hyper_ad_sync_lock enable row level security;
revoke all on public.ad_spend,public.hyper_ad_sync_state,public.hyper_ad_sync_lock from public,anon,authenticated;
grant all on public.ad_spend,public.hyper_ad_sync_state,public.hyper_ad_sync_lock to service_role;

create function public.hyper_ad_spend_claim(p_lease uuid,p_accounts jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(p_accounts)<>'array' or jsonb_array_length(p_accounts) not between 1 and 5 then raise exception 'invalid accounts'; end if;
  if not pg_try_advisory_xact_lock(20261022,60000) then return false; end if;
  if exists(select 1 from public.hyper_ad_sync_lock where expires_at>clock_timestamp()) then return false; end if;
  insert into public.hyper_ad_sync_lock(singleton,lease,expires_at) values(true,p_lease,clock_timestamp()+interval '5 minutes')
    on conflict(singleton) do update set lease=excluded.lease,expires_at=excluded.expires_at;
  update public.hyper_ad_sync_state set active=false;
  insert into public.hyper_ad_sync_state(account_id,country,source,active)
    select account_id,country,source,true from jsonb_to_recordset(p_accounts) as x(account_id text,country text,source text)
    on conflict(account_id) do update set country=excluded.country,source=excluded.source,active=true;
  return true;
end;
$$;

create function public.hyper_ad_spend_replace(p_lease uuid,p_account text,p_start date,p_end date,p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare config public.hyper_ad_sync_state; d date;
begin
  perform 1 from public.hyper_ad_sync_lock where lease=p_lease and expires_at>clock_timestamp() for update;
  if not found then raise exception 'lease expired'; end if;
  select * into strict config from public.hyper_ad_sync_state where account_id=p_account and active;
  if p_start is null or p_end is null or p_end-p_start<>2 or jsonb_typeof(p_rows)<>'array' then raise exception 'invalid replacement'; end if;
  if exists(select 1 from jsonb_to_recordset(p_rows) x(date date) where x.date is null or x.date<p_start or x.date>p_end) then raise exception 'out of window'; end if;
  -- Delete+insert is one transaction; an empty complete report removes stale costs.
  -- A bad row/duplicate rolls the entire replacement back.
  delete from public.ad_spend where platform='tiktok' and account_id=p_account and date between p_start and p_end;
  insert into public.ad_spend(platform,account_id,ad_id,date,hour,country,source,ad_name,spend_jpy,impressions,clicks)
    select 'tiktok',p_account,x.ad_id,x.date,x.hour,config.country,config.source,x.ad_name,x.spend_jpy,x.impressions,x.clicks
      from jsonb_to_recordset(p_rows) x(ad_id text,date date,hour integer,ad_name text,spend_jpy numeric,impressions bigint,clicks bigint);
  update public.hyper_ad_sync_state set last_success_at=clock_timestamp(),failed=false where account_id=p_account;
  for d in select generate_series(p_start::timestamp,p_end::timestamp,interval '1 day')::date loop
    perform public.hyper_report_mark_date(d::timestamp at time zone 'Asia/Tokyo');
  end loop;
end;
$$;

create function public.hyper_ad_spend_failed(p_lease uuid,p_account text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.hyper_ad_sync_lock where lease=p_lease and expires_at>clock_timestamp() for update;
  if not found then raise exception 'lease expired'; end if;
  update public.hyper_ad_sync_state set failed=true where account_id=p_account and active;
end;
$$;
create function public.hyper_ad_spend_release(p_lease uuid)
returns void language sql security definer set search_path='' as $$
  delete from public.hyper_ad_sync_lock where lease=p_lease;
$$;
create function public.hyper_report_ad_status()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'source',case when count(*)=0 then '未接続（TikTok設定待ち・X承認待ち）' else 'TikTok Marketing API（X承認待ち）' end,
    'synced_at',case when count(*)=count(last_success_at) then min(last_success_at) else null end,
    'error',case when bool_or(failed) then '広告費の取得に失敗（前回値を保持）' when count(*)>count(last_success_at) then '広告費の初回取得待ち' else '' end)
  from public.hyper_ad_sync_state where active;
$$;

-- Keep the phase 1 fact aggregation unchanged and compose ad aggregates in SQL.
alter function public.hyper_report_day(date,jsonb) rename to hyper_report_organic_day;
create function public.hyper_report_day(p_date date,p_fx jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare base jsonb; result jsonb;
begin
  base:=public.hyper_report_organic_day(p_date,p_fx);
  with organic_daily as (
    select * from jsonb_to_recordset(base->'daily') x(date date,country text,source text,medium text,campaign text,
      diagnoses numeric,purchases_full numeric,purchases_upsell numeric,purchases_total numeric,revenue_jpy numeric,line_follows numeric,sub_starts numeric,ad_spend_jpy numeric,impressions numeric,clicks numeric,updated_at timestamptz)
  ), ads as (
    select a.*,
      -- Ads share the unique matching campaign's medium. For multiple media,
      -- prefer paid_social; otherwise use a separate paid_social key once.
      coalesce((select case when count(distinct medium)=1 then min(medium)
        when bool_or(medium='paid_social') then 'paid_social' else null end
        from organic_daily o where o.country=a.country and o.source=a.source and o.campaign=a.ad_name),'paid_social') medium
    from public.ad_spend a where a.date=p_date
  ), daily_union as (
    select * from organic_daily
    union all
    select date,country,source,medium,ad_name,0,0,0,0,0,0,0,spend_jpy,impressions,clicks,updated_at from ads
  ), daily as (
    select date,country,source,medium,campaign,sum(diagnoses) diagnoses,sum(purchases_full) purchases_full,
      sum(purchases_upsell) purchases_upsell,sum(purchases_total) purchases_total,sum(revenue_jpy) revenue_jpy,
      sum(line_follows) line_follows,sum(sub_starts) sub_starts,sum(ad_spend_jpy) ad_spend_jpy,
      sum(impressions) impressions,sum(clicks) clicks,max(updated_at) updated_at
    from daily_union group by date,country,source,medium,campaign
  ), hourly_union as (
    select * from jsonb_to_recordset(base->'hourly') x(date date,"hour" integer,country text,source text,medium text,campaign text,
      diagnoses numeric,purchases_total numeric,revenue_jpy numeric,ad_spend_jpy numeric,updated_at timestamptz)
    union all
    select date,"hour",country,source,medium,ad_name,0,0,0,spend_jpy,updated_at from ads
  ), hourly as (
    select date,"hour",country,source,medium,campaign,sum(diagnoses) diagnoses,sum(purchases_total) purchases_total,
      sum(revenue_jpy) revenue_jpy,sum(ad_spend_jpy) ad_spend_jpy,max(updated_at) updated_at
    from hourly_union group by date,"hour",country,source,medium,campaign
  ) select jsonb_build_object('date',p_date,'ad_status',public.hyper_report_ad_status(),
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by country,source,medium,campaign) from daily d),'[]'::jsonb),
    'hourly',coalesce((select jsonb_agg(to_jsonb(h) order by "hour",country,source,medium,campaign) from hourly h),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.hyper_ad_spend_claim(uuid,jsonb),public.hyper_ad_spend_replace(uuid,text,date,date,jsonb),
  public.hyper_ad_spend_failed(uuid,text),public.hyper_ad_spend_release(uuid),public.hyper_report_ad_status(),public.hyper_report_day(date,jsonb)
  from public,anon,authenticated;
grant execute on function public.hyper_ad_spend_claim(uuid,jsonb),public.hyper_ad_spend_replace(uuid,text,date,date,jsonb),
  public.hyper_ad_spend_failed(uuid,text),public.hyper_ad_spend_release(uuid),public.hyper_report_ad_status(),public.hyper_report_day(date,jsonb)
  to service_role;
commit;
