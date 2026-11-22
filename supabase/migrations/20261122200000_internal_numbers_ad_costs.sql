-- 社内向け数値画面 (/internal/numbers) の第3段: 広告費・利益・CPA。
--
-- 広告費は数値画面から入れる (スプレッドシートには 2026-11-16 までしか実績が無く、
-- 管理画面からの取得が止まっているため)。
--   * X: 管理画面の時間別エクスポートを画面に置く。キャンペーン名のアカウント記号から
--     アカウントを判別し、アカウントのタイムゾーンの時刻を日本時間に直して保存する。
--   * そのほかの媒体: 日別の金額を手で入れる。
--   * 配信計画: 時間帯ごとの予算を手で入れる。実績が入っていない時間帯の広告費を、
--     この金額で補う (画面には「推定」と出す)。1 日の着地見込みは出さない
--     (2026-11-22 本人の指定)。
--
-- 利益の定義は利益ダッシュボードの「参考利益」に合わせる:
--   純売上 − 決済手数料 − サーバー費の概算 − AI費の概算 − 広告費
--
-- すべて service_role 専用。

begin;

-- 広告アカウント。code はキャンペーン名 (MMDD_PULSE24h_{code}{単価}_...) の記号。
create table if not exists public.ad_accounts (
  code text primary key check (code ~ '^[A-Z]{1,6}$'),
  name text not null,
  medium text not null default 'x' check (medium in ('x', 'tiktok', 'meta', 'other')),
  -- 管理画面のエクスポートの時刻が、どのタイムゾーンか。
  timezone text not null,
  -- どの言語版の広告か。数値画面は言語ごとに集計する。
  locale text not null default 'ja' check (locale in ('ja', 'ko', 'en', 'id')),
  updated_at timestamptz not null default now()
);

-- 時間別の実績 (日本時間)。エクスポートを置くたびに、含まれる時間帯を上書きする。
create table if not exists public.ad_spend_hourly (
  day date not null,
  hour smallint not null check (hour between 0 and 23),
  account text not null references public.ad_accounts (code),
  spend_jpy numeric(12, 2) not null check (spend_jpy >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  leads integer not null default 0 check (leads >= 0),
  purchases integer not null default 0 check (purchases >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, hour, account)
);

-- 日別の実績 (手入力)。時間別の実績が無い媒体・日に使う。
create table if not exists public.ad_spend_daily (
  day date not null,
  medium text not null check (medium in ('x', 'tiktok', 'meta', 'other')),
  locale text not null default 'ja' check (locale in ('ja', 'ko', 'en', 'id')),
  spend_jpy numeric(12, 2) not null check (spend_jpy >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, medium, locale)
);

-- 配信計画 (時間別の予算、媒体ごと・全アカウントの合計)。effective_from 以降の日に、
-- 次の計画が始まるまで使う。
create table if not exists public.ad_plan_hourly (
  effective_from date not null,
  medium text not null check (medium in ('x', 'tiktok', 'meta', 'other')),
  locale text not null default 'ja' check (locale in ('ja', 'ko', 'en', 'id')),
  hour smallint not null check (hour between 0 and 23),
  amount_jpy numeric(12, 2) not null check (amount_jpy >= 0),
  updated_at timestamptz not null default now(),
  primary key (effective_from, medium, locale, hour)
);

-- 利益の概算に使う単価。実際の値はデータベースに入れる (このリポジトリは公開なので、
-- 事業の数値をファイルに書かない)。
create table if not exists public.internal_numbers_settings (
  singleton boolean primary key default true check (singleton),
  fee_rate numeric(6, 4) not null default 0,
  server_cost_per_diagnosis numeric(10, 4) not null default 0,
  ai_cost_per_purchase numeric(10, 4) not null default 0,
  ai_cost_per_upgrade numeric(10, 4) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.internal_numbers_settings (singleton) values (true)
on conflict (singleton) do nothing;

-- 広告アカウントと配信計画は、数値画面の「広告費を入れる」から登録する
-- (本番には 2026-11-22 に登録済み。公開リポジトリには書かない)。

alter table public.ad_accounts enable row level security;
alter table public.ad_spend_hourly enable row level security;
alter table public.ad_spend_daily enable row level security;
alter table public.ad_plan_hourly enable row level security;
alter table public.internal_numbers_settings enable row level security;

revoke all on table
  public.ad_accounts,
  public.ad_spend_hourly,
  public.ad_spend_daily,
  public.ad_plan_hourly,
  public.internal_numbers_settings
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.ad_accounts,
  public.ad_spend_hourly,
  public.ad_spend_daily,
  public.ad_plan_hourly,
  public.internal_numbers_settings
to service_role;

-- エクスポート 1 ファイル分の時間別の実績を保存する。ファイルが含む期間 (最初の時間帯から
-- 最後の時間帯まで) の、そのアカウントの行を入れ替える。同じファイルを置き直しても、
-- あとから数字が直ったファイルを置いても、二重にならない。戻り値は保存した行数。
create or replace function public.ad_spend_replace(p_account text, p_rows jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $function$
declare
  v_first timestamp;
  v_last timestamp;
  v_count integer;
begin
  if not exists (select 1 from ad_accounts as a where a.code = p_account) then
    raise exception 'unknown account' using errcode = '22023';
  end if;
  select
    min((r.value ->> 'day')::date + (r.value ->> 'hour')::integer * interval '1 hour'),
    max((r.value ->> 'day')::date + (r.value ->> 'hour')::integer * interval '1 hour')
    into v_first, v_last
    from jsonb_array_elements(p_rows) as r;
  if v_first is null then
    return 0;
  end if;

  delete from ad_spend_hourly as s
   where s.account = p_account
     and s.day + s.hour * interval '1 hour' between v_first and v_last;

  insert into ad_spend_hourly (
    day, hour, account, spend_jpy, impressions, clicks, leads, purchases
  )
  select
    (r.value ->> 'day')::date,
    (r.value ->> 'hour')::smallint,
    p_account,
    (r.value ->> 'spend')::numeric(12, 2),
    coalesce((r.value ->> 'impressions')::integer, 0),
    coalesce((r.value ->> 'clicks')::integer, 0),
    coalesce((r.value ->> 'leads')::integer, 0),
    coalesce((r.value ->> 'purchases')::integer, 0)
  from jsonb_array_elements(p_rows) as r;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- 1 日分 (JST) の広告費を、時間別に出す。媒体 × 時間帯ごとに、次の順で決める。
--   1. 時間別の実績 (エクスポート) がある時間帯 → 実績
--   2. その媒体に時間別の実績が 1 つも無く、日別の金額がある → その金額を、配信計画の
--      時間帯の比で割る (計画が無ければ 24 等分)。これも実績として扱う
--   3. どちらも無い時間帯 → その日に有効な配信計画の金額 (推定)。計画も無ければ 0
-- 各時間帯の actual が実績、plan が推定で、cost はその合計。
create or replace function public.internal_numbers_costs(p_day date, p_locale text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with hours as (
    select generate_series(0, 23) as h
  ),
  hourly_rows as (
    select a.medium, s.account, s.hour as h, s.spend_jpy as spend
      from ad_spend_hourly as s
      join ad_accounts as a on a.code = s.account
     where s.day = p_day
       and a.locale = p_locale
  ),
  hourly as (
    select r.medium, r.h, sum(r.spend) as spend
      from hourly_rows as r
     group by r.medium, r.h
  ),
  -- この日に有効な計画: 媒体ごとに、開始日が p_day 以前でいちばん新しいもの。
  plan as (
    select p.medium, p.hour as h, p.amount_jpy as amount
      from ad_plan_hourly as p
     where p.locale = p_locale
       and p.effective_from = (
         select max(q.effective_from)
           from ad_plan_hourly as q
          where q.medium = p.medium
            and q.locale = p_locale
            and q.effective_from <= p_day
       )
  ),
  daily as (
    -- 時間別の実績がある媒体は、そちらを使う (手入力と二重に数えない)。
    select
      d.medium,
      d.spend_jpy as spend,
      (select sum(p.amount) from plan as p where p.medium = d.medium) as plan_total
      from ad_spend_daily as d
     where d.day = p_day
       and d.locale = p_locale
       and d.medium not in (select distinct r.medium from hourly_rows as r)
  ),
  mediums as (
    select h.medium from hourly as h
    union
    select d.medium from daily as d
    union
    select p.medium from plan as p
  ),
  cells as (
    select
      m.medium,
      hours.h,
      case
        when hr.h is not null then hr.spend
        when d.medium is not null then
          d.spend * case
            when coalesce(d.plan_total, 0) > 0 then coalesce(p.amount, 0) / d.plan_total
            else 1 / 24.0
          end
        else 0
      end as actual,
      case
        when hr.h is null and d.medium is null then coalesce(p.amount, 0)
        else 0
      end as plan
    from mediums as m
    cross join hours
    left join hourly as hr on hr.medium = m.medium and hr.h = hours.h
    left join daily as d on d.medium = m.medium
    left join plan as p on p.medium = m.medium and p.h = hours.h
  ),
  account_last as (
    select r.account, max(r.h) as last_h from hourly_rows as r group by r.account
  )
  select jsonb_build_object(
    'hours', (
      select jsonb_agg(
        jsonb_build_object(
          'h', hours.h,
          'cost', round(coalesce(t.actual, 0) + coalesce(t.plan, 0), 2),
          'actual', round(coalesce(t.actual, 0), 2),
          'plan', round(coalesce(t.plan, 0), 2)
        )
        order by hours.h
      )
      from hours
      left join (
        select c.h, sum(c.actual) as actual, sum(c.plan) as plan
          from cells as c
         group by c.h
      ) as t on t.h = hours.h
    ),
    'mediums', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'medium', t.medium, 'actual', round(t.actual, 2), 'plan', round(t.plan, 2)
          )
          order by t.medium
        ),
        '[]'::jsonb
      )
      from (
        select c.medium, sum(c.actual) as actual, sum(c.plan) as plan
          from cells as c
         group by c.medium
      ) as t
    ),
    -- 実績 (時間別・日別のどちらか) が 1 つでも入っているか。0 円の実績と「未入力」を分ける。
    'has_actual', exists (select 1 from hourly_rows) or exists (select 1 from daily),
    -- 時間別の実績が入っている最後の時間帯。無ければ null。
    'actual_through_hour', (select max(r.h) from hourly_rows as r),
    'accounts_with_actual', (select count(*) from account_last),
    -- 直近 7 日に実績のあるアカウントの数。この日の分が一部のアカウントしか入っていない
    -- ことに気づくための目安。
    'accounts_recent', (
      select count(distinct s.account)
        from ad_spend_hourly as s
        join ad_accounts as a on a.code = s.account
       where a.locale = p_locale
         and s.day between p_day - 7 and p_day
    )
  );
$function$;

-- 数値画面の入口に、広告費と概算用の単価を足す。数字そのものは第2段の関数に任せ、
-- ここでは項目を足すだけにする (第2段の応答の形はそのまま)。
create or replace function public.internal_numbers_dashboard_with_costs(
  p_day date default null,
  p_compare_day date default null,
  p_locale text default 'ja'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
set statement_timeout = '25s'
as $function$
declare
  c_baseline_days constant integer := 7;
  v_payload jsonb;
  v_day date;
  v_compare date;
begin
  v_payload := internal_numbers_dashboard(p_day, p_compare_day, p_locale);
  v_day := (v_payload -> 'meta' ->> 'day')::date;
  v_compare := (v_payload -> 'meta' ->> 'compare_day')::date;
  return v_payload || jsonb_build_object(
    'costs', jsonb_build_object(
      'day', internal_numbers_costs(v_day, p_locale),
      'compare', internal_numbers_costs(v_compare, p_locale),
      -- 直近 7 日の、日ごとの時間別の広告費。
      'recent', (
        select coalesce(
          jsonb_object_agg(d.day::text, internal_numbers_costs(d.day, p_locale)),
          '{}'::jsonb
        )
        from (
          select (v_day - n)::date as day from generate_series(1, c_baseline_days) as n
        ) as d
      )
    ),
    'settings', (
      select jsonb_build_object(
        'fee_rate', s.fee_rate,
        'server_cost_per_diagnosis', s.server_cost_per_diagnosis,
        'ai_cost_per_purchase', s.ai_cost_per_purchase,
        'ai_cost_per_upgrade', s.ai_cost_per_upgrade
      )
      from internal_numbers_settings as s
    )
  );
end;
$function$;

-- 比べる相手として選んだ日の広告費 (1 日分)。
create or replace function public.internal_numbers_compare_day_with_costs(
  p_day date,
  p_locale text default 'ja'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
set statement_timeout = '25s'
as $function$
begin
  return internal_numbers_compare_day(p_day, p_locale) || jsonb_build_object(
    'costs', internal_numbers_costs(p_day, p_locale)
  );
end;
$function$;

revoke all on function public.ad_spend_replace(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_costs(date, text)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_dashboard_with_costs(date, date, text)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_compare_day_with_costs(date, text)
  from public, anon, authenticated;

grant execute on function public.ad_spend_replace(text, jsonb) to service_role;
grant execute on function public.internal_numbers_costs(date, text) to service_role;
grant execute on function public.internal_numbers_dashboard_with_costs(date, date, text)
  to service_role;
grant execute on function public.internal_numbers_compare_day_with_costs(date, text)
  to service_role;

commit;
