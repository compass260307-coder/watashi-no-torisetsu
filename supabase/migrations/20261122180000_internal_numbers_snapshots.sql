-- 社内向け数値画面 (/internal/numbers) の第2段。
--
--   * 終わった日の数字を控える (metrics_day_snapshots)。本番 DB は、キャッシュに載って
--     いない古い日の読み出しに 8〜19 秒かかる (2026-11-22 実測)。一度数えた結果を
--     控えておき、古い日は控えから出す。
--   * 直近 7 日の時間別の平均を返す (internal_numbers_baseline)。前日だけと比べると、
--     曜日の違いや、たまたまの上下をそのまま受けるため。
--   * 好きな日付と比べられるように、終わった日の 1 日分を返す入口を足す
--     (internal_numbers_compare_day)。
--   * 表示日と比較日の両方が古いと 1 回の呼び出しで数え切れないことがある。比較日は
--     時間が足りなければ次の呼び出しに回し、応答に compare_pending を立てる。
--
-- 応答の形は第1段と互換 (項目の追加だけ)。数え方は変えていない。

begin;

-- 終わった日の 1 日分の数字 (診断・売上・友達診断・シェア・流入元)。
-- イベント (ファネル) は metrics_event_hourly に別に持ち、出すときに足す。
create table if not exists public.metrics_day_snapshots (
  day date not null,
  locale text not null,
  payload jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (day, locale)
);

alter table public.metrics_day_snapshots enable row level security;
revoke all on table public.metrics_day_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.metrics_day_snapshots to service_role;

-- 1 日分の数字に、イベント (ファネル) の時間別件数とセッション数を足して返す。
-- 控えから出すときも、ここで最新の集計表の値に置き換える。
create or replace function public.internal_numbers_attach_events(
  p_block jsonb,
  p_day date,
  p_locale text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with bounds as (
    select p_day::timestamp at time zone 'Asia/Tokyo' as day_start
  ),
  events_by_hour as (
    select
      floor(extract(epoch from e.hour_start - (select day_start from bounds)) / 3600)::integer as h,
      sum(e.event_count) filter (where e.event_name = 'diagnosis_started') as started,
      sum(e.event_count) filter (where e.event_name = 'diagnosis_completed') as completed,
      sum(e.event_count) filter (where e.event_name = 'result_viewed') as result_viewed,
      sum(e.event_count) filter (where e.event_name = 'paywall_viewed' and e.placement = 'inline') as paywall_card,
      sum(e.event_count) filter (where e.event_name = 'paywall_viewed' and e.placement = 'modal') as paywall_modal,
      sum(e.event_count) filter (where e.event_name = 'purchase_cta_clicked') as cta,
      sum(e.event_count) filter (where e.event_name = 'checkout_session_created') as checkout,
      sum(e.event_count) filter (where e.event_name = 'purchase_completed') as paid,
      sum(e.event_count) filter (where e.event_name = 'purchase_completed' and e.product = 'full_access') as paid_full,
      sum(e.event_count) filter (where e.event_name = 'tako_viewed') as tako_viewed,
      sum(e.event_count) filter (where e.event_name = 'friend_invite_clicked') as invite_clicked,
      sum(e.event_count) filter (where e.event_name = 'friend_landing_viewed') as friend_landing,
      sum(e.event_count) filter (where e.event_name = 'friend_answer_completed') as friend_completed,
      sum(e.event_count) filter (where e.event_name = 'friend_to_diagnosis_clicked') as friend_to_self,
      sum(e.event_count) filter (where e.event_name = 'paywall_viewed' and e.page = 'tako') as tako_paywall,
      sum(e.event_count) filter (where e.event_name = 'purchase_cta_clicked' and e.page = 'tako') as tako_cta,
      sum(e.event_count) filter (where e.event_name = 'checkout_session_created' and e.return_to = 'tako' and e.product = 'full_access') as tako_checkout,
      sum(e.event_count) filter (where e.event_name = 'purchase_completed' and e.return_to = 'tako' and e.product = 'full_access') as tako_paid,
      sum(e.event_count) filter (where e.event_name = 'share_clicked') as share_clicked
    from metrics_event_hourly as e
    where e.hour_start >= (select day_start from bounds)
      and e.hour_start < (select day_start + interval '1 day' from bounds)
      and e.locale = p_locale
    group by 1
  ),
  hours as (
    select jsonb_agg(
      (item.value - 'events') || jsonb_build_object(
        'events',
        jsonb_build_object(
          'started', coalesce(e.started, 0),
          'completed', coalesce(e.completed, 0),
          'result_viewed', coalesce(e.result_viewed, 0),
          'paywall_card', coalesce(e.paywall_card, 0),
          'paywall_modal', coalesce(e.paywall_modal, 0),
          'cta', coalesce(e.cta, 0),
          'checkout', coalesce(e.checkout, 0),
          'paid', coalesce(e.paid, 0),
          'paid_full', coalesce(e.paid_full, 0),
          'tako_viewed', coalesce(e.tako_viewed, 0),
          'invite_clicked', coalesce(e.invite_clicked, 0),
          'friend_landing', coalesce(e.friend_landing, 0),
          'friend_completed', coalesce(e.friend_completed, 0),
          'friend_to_self', coalesce(e.friend_to_self, 0),
          'tako_paywall', coalesce(e.tako_paywall, 0),
          'tako_cta', coalesce(e.tako_cta, 0),
          'tako_checkout', coalesce(e.tako_checkout, 0),
          'tako_paid', coalesce(e.tako_paid, 0),
          'share_clicked', coalesce(e.share_clicked, 0)
        )
      )
      order by item.ordinality
    ) as hours
    from jsonb_array_elements(p_block -> 'hours') with ordinality as item
    left join events_by_hour as e on e.h = (item.value ->> 'h')::integer
  )
  select p_block || jsonb_build_object(
    'hours', (select hours.hours from hours),
    'sessions', (
      select coalesce(jsonb_object_agg(d.event_name, d.sessions), '{}'::jsonb)
        from metrics_funnel_daily as d
       where d.day = p_day
         and d.locale = p_locale
    )
  );
$function$;

-- 1 日分 (JST の p_day) の数字を、元の表から数えて返す。p_cut は「この時刻まで」の小計用
-- (今日なら現在時刻、比較日なら同じ経過時間の時刻)。数え方は第1段から変えていない。
create or replace function public.internal_numbers_day(
  p_day date,
  p_cut timestamptz,
  p_now timestamptz,
  p_locale text,
  p_with_sources boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set statement_timeout = '25s'
as $function$
declare
  c_ad_sources constant text[] := array['x', 'tiktok'];
  v_start timestamptz := p_day::timestamp at time zone 'Asia/Tokyo';
  v_end timestamptz := v_start + interval '1 day';
  -- シェアは診断のあと何日たってからでも数えるが、読む範囲は 31 日で打ち切る。
  v_share_until timestamptz := least(p_now, v_start + interval '31 days');
  v_hours jsonb;
  v_until_cut jsonb;
  v_sources jsonb := '[]'::jsonb;
  v_cohort jsonb;
begin
  with hours as (
    select generate_series(0, 23) as h
  ),
  diagnoses as (
    select
      floor(extract(epoch from u.diagnosis_completed_at - v_start) / 3600)::integer as h,
      count(*)::integer as diagnoses,
      (count(*) filter (
        where lower(btrim(coalesce(u.acquisition_source, ''))) = any (c_ad_sources)
      ))::integer as ad_diagnoses
    from users as u
    where u.acquisition_locale = p_locale
      and u.diagnosis_completed_at >= v_start
      and u.diagnosis_completed_at < v_end
    group by 1
  ),
  payments as (
    select
      coalesce(p.paid_at, p.created_at) as at,
      p.amount_jpy as gross,
      greatest(coalesce(p.amount_refunded_minor, 0), 0) as refunded,
      coalesce(nullif(p.metadata ->> 'product', ''), p.payment_kind, '') as product
    from payment_history as p
    where p.status in ('completed', 'refunded')
      and p.stripe_session_id not like 'cs\_test\_%'
      and lower(coalesce(p.currency, 'jpy')) = 'jpy'
      and coalesce(nullif(p.metadata ->> 'locale', ''), 'ja') = p_locale
      and coalesce(p.paid_at, p.created_at) >= v_start
      and coalesce(p.paid_at, p.created_at) < v_end
  ),
  sales as (
    select
      floor(extract(epoch from s.at - v_start) / 3600)::integer as h,
      sum(s.gross)::bigint as gross,
      sum(s.refunded)::bigint as refunded,
      sum(greatest(s.gross - s.refunded, 0))::bigint as net,
      count(*)::integer as purchases,
      (count(*) filter (where s.product = 'full_access'))::integer as purchases_full,
      (count(*) filter (where s.product = 'premium_bundle'))::integer as purchases_upgrade
    from payments as s
    group by 1
  )
  select jsonb_agg(
    jsonb_build_object(
      'h', hours.h,
      'diagnoses', coalesce(d.diagnoses, 0),
      'ad_diagnoses', coalesce(d.ad_diagnoses, 0),
      'gross', coalesce(s.gross, 0),
      'refunded', coalesce(s.refunded, 0),
      'net', coalesce(s.net, 0),
      'purchases', coalesce(s.purchases, 0),
      'purchases_full', coalesce(s.purchases_full, 0),
      'purchases_upgrade', coalesce(s.purchases_upgrade, 0)
    )
    order by hours.h
  )
  into v_hours
  from hours
  left join diagnoses as d on d.h = hours.h
  left join sales as s on s.h = hours.h;

  -- 「この時刻まで」の小計。昨日の同じ時刻までと比べるために、分単位で切る。
  select jsonb_build_object(
    'diagnoses', (
      select count(*)::integer
        from users as u
       where u.acquisition_locale = p_locale
         and u.diagnosis_completed_at >= v_start
         and u.diagnosis_completed_at < least(p_cut, v_end)
    ),
    'ad_diagnoses', (
      select count(*)::integer
        from users as u
       where u.acquisition_locale = p_locale
         and u.diagnosis_completed_at >= v_start
         and u.diagnosis_completed_at < least(p_cut, v_end)
         and lower(btrim(coalesce(u.acquisition_source, ''))) = any (c_ad_sources)
    )
  ) || (
    select jsonb_build_object(
      'gross', coalesce(sum(p.amount_jpy), 0)::bigint,
      'refunded', coalesce(sum(greatest(coalesce(p.amount_refunded_minor, 0), 0)), 0)::bigint,
      'net', coalesce(sum(greatest(p.amount_jpy - greatest(coalesce(p.amount_refunded_minor, 0), 0), 0)), 0)::bigint,
      'purchases', count(*)::integer,
      'purchases_full', (count(*) filter (
        where coalesce(nullif(p.metadata ->> 'product', ''), p.payment_kind, '') = 'full_access'
      ))::integer,
      'purchases_upgrade', (count(*) filter (
        where coalesce(nullif(p.metadata ->> 'product', ''), p.payment_kind, '') = 'premium_bundle'
      ))::integer
    )
    from payment_history as p
    where p.status in ('completed', 'refunded')
      and p.stripe_session_id not like 'cs\_test\_%'
      and lower(coalesce(p.currency, 'jpy')) = 'jpy'
      and coalesce(nullif(p.metadata ->> 'locale', ''), 'ja') = p_locale
      and coalesce(p.paid_at, p.created_at) >= v_start
      and coalesce(p.paid_at, p.created_at) < least(p_cut, v_end)
  )
  into v_until_cut;

  -- その日に診断した人を追跡する数字 (あとから増える)。
  with diagnosers as (
    select u.id, u.owner_token
      from users as u
     where u.acquisition_locale = p_locale
       and u.diagnosis_completed_at >= v_start
       and u.diagnosis_completed_at < v_end
  )
  select jsonb_build_object(
    'diagnosers', (select count(*)::integer from diagnosers),
    'friend_owners', (
      select count(*)::integer
        from diagnosers as d
       where exists (
         select 1 from friend_answers as fa where fa.user_id = d.id
       )
    ),
    -- シェア操作のイベント (旧 /api/metrics/social と同じ 6 種類)。イベント名は固定の文字で
    -- 1 つずつ書く。配列や変数で渡すと、実行計画が「期間中の全イベントを読む」形になり、
    -- 1 日 100 万行を超える日では時間切れになった (2026-11-22 本番で実測)。固定の文字なら
    -- (event_name, created_at, id) の索引で該当行だけを読む。
    'sharers', (
      select count(distinct d.id)::integer
        from (
          select e.owner_token
            from events as e
           where e.event_name = 'share_clicked'
             and e.created_at >= v_start
             and e.created_at < v_share_until
          union all
          select e.owner_token
            from events as e
           where e.event_name = 'share_click'
             and e.created_at >= v_start
             and e.created_at < v_share_until
          union all
          select e.owner_token
            from events as e
           where e.event_name = 'share_completed'
             and e.created_at >= v_start
             and e.created_at < v_share_until
          union all
          select e.owner_token
            from events as e
           where e.event_name = 'share_success'
             and e.created_at >= v_start
             and e.created_at < v_share_until
          union all
          select e.owner_token
            from events as e
           where e.event_name = 'friend_share_clicked'
             and e.created_at >= v_start
             and e.created_at < v_share_until
          union all
          select e.owner_token
            from events as e
           where e.event_name = 'friend_link_copied'
             and e.created_at >= v_start
             and e.created_at < v_share_until
        ) as s
        join diagnosers as d on d.owner_token = s.owner_token
    )
  )
  into v_cohort;

  if p_with_sources then
    with diagnosers as (
      select
        u.id,
        left(lower(btrim(coalesce(u.acquisition_source, ''))), 60) as source
      from users as u
      where u.acquisition_locale = p_locale
        and u.diagnosis_completed_at >= v_start
        and u.diagnosis_completed_at < v_end
    ),
    paid as (
      select
        p.user_id,
        sum(greatest(p.amount_jpy - greatest(coalesce(p.amount_refunded_minor, 0), 0), 0))::bigint as net
      from payment_history as p
      join diagnosers as d on d.id = p.user_id
      where p.status in ('completed', 'refunded')
        and p.stripe_session_id not like 'cs\_test\_%'
        and lower(coalesce(p.currency, 'jpy')) = 'jpy'
      group by p.user_id
    ),
    by_source as (
      select
        d.source,
        count(*)::integer as diagnoses,
        count(paid.user_id)::integer as purchasers,
        coalesce(sum(paid.net), 0)::bigint as net
      from diagnosers as d
      left join paid on paid.user_id = d.id
      group by d.source
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'source', s.source,
          'is_ad', s.source = any (c_ad_sources),
          'diagnoses', s.diagnoses,
          'purchasers', s.purchasers,
          'net', s.net
        )
        order by s.diagnoses desc, s.source
      ),
      '[]'::jsonb
    )
    into v_sources
    from by_source as s;
  end if;

  -- イベント (ファネル) の件数とセッション数は、集計表から足す。
  return internal_numbers_attach_events(
    jsonb_build_object(
      'day', p_day,
      'computed_at', p_now,
      'hours', v_hours,
      'until_cut', v_until_cut,
      'cohort', v_cohort,
      'sources', v_sources
    ),
    p_day,
    p_locale
  );
end;
$function$;

-- 時間別の数字を 1 日分に足し上げる (控えを 1 日分として出すときの小計)。
create or replace function public.internal_numbers_full_totals(p_hours jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select jsonb_build_object(
    'diagnoses', coalesce(sum((h.value ->> 'diagnoses')::bigint), 0),
    'ad_diagnoses', coalesce(sum((h.value ->> 'ad_diagnoses')::bigint), 0),
    'gross', coalesce(sum((h.value ->> 'gross')::bigint), 0),
    'refunded', coalesce(sum((h.value ->> 'refunded')::bigint), 0),
    'net', coalesce(sum((h.value ->> 'net')::bigint), 0),
    'purchases', coalesce(sum((h.value ->> 'purchases')::bigint), 0),
    'purchases_full', coalesce(sum((h.value ->> 'purchases_full')::bigint), 0),
    'purchases_upgrade', coalesce(sum((h.value ->> 'purchases_upgrade')::bigint), 0)
  )
  from jsonb_array_elements(p_hours) as h;
$function$;

-- まだ数えていない日の、0 だけの 1 日分 (イベントは集計表にある分を足す)。
create or replace function public.internal_numbers_empty_day(p_day date, p_locale text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select internal_numbers_attach_events(
    jsonb_build_object(
      'day', p_day,
      'computed_at', null,
      'hours', (
        select jsonb_agg(
          jsonb_build_object(
            'h', h, 'diagnoses', 0, 'ad_diagnoses', 0, 'gross', 0, 'refunded', 0,
            'net', 0, 'purchases', 0, 'purchases_full', 0, 'purchases_upgrade', 0
          )
          order by h
        )
        from generate_series(0, 23) as h
      ),
      'until_cut', jsonb_build_object(
        'diagnoses', 0, 'ad_diagnoses', 0, 'gross', 0, 'refunded', 0,
        'net', 0, 'purchases', 0, 'purchases_full', 0, 'purchases_upgrade', 0
      ),
      'cohort', jsonb_build_object('diagnosers', 0, 'friend_owners', 0, 'sharers', 0),
      'sources', '[]'::jsonb
    ),
    p_day,
    p_locale
  );
$function$;

-- 終わった日を元の表から数えて控える。戻り値はかかった時間 (ミリ秒)。
-- 古い日は遅い (8〜19 秒) ので、SQL Editor から 1 日ずつ流して埋めるのにも使う。
create or replace function public.metrics_snapshot_day(p_day date, p_locale text default 'ja')
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
set statement_timeout = '60s'
as $function$
declare
  v_started timestamptz := clock_timestamp();
  v_day_end timestamptz := (p_day::timestamp at time zone 'Asia/Tokyo') + interval '1 day';
  v_block jsonb;
begin
  if p_day is null or v_day_end > v_started then
    raise exception 'the day has not ended yet' using errcode = '22023';
  end if;
  v_block := internal_numbers_day(p_day, v_day_end, v_started, p_locale, true);
  insert into metrics_day_snapshots as s (day, locale, payload, computed_at)
  values (p_day, p_locale, v_block, v_started)
  on conflict (day, locale) do update
    set payload = excluded.payload,
        computed_at = excluded.computed_at;
  return (extract(epoch from clock_timestamp() - v_started) * 1000)::integer;
end;
$function$;

-- 1 日分の数字を、できるだけ速い方法で用意する。
--   * 今日と昨日: 元の表を直接数える (キャッシュに載っていて速い。昨日は今日の間も動く)。
--     昨日の分は、平均の元にするため 1 時間に 1 回控える。
--   * それより前: 控えがあれば控えから出す。無い・古いときだけ数え直す。
-- p_deadline を過ぎていて控えも無いときは null を返す (呼び出し側が次回に回す)。
create or replace function public.internal_numbers_block(
  p_day date,
  p_cut timestamptz,
  p_now timestamptz,
  p_locale text,
  p_today date,
  p_deadline timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $function$
declare
  v_day_end timestamptz := (p_day::timestamp at time zone 'Asia/Tokyo') + interval '1 day';
  v_full boolean := p_cut >= v_day_end;
  v_payload jsonb;
  v_computed_at timestamptz;
  v_block jsonb;
begin
  if p_day < p_today then
    select s.payload, s.computed_at
      into v_payload, v_computed_at
      from metrics_day_snapshots as s
     where s.day = p_day
       and s.locale = p_locale;
  end if;

  if p_day >= p_today - 1 or not v_full then
    v_block := internal_numbers_day(p_day, p_cut, p_now, p_locale, true);
    if p_day = p_today - 1
      and (v_computed_at is null or v_computed_at < p_now - interval '1 hour')
    then
      insert into metrics_day_snapshots as s (day, locale, payload, computed_at)
      values (
        p_day,
        p_locale,
        -- 控えは 1 日分として持つ (小計を「同じ時刻まで」で切ったままにしない)。
        v_block || jsonb_build_object(
          'until_cut', internal_numbers_full_totals(v_block -> 'hours')
        ),
        p_now
      )
      on conflict (day, locale) do update
        set payload = excluded.payload,
            computed_at = excluded.computed_at;
    end if;
    return v_block;
  end if;

  -- 2 日以上前の日。友達診断・シェア・返金はあとから少し動くので、直近 7 日は 1 日、
  -- それより前は 30 日たったら数え直す。
  if v_payload is not null and v_computed_at > p_now - (
    case when p_day >= p_today - 7 then interval '1 day' else interval '30 days' end
  ) then
    return internal_numbers_attach_events(v_payload, p_day, p_locale);
  end if;

  if p_deadline is not null and clock_timestamp() > p_deadline then
    -- 時間が足りない。古い控えがあればそれを出し、無ければ次の呼び出しに回す。
    if v_payload is null then
      return null;
    end if;
    return internal_numbers_attach_events(v_payload, p_day, p_locale);
  end if;

  v_block := internal_numbers_day(p_day, p_cut, p_now, p_locale, true);
  insert into metrics_day_snapshots as s (day, locale, payload, computed_at)
  values (p_day, p_locale, v_block, p_now)
  on conflict (day, locale) do update
    set payload = excluded.payload,
        computed_at = excluded.computed_at;
  return v_block;
end;
$function$;

-- p_day の前 p_days 日について、控えから時間別の平均を出す。
-- 控えのある日だけで平均し、何日分かを days で返す。
create or replace function public.internal_numbers_baseline(
  p_day date,
  p_locale text,
  p_days integer
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with days as (
    select s.day, s.payload
      from metrics_day_snapshots as s
     where s.locale = p_locale
       and s.day >= p_day - p_days
       and s.day < p_day
  ),
  hourly as (
    select
      (h.value ->> 'h')::integer as h,
      avg((h.value ->> 'diagnoses')::numeric) as diagnoses,
      avg((h.value ->> 'ad_diagnoses')::numeric) as ad_diagnoses,
      avg((h.value ->> 'gross')::numeric) as gross,
      avg((h.value ->> 'refunded')::numeric) as refunded,
      avg((h.value ->> 'net')::numeric) as net,
      avg((h.value ->> 'purchases')::numeric) as purchases,
      avg((h.value ->> 'purchases_full')::numeric) as purchases_full,
      avg((h.value ->> 'purchases_upgrade')::numeric) as purchases_upgrade
    from days
    cross join lateral jsonb_array_elements(days.payload -> 'hours') as h
    group by 1
  )
  select jsonb_build_object(
    'days', (select count(*) from days),
    'from', p_day - p_days,
    'to', p_day - 1,
    'hours', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'h', hourly.h,
            'diagnoses', round(hourly.diagnoses, 2),
            'ad_diagnoses', round(hourly.ad_diagnoses, 2),
            'gross', round(hourly.gross, 2),
            'refunded', round(hourly.refunded, 2),
            'net', round(hourly.net, 2),
            'purchases', round(hourly.purchases, 2),
            'purchases_full', round(hourly.purchases_full, 2),
            'purchases_upgrade', round(hourly.purchases_upgrade, 2)
          )
          order by hourly.h
        )
        from hourly
      ),
      '[]'::jsonb
    )
  );
$function$;

-- 画面が 1 回の呼び出しで使う入口。イベント集計を追いつかせてから、表示日・比較日・
-- 直近 7 日の平均を返す。
create or replace function public.internal_numbers_dashboard(
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
  v_started timestamptz := clock_timestamp();
  v_now timestamptz;
  v_today date := (v_started at time zone 'Asia/Tokyo')::date;
  v_day date := least(coalesce(p_day, v_today), v_today);
  v_compare date := coalesce(p_compare_day, v_day - 1);
  v_start timestamptz;
  v_compare_start timestamptz;
  v_cut timestamptz;
  v_compare_cut timestamptz;
  v_through timestamptz;
  v_compare_through timestamptz;
  v_day_block jsonb;
  v_compare_block jsonb;
  v_compare_pending boolean := false;
  v_fill date;
begin
  if p_locale is null or p_locale not in ('ja', 'ko', 'en', 'id') then
    raise exception 'invalid locale' using errcode = '22023';
  end if;
  if v_compare >= v_day then
    v_compare := v_day - 1;
  end if;

  v_through := metrics_refresh_events(v_day);
  v_compare_through := metrics_refresh_events(v_compare);

  v_now := clock_timestamp();
  v_start := v_day::timestamp at time zone 'Asia/Tokyo';
  v_compare_start := v_compare::timestamp at time zone 'Asia/Tokyo';
  v_cut := least(v_now, v_start + interval '1 day');
  v_compare_cut := v_compare_start + (v_cut - v_start);

  -- 表示日は必ず用意する。比較日は、ここまでで時間を使いすぎていたら次の呼び出しに回す
  -- (古い日は 1 日分に 8〜19 秒かかることがあり、2 日分を 1 回で数えると時間切れになる)。
  v_day_block := internal_numbers_block(v_day, v_cut, v_now, p_locale, v_today, null);
  v_compare_block := internal_numbers_block(
    v_compare, v_compare_cut, v_now, p_locale, v_today,
    v_started + (
      coalesce(nullif(current_setting('metrics.compare_deadline_ms', true), '')::numeric, 8000)
      / 1000.0
    ) * interval '1 second'
  );
  if v_compare_block is null then
    v_compare_pending := true;
    v_compare_block := internal_numbers_empty_day(v_compare, p_locale);
  end if;

  -- 平均の元になる日のうち、直近 2 日 (まだキャッシュに載っていて速い) で控えの無い日を、
  -- 時間に余裕があれば 1 日だけ埋める。それより古い穴は埋めず、ある日だけで平均する。
  if clock_timestamp() < v_started + interval '3 seconds' then
    select d.day
      into v_fill
      from (select v_day - 1 as day union all select v_day - 2) as d
     where d.day < v_today
       and not exists (
         select 1 from metrics_day_snapshots as s
          where s.day = d.day and s.locale = p_locale
       )
     order by d.day desc
     limit 1;
    if v_fill is not null then
      perform metrics_snapshot_day(v_fill, p_locale);
    end if;
  end if;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'generated_at', v_now,
      'locale', p_locale,
      'day', v_day,
      'compare_day', v_compare,
      'is_today', v_day = v_today,
      'elapsed_seconds', floor(extract(epoch from v_cut - v_start))::integer,
      'events_through', v_through,
      'compare_events_through', v_compare_through,
      -- イベント (ファネル) の集計が、その日の終わりか今まで済んでいるか。false のときは
      -- 途中までの数字なので、画面はもう一度呼んで続きを数えさせる。
      'events_complete', coalesce(
        v_through >= least(v_started - interval '10 seconds', v_start + interval '1 day'),
        false
      ),
      -- 比較日をまだ数えていないときも false にする (第1段の画面も、これで呼び直す)。
      'compare_events_complete', not v_compare_pending and coalesce(
        v_compare_through >= least(v_started - interval '10 seconds', v_compare_start + interval '1 day'),
        false
      ),
      'compare_pending', v_compare_pending,
      'duration_ms', (extract(epoch from clock_timestamp() - v_started) * 1000)::integer
    ),
    'day', v_day_block,
    'compare', v_compare_block,
    'baseline', internal_numbers_baseline(v_day, p_locale, c_baseline_days)
  );
end;
$function$;

-- 比べる相手として選んだ、終わった日の 1 日分を返す (画面で好きな日付と比べるための入口)。
-- 数字は 1 日分。今日と同じ時刻までの小計は、画面側が時間別の数字から出す。
create or replace function public.internal_numbers_compare_day(
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
declare
  v_started timestamptz := clock_timestamp();
  v_today date := (v_started at time zone 'Asia/Tokyo')::date;
  v_day_end timestamptz;
  v_through timestamptz;
begin
  if p_locale is null or p_locale not in ('ja', 'ko', 'en', 'id') then
    raise exception 'invalid locale' using errcode = '22023';
  end if;
  if p_day is null or p_day >= v_today then
    raise exception 'the day has not ended yet' using errcode = '22023';
  end if;
  v_day_end := (p_day::timestamp at time zone 'Asia/Tokyo') + interval '1 day';
  v_through := metrics_refresh_events(p_day);
  return jsonb_build_object(
    'block', internal_numbers_block(
      p_day, v_day_end, clock_timestamp(), p_locale, v_today, null
    ),
    -- false のときはイベント (ファネル) がまだ途中。もう一度呼ぶと続きを数える。
    'events_complete', coalesce(v_through >= v_day_end, false)
  );
end;
$function$;

revoke all on function public.internal_numbers_attach_events(jsonb, date, text)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_day(date, timestamptz, timestamptz, text, boolean)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_full_totals(jsonb)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_empty_day(date, text)
  from public, anon, authenticated;
revoke all on function public.metrics_snapshot_day(date, text)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_block(date, timestamptz, timestamptz, text, date, timestamptz)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_baseline(date, text, integer)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_dashboard(date, date, text)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_compare_day(date, text)
  from public, anon, authenticated;

grant execute on function public.internal_numbers_attach_events(jsonb, date, text) to service_role;
grant execute on function public.internal_numbers_day(date, timestamptz, timestamptz, text, boolean)
  to service_role;
grant execute on function public.internal_numbers_full_totals(jsonb) to service_role;
grant execute on function public.internal_numbers_empty_day(date, text) to service_role;
grant execute on function public.metrics_snapshot_day(date, text) to service_role;
grant execute on function public.internal_numbers_block(date, timestamptz, timestamptz, text, date, timestamptz)
  to service_role;
grant execute on function public.internal_numbers_baseline(date, text, integer) to service_role;
grant execute on function public.internal_numbers_dashboard(date, date, text) to service_role;
grant execute on function public.internal_numbers_compare_day(date, text) to service_role;

commit;
