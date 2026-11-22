-- 社内向け数値画面の第4段: 日次の推移 (/internal/numbers/daily)。
--
-- 終わった日の控え (metrics_day_snapshots) から、日ごとの 1 日分の合計と広告費を返す。
-- 読むだけで、何も数え直さない (古い日を元の表から数えると 1 日 8〜19 秒かかるため)。
-- 控えがまだ無い日は counted = false で返し、画面が 1 日ずつ数えさせる
-- (internal_numbers_compare_day が数えて控える)。今日の分は、画面が今の数字を別に取る。
--
-- service_role 専用。

begin;

create or replace function public.internal_numbers_daily(
  p_from date,
  p_to date,
  p_locale text default 'ja'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if p_locale is null or p_locale not in ('ja', 'ko', 'en', 'id') then
    raise exception 'invalid locale' using errcode = '22023';
  end if;
  -- 1 回に返すのは 2 か月分まで。
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 61 then
    raise exception 'invalid range' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'days', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'day', d.day,
            -- 控えがあるか。無い日は、数字 (totals・cohort) が null。
            'counted', s.payload is not null,
            'computed_at', s.computed_at,
            'totals', case
              when s.payload is null then null
              else internal_numbers_full_totals(s.payload -> 'hours')
            end,
            -- 友達診断率・シェア率の元 (その日に診断した人のうち何人か)。
            'cohort', s.payload -> 'cohort',
            -- 広告費。actual が実績、plan が配信計画からの推定 (実績が無い時間帯の分)。
            'cost', jsonb_build_object(
              'actual', c.actual,
              'plan', c.plan,
              'has_actual', coalesce((k.costs ->> 'has_actual')::boolean, false),
              'accounts_with_actual',
                coalesce((k.costs ->> 'accounts_with_actual')::integer, 0),
              'accounts_recent', coalesce((k.costs ->> 'accounts_recent')::integer, 0)
            )
          )
          order by d.day
        ),
        '[]'::jsonb
      )
      from (
        select g::date as day
          from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as g
      ) as d
      left join metrics_day_snapshots as s
        on s.day = d.day
       and s.locale = p_locale
      cross join lateral (
        select internal_numbers_costs(d.day, p_locale) as costs
      ) as k
      cross join lateral (
        select
          coalesce(sum((h.value ->> 'actual')::numeric), 0) as actual,
          coalesce(sum((h.value ->> 'plan')::numeric), 0) as plan
          from jsonb_array_elements(k.costs -> 'hours') as h
      ) as c
    ),
    'settings', (
      select jsonb_build_object(
        'fee_rate', t.fee_rate,
        'server_cost_per_diagnosis', t.server_cost_per_diagnosis,
        'ai_cost_per_purchase', t.ai_cost_per_purchase,
        'ai_cost_per_upgrade', t.ai_cost_per_upgrade
      )
      from internal_numbers_settings as t
    )
  );
end;
$function$;

revoke all on function public.internal_numbers_daily(date, date, text)
  from public, anon, authenticated;
grant execute on function public.internal_numbers_daily(date, date, text) to service_role;

commit;
