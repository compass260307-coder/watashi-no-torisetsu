-- 社内向け数値画面 (/internal/numbers) の第6段: 前日も控えから出す。
--
-- 画面を開くたびに、比べる相手の「前日の同じ時刻まで」を元の表から数え直していた。
-- 前日を元の表から数えると、何度呼んでも 1 回 8〜12 秒かかる (2026-11-24 本番で実測。
-- 2〜4 日前を同じ形で数えると 2 秒前後)。画面を開く・「更新」を押すたびに待たされていた。
--
-- ここでは次のように変える。数え方は変えていない。
--   * 終わった日 (前日を含む) は、控えがあれば控えから出す。「同じ時刻まで」の小計
--     (診断数・売上) だけは、分単位で切るため元の表から数える (1 日分の範囲を索引で読むだけ)。
--   * 前日の控えは、毎時 40 分の定期実行が 1 時間に 1 回作り直す (これまでは画面が作り直していた)。
--     友達診断・シェア・返金は、最大 1 時間ほど古い値になる。
--   * 前日の控えが 3 時間より古い (定期実行が止まっているなど) か、まだ無いときは、
--     これまでどおり元の表から数えて控え直す。

begin;

-- 1 日分 (JST の p_day) の「p_cut まで」の小計 (診断数・売上)。
-- internal_numbers_day の中にあった数え方を、そのまま取り出した。
create or replace function public.internal_numbers_until_cut(
  p_day date,
  p_cut timestamptz,
  p_locale text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with bounds as (
    select
      p_day::timestamp at time zone 'Asia/Tokyo' as day_start,
      least(p_cut, (p_day::timestamp at time zone 'Asia/Tokyo') + interval '1 day') as cut
  )
  select jsonb_build_object(
    'diagnoses', (
      select count(*)::integer
        from users as u
       where u.acquisition_locale = p_locale
         and u.diagnosis_completed_at >= (select day_start from bounds)
         and u.diagnosis_completed_at < (select cut from bounds)
    ),
    'ad_diagnoses', (
      select count(*)::integer
        from users as u
       where u.acquisition_locale = p_locale
         and u.diagnosis_completed_at >= (select day_start from bounds)
         and u.diagnosis_completed_at < (select cut from bounds)
         and lower(btrim(coalesce(u.acquisition_source, ''))) = any (array['x', 'tiktok'])
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
      and coalesce(p.paid_at, p.created_at) >= (select day_start from bounds)
      and coalesce(p.paid_at, p.created_at) < (select cut from bounds)
  );
$function$;

-- 小計の数え方を上の関数にまとめた (中身は第2段と同じ)。
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

  -- 「この時刻まで」の小計 (数え方は internal_numbers_until_cut にまとめた)。
  v_until_cut := internal_numbers_until_cut(p_day, p_cut, p_locale);

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

-- 1 日分の数字を、できるだけ速い方法で用意する。
--   * 今日: 元の表を直接数える。
--   * 終わった日: 控えがあれば控えから出す。「同じ時刻まで」の小計だけ元の表から数える。
--     前日の控えは定期実行が 1 時間に 1 回作り直す。3 時間より古ければ使わずに数え直す。
--   * 控えが無いとき: 前日と「同じ時刻まで」は元の表から数える (前日は控える)。
--     2 日以上前の 1 日分は数えて控える。
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
  if p_day >= p_today then
    return internal_numbers_day(p_day, p_cut, p_now, p_locale, true);
  end if;

  select s.payload, s.computed_at
    into v_payload, v_computed_at
    from metrics_day_snapshots as s
   where s.day = p_day
     and s.locale = p_locale;

  if v_payload is not null
    and (p_day < p_today - 1 or v_computed_at >= p_now - interval '3 hours')
  then
    if not v_full then
      v_payload := v_payload || jsonb_build_object(
        'until_cut', internal_numbers_until_cut(p_day, p_cut, p_locale)
      );
    end if;
    return internal_numbers_attach_events(v_payload, p_day, p_locale);
  end if;

  if p_day = p_today - 1 or not v_full then
    v_block := internal_numbers_day(p_day, p_cut, p_now, p_locale, true);
    if p_day = p_today - 1 then
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

  if p_deadline is not null and clock_timestamp() > p_deadline then
    -- 時間が足りない。次の呼び出しに回す。
    return null;
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

-- 定期実行の 1 単位 (第5段と同じ。前日の控えを 1 時間に 1 回作り直す条件だけ足した)。
create or replace function public.metrics_nightly_step(p_skip text[] default '{}')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $function$
declare
  c_locale constant text := 'ja';
  v_today date := (clock_timestamp() at time zone 'Asia/Tokyo')::date;
  v_today_start timestamptz := v_today::timestamp at time zone 'Asia/Tokyo';
  v_day date;
  v_t timestamptz := clock_timestamp();
begin
  -- 1. イベント (ファネル)。前日だけ (過去の日はさかのぼらない。古い日は元のイベントの行数が多く、まとめて読むと DB の負荷になる)。
  select d::date
    into v_day
    from generate_series(v_today - 1, v_today - 1, interval '-1 day') as d
   where not (('events:' || d::date) = any (p_skip))
     and not exists (
       select 1 from metrics_event_days as e
        where e.day = d::date
          and not e.is_partial
          and e.computed_through >= (d::date::timestamp at time zone 'Asia/Tokyo')
                                    + interval '1 day 5 minutes'
     )
   order by d desc
   limit 1;

  if v_day is not null then
    begin
      -- 14 日より前の日は、セッションの控え (metrics_event_session_seen) が消えている。
      -- 途中から続きを数えるとセッション数が足りなくなるので、最初から数え直す。
      if v_day < v_today - 13 then
        delete from metrics_event_days where day = v_day;
        delete from metrics_event_session_seen where day = v_day;
      end if;
      -- 1 回の呼び出しで最後まで数えさせる (既定は 2 秒で区切る)。
      perform set_config('metrics.refresh_budget_ms', '3600000', true);
      perform metrics_refresh_events(v_day);
      return jsonb_build_object(
        'kind', 'events', 'day', v_day,
        'ms', (extract(epoch from clock_timestamp() - v_t) * 1000)::integer
      );
    exception when others then
      return jsonb_build_object(
        'kind', 'events', 'day', v_day, 'code', sqlstate, 'message', sqlerrm
      );
    end;
  end if;

  -- 2. 控え。
  select t.day
    into v_day
    from (
      -- 前日〜7 日前 (友達診断・シェアがまだ動く): 今日まだ数え直していなければ。
      select d::date as day, 0 as priority
        from generate_series(v_today - 1, v_today - 7, interval '-1 day') as d
      union all
      -- 32 日前: シェアの集計期間 (31 日) が終わったあと 1 回。
      select v_today - 32, 1
    ) as t
    left join metrics_day_snapshots as s
      on s.day = t.day and s.locale = c_locale
   where t.day >= date '2026-01-01'
     and not (('snapshot:' || t.day) = any (p_skip))
     and (
       s.day is null
       or (t.priority = 0 and s.computed_at < v_today_start)
       -- 前日は画面が控えから出すので、1 時間に 1 回作り直す (毎時 40 分の実行ごと)。
       or (t.day = v_today - 1 and s.computed_at < clock_timestamp() - interval '50 minutes')
       or (t.priority = 1
           and s.computed_at < (t.day::timestamp at time zone 'Asia/Tokyo') + interval '32 days')
     )
   order by t.priority, t.day desc
   limit 1;

  if v_day is not null then
    begin
      return jsonb_build_object(
        'kind', 'snapshot', 'day', v_day,
        'ms', metrics_snapshot_day(v_day, c_locale)
      );
    exception when others then
      return jsonb_build_object(
        'kind', 'snapshot', 'day', v_day, 'code', sqlstate, 'message', sqlerrm
      );
    end;
  end if;

  return null;
end;
$function$;

revoke all on function public.internal_numbers_until_cut(date, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.internal_numbers_until_cut(date, timestamptz, text)
  to service_role;

commit;
