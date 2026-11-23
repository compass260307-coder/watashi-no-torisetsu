-- 社内向け数値画面 (/internal/numbers) の第5段: 終わった日を DB の中で先に数えておく。
--
-- これまでは「画面を開いたとき」に、まだ数えていない日をその場で数えていた。API からの
-- 呼び出しは約 8 秒で打ち切られる (2026-11-23 本番ログ: ?fill= が 8 秒おきに全部 57014)
-- ため、数えるのに時間のかかる日は、いつまでも数え終わらなかった。
--   * 月の推移で 11/14・16・17 が欠けた (控えが作れない)
--   * 11/18 以前の日を「1日の数字」で開くと、ファネルの集計が進まない (1 時間分の
--     イベントを読むだけで制限を超える)
--   * 30 日たった日の数え直しで、シェアの集計 (診断日から 31 日分) が制限を超える
--
-- ここでは DB の定期実行 (pg_cron) が、毎時 40 分に次をまとめて片づける。API の制限は
-- 受けない。1 回の実行は 10 分まで (1 日分ずつ確定する)。終わらなかった分は次の実行が続きをやる。
--   1. イベント (ファネル): 前日と、直近 7 日で数え終わっていない日 (それより前は読む量が多く、DB の負荷になるため数えない)を最後まで数える
--   2. 控え: 前日〜7 日前 (友達診断・シェアがまだ動く) を 1 日 1 回、32 日前 (シェアの
--      集計期間が終わる日) を 1 回、控えの無い日 (直近 62 日) を数える
-- 画面側は、2 日以上前の日は控えがあれば必ず控えから出す (その場では数え直さない)。
--
-- 数え方は変えていない。

begin;

create extension if not exists pg_cron with schema pg_catalog;

-- 定期実行の記録 (画面に「最終集計」を出すのと、動いているかの確認に使う)。
create table if not exists public.metrics_job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists metrics_job_runs_job_started_idx
  on public.metrics_job_runs (job, started_at desc);

alter table public.metrics_job_runs enable row level security;
revoke all on table public.metrics_job_runs from public, anon, authenticated;
grant select on table public.metrics_job_runs to service_role;

-- 1 日分の数字を、できるだけ速い方法で用意する。
--   * 今日と昨日: 元の表を直接数える (キャッシュに載っていて速い。昨日は今日の間も動く)。
--     昨日の分は、平均の元にするため 1 時間に 1 回控える。
--   * それより前: 控えがあれば、古さに関係なく控えから出す (数え直しは定期実行が受け持つ)。
--     控えが無いときだけ数える。
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

  -- 2 日以上前の日。控えがあれば、それを出す。
  if v_payload is not null then
    return internal_numbers_attach_events(v_payload, p_day, p_locale);
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

-- 定期実行の 1 単位: まだ済んでいない仕事を 1 つ (1 日分) だけ片づける。
-- 戻り値は {kind, day, ms} か、失敗なら {kind, day, code, message}。仕事が無ければ null。
-- p_skip: この実行の中ですでに手を付けた "kind:day" の配列 (失敗した日を繰り返さない)。
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
  -- 1. イベント (ファネル)。前日を先に、残りは新しい日から。直近 7 日 (古い日は元のイベントの行数が多く、まとめて読むと DB の負荷になる)。
  select d::date
    into v_day
    from generate_series(v_today - 1, v_today - 7, interval '-1 day') as d
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
      union all
      -- 控えの無い日 (直近 62 日)。
      select d::date, 2
        from generate_series(v_today - 8, v_today - 62, interval '-1 day') as d
    ) as t
    left join metrics_day_snapshots as s
      on s.day = t.day and s.locale = c_locale
   where t.day >= date '2026-01-01'
     and not (('snapshot:' || t.day) = any (p_skip))
     and (
       s.day is null
       or (t.priority = 0 and s.computed_at < v_today_start)
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

revoke all on function public.metrics_nightly_step(text[]) from public, anon, authenticated;

-- 定期実行の本体。1 日分ずつ確定 (commit) しながら、p_budget_seconds まで続ける。
-- 1 日分ごとに確定するので、画面からの呼び出しを長く待たせない。終わらなかった分は
-- 次の実行が続きをやる。SQL Editor から `call public.metrics_nightly_run();` でも流せる。
-- (途中で commit するため procedure にしている。procedure は SET 句や security definer を
--  付けると commit できないので、名前はすべて public. を付けて書く。)
create or replace procedure public.metrics_nightly_run(p_budget_seconds integer default 600)
language plpgsql
as $procedure$
declare
  v_started timestamptz := clock_timestamp();
  v_deadline timestamptz := clock_timestamp() + make_interval(secs => p_budget_seconds);
  v_run_id bigint;
  v_skip text[] := '{}';
  v_step jsonb;
  v_done jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
begin
  -- 前の実行がまだ動いていたら、何もしない。
  if not pg_try_advisory_lock(hashtext('metrics_nightly')) then
    return;
  end if;

  insert into public.metrics_job_runs (job, started_at)
  values ('metrics_nightly', v_started)
  returning id into v_run_id;
  commit;

  while clock_timestamp() < v_deadline loop
    v_step := public.metrics_nightly_step(v_skip);
    exit when v_step is null;
    v_skip := v_skip || ((v_step ->> 'kind') || ':' || (v_step ->> 'day'));
    if v_step ? 'code' then
      v_errors := v_errors || v_step;
    else
      v_done := v_done || v_step;
    end if;
    commit;
  end loop;

  update public.metrics_job_runs
     set finished_at = clock_timestamp(),
         detail = jsonb_build_object(
           'done', v_done,
           'errors', v_errors,
           -- 時間切れで残した仕事があるか。
           'more', clock_timestamp() >= v_deadline,
           'ms', (extract(epoch from clock_timestamp() - v_started) * 1000)::integer
         )
   where id = v_run_id;
  -- 記録は 90 日分だけ残す。
  delete from public.metrics_job_runs where started_at < v_started - interval '90 days';
  commit;

  perform pg_advisory_unlock(hashtext('metrics_nightly'));
end;
$procedure$;

revoke all on procedure public.metrics_nightly_run(integer) from public, anon, authenticated;

commit;

-- 毎時 40 分 (日本時間も同じ)。やることが無ければ数秒で終わる。
-- 同じ名前で登録し直すと上書きになる。procedure の中で commit するため、命令は CALL 1 つだけにする。
select cron.schedule(
  'internal-numbers-nightly',
  '40 * * * *',
  $$call public.metrics_nightly_run(600)$$
);
