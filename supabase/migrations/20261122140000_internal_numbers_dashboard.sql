-- 社内向けの数値画面 (/internal/numbers) のDB側。
--
-- これまでは Google スプレッドシートが 15 分ごとに生データを取りに来て、シート側で
-- 数えていた。1 日分のイベントを毎回すべて運ぶため重く、数字も最大 15 分遅れていた。
-- ここでは「画面を開いたとき・更新ボタンを押したとき」だけ DB の中で数える。
--
--   * 診断・売上・友達診断・シェア: 元の表を DB の中で直接数える (1 日 1 万行程度)。
--   * イベント (ファネル): 行数が多いので、時間ごとの件数を metrics_event_hourly に
--     持つ。呼ばれるたびに「前回数えた時刻を含む時間枠から今まで」を数え直して
--     上書きする。足し込みではないので、連打や同時アクセスでも二重に数えない。
--
-- 数え方は利益ダッシュボード (スプレッドシート) に合わせる:
--   * 診断数 = 診断を完了した人数 (users.diagnosis_completed_at、流入言語で絞る)
--   * 売上 = 購入時刻で計上。テスト決済を除き、返金を引く
--   * 広告流入 = 流入元が x / tiktok。それ以外 (空欄を含む) は非広告
--   * 友達診断率・シェア率 = その日に診断した人を追跡 (後から増える)
--
-- すべて service_role 専用。anon / authenticated からは表も関数も触れない。

begin;

-- 画面を開けるメールアドレス (確認済みのログインメールと照合する)。
create table if not exists public.internal_dashboard_viewers (
  email text primary key
    check (email = lower(btrim(email)) and email <> ''),
  created_at timestamptz not null default now()
);

-- イベントの時間別件数。hour_start は JST の正時 (UTC でも正時)。
create table if not exists public.metrics_event_hourly (
  hour_start timestamptz not null,
  locale text not null,
  event_name text not null,
  page text not null default '',
  placement text not null default '',
  product text not null default '',
  return_to text not null default '',
  event_count integer not null check (event_count > 0),
  primary key (hour_start, locale, event_name, page, placement, product, return_to)
);

-- その日すでに数えたセッションの控え。セッションIDや owner_token そのものは
-- 持たず、元に戻せないハッシュだけを置く。14 日を過ぎた分は消す。
create table if not exists public.metrics_event_session_seen (
  day date not null,
  locale text not null,
  event_name text not null,
  session_hash uuid not null,
  primary key (day, locale, event_name, session_hash)
);

-- 日別のセッション数 (重複を除いた数)。控えを消したあとも残る。
create table if not exists public.metrics_funnel_daily (
  day date not null,
  locale text not null,
  event_name text not null,
  sessions integer not null check (sessions >= 0),
  primary key (day, locale, event_name)
);

-- 日ごとに「どこまで数えたか」。is_partial は、時間の上限で途中 (時間枠の境目) まで
-- しか数えていない状態。
create table if not exists public.metrics_event_days (
  day date primary key,
  computed_through timestamptz not null,
  computed_at timestamptz not null default now(),
  last_duration_ms integer,
  is_partial boolean not null default false
);
-- 2026-11-22 の初版を流した環境向け (列をあとから足した)。
alter table public.metrics_event_days
  add column if not exists is_partial boolean not null default false;

alter table public.internal_dashboard_viewers enable row level security;
alter table public.metrics_event_hourly enable row level security;
alter table public.metrics_event_session_seen enable row level security;
alter table public.metrics_funnel_daily enable row level security;
alter table public.metrics_event_days enable row level security;

revoke all on table
  public.internal_dashboard_viewers,
  public.metrics_event_hourly,
  public.metrics_event_session_seen,
  public.metrics_funnel_daily,
  public.metrics_event_days
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.internal_dashboard_viewers,
  public.metrics_event_hourly,
  public.metrics_event_session_seen,
  public.metrics_funnel_daily,
  public.metrics_event_days
to service_role;

-- 集計表に入れてよいラベルだけを通す。ページ名や位置は "me" "sticky_bar" のような
-- 短い英小文字の名前。URL やトークンが紛れ込んでも、そのまま保存しない。
create or replace function public.metrics_label(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $function$
  select case
    when p_value is null or p_value = '' then ''
    when p_value ~ '^[a-z][a-z0-9_]{0,39}$' then p_value
    else 'other'
  end;
$function$;

-- 指定した日 (JST) のイベント集計を「今」まで追いつかせる。
-- 戻り値は、どこまで数えたか (時間の上限で途中までのこともある)。未来の日は null。
create or replace function public.metrics_refresh_events(p_day date)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $function$
declare
  -- 旧 /api/metrics/dashboard-aux (kind=funnel) と同じイベント。
  c_names constant text[] := array[
    'page_view', 'landing_view', 'diagnosis_started', 'diagnosis_completed',
    'share_clicked', 'share_click', 'share_completed', 'share_success',
    'share_link_opened', 'friend_answer_started', 'friend_answer_completed',
    'friend_v2_started', 'friend_v2_completed', 'friend_invite_clicked',
    'tako_invite_ui_shown', 'tako_viewed', 'friend_share_clicked',
    'friend_link_copied', 'result_viewed', 'result_revisited',
    'friend_to_diagnosis_clicked', 'friend_v2_self_cta_clicked',
    'friend_landing_viewed', 'share_landing_viewed', 'paywall_scroll_clicked',
    'hoshiyomi_page_viewed', 'paywall_viewed', 'paywall_plan_viewed',
    'purchase_cta_clicked', 'checkout_requested', 'checkout_session_created',
    'purchase_completed', 'unmei_lp_view', 'unmei_purchase_start',
    'unmei_purchase_complete', 'line_follow', 'line_unfollow',
    'line_message_received', 'line_alice_plus_subscribed',
    'line_alice_plus_cancelled'
  ];
  -- セッション数 (重複を除いた数) まで持つイベント。
  c_session_names constant text[] := array[
    'diagnosis_started', 'diagnosis_completed', 'paywall_viewed',
    'purchase_cta_clicked', 'checkout_session_created', 'purchase_completed'
  ];
  c_locales constant text[] := array['ja', 'ko', 'en', 'id'];
  v_started timestamptz := clock_timestamp();
  v_now timestamptz;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_through timestamptz;
  v_was_partial boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_cursor timestamptz;
  v_chunk_end timestamptz;
  v_done_through timestamptz;
  v_budget interval;
  v_rows bigint;
begin
  if p_day is null then
    return null;
  end if;

  v_day_start := p_day::timestamp at time zone 'Asia/Tokyo';
  v_day_end := v_day_start + interval '1 day';
  if v_day_start > v_started then
    return null;
  end if;

  -- 同じ日を同時に数えない。待たされた側は、先に終わった結果をそのまま使う。
  perform pg_advisory_xact_lock(
    hashtext('metrics_refresh_events'),
    p_day - date '2000-01-01'
  );
  v_now := clock_timestamp();

  select d.computed_through, d.is_partial
    into v_through, v_was_partial
    from metrics_event_days as d
   where d.day = p_day;

  -- 日が終わって 5 分以上あとに数え終えた日は確定。直前に数えたばかりなら数え直さない。
  if v_through is not null and not v_was_partial and (
    v_through >= v_day_end + interval '5 minutes'
    or v_through > v_now - interval '3 seconds'
  ) then
    return v_through;
  end if;

  v_to := least(v_now, v_day_end);
  v_from := case
    when v_through is null then v_day_start
    -- 前回は途中 (時間枠の境目) で止まっている。その続きから数える。
    when v_was_partial then
      date_bin(interval '1 hour', least(v_through, v_day_end), v_day_start)
    -- 前回はその時点の「今」まで数えた。5 分手前を含む時間枠の頭から数え直す。
    -- 記録の反映が数秒遅れたイベントも、次の更新で拾える。
    else greatest(
      v_day_start,
      date_bin(
        interval '1 hour',
        least(v_through, v_day_end) - interval '5 minutes',
        v_day_start
      )
    )
  end;

  -- 1 回の呼び出しで使う時間の上限。古い日のイベントは DB のキャッシュに載って
  -- おらず、1 日分を初めて読むと 1 分かかることがある (2026-11-22 本番で 64 秒)。
  -- API からの呼び出しは制限時間で打ち切られるので、1 時間分ずつ数えて、上限を
  -- 超えたら途中まで保存して返す。続きは次の呼び出しが数える。
  v_budget := make_interval(
    secs => coalesce(
      nullif(current_setting('metrics.refresh_budget_ms', true), '')::numeric,
      2000
    ) / 1000.0
  );

  v_cursor := v_from;
  while v_cursor < v_to loop
    v_chunk_end := least(v_cursor + interval '1 hour', v_to);

    delete from metrics_event_hourly as h
     where h.hour_start = v_cursor;

    with facts as materialized (
      select
        e.created_at,
        e.event_name,
        coalesce(
          nullif(e.locale, ''),
          nullif(e.metadata ->> 'locale', ''),
          (
            select u.acquisition_locale
              from users as u
             where u.owner_token = e.owner_token
             limit 1
          ),
          'unknown'
        ) as raw_locale,
        metrics_label(coalesce(
          nullif(e.metadata ->> 'page', ''),
          nullif(e.metadata ->> 'path', ''),
          nullif(e.metadata ->> 'surface', '')
        )) as page,
        metrics_label(coalesce(
          nullif(e.metadata ->> 'placement', ''),
          nullif(e.metadata ->> 'source', '')
        )) as placement,
        metrics_label(e.metadata ->> 'product') as product,
        metrics_label(e.metadata ->> 'return_to') as return_to,
        case
          when nullif(e.session_id, '') is not null then 'session:' || e.session_id
          when nullif(e.owner_token, '') is not null then 'owner:' || e.owner_token
        end as session_key
      from events as e
      where e.created_at >= v_cursor
        and e.created_at < v_chunk_end
        and e.event_name = any (c_names)
    ),
    labelled as (
      select
        f.*,
        case when f.raw_locale = any (c_locales) then f.raw_locale else 'unknown' end
          as locale
      from facts as f
    ),
    hourly as (
      insert into metrics_event_hourly (
        hour_start, locale, event_name, page, placement, product, return_to,
        event_count
      )
      select
        v_cursor,
        l.locale, l.event_name, l.page, l.placement, l.product, l.return_to,
        count(*)::integer
      from labelled as l
      group by 2, 3, 4, 5, 6, 7
      returning 1
    ),
    seen as (
      insert into metrics_event_session_seen (day, locale, event_name, session_hash)
      select distinct p_day, l.locale, l.event_name, md5(l.session_key)::uuid
      from labelled as l
      where l.event_name = any (c_session_names)
        and l.session_key is not null
      on conflict do nothing
      returning 1
    )
    -- 2 つの挿入は WITH の中で必ず実行される。件数そのものは使わない。
    select (select count(*) from hourly) + (select count(*) from seen)
      into v_rows;

    v_cursor := v_chunk_end;
    exit when v_cursor >= v_to;
    -- 途中で止めるのは、5 分以上前に終わった時間枠の境目だけ。続きは境目から数え直さずに
    -- 進むので、反映が遅れたイベントを取りこぼさないよう、直近の枠では止めない。
    exit when clock_timestamp() - v_started > v_budget
      and v_cursor <= v_now - interval '5 minutes';
  end loop;

  -- 最後まで数えたら「今」まで、途中で止めたら数え終えた時間枠の境目までを記録する。
  v_was_partial := v_cursor < v_to;
  v_done_through := case when v_was_partial then v_cursor else v_now end;

  -- この日のセッション数を、控えから数え直して置き換える。
  delete from metrics_funnel_daily as d where d.day = p_day;

  insert into metrics_funnel_daily (day, locale, event_name, sessions)
  select p_day, s.locale, s.event_name, count(*)::integer
    from metrics_event_session_seen as s
   where s.day = p_day
   group by s.locale, s.event_name;

  -- 同じ日のうちに診断を始めて、完了までしたセッション。
  insert into metrics_funnel_daily (day, locale, event_name, sessions)
  select p_day, a.locale, 'diagnosis_started_and_completed', count(*)::integer
    from metrics_event_session_seen as a
    join metrics_event_session_seen as b
      on b.day = a.day
     and b.locale = a.locale
     and b.session_hash = a.session_hash
     and b.event_name = 'diagnosis_completed'
   where a.day = p_day
     and a.event_name = 'diagnosis_started'
   group by a.locale;

  delete from metrics_event_session_seen as s
   where s.day < (v_now at time zone 'Asia/Tokyo')::date - 14;

  insert into metrics_event_days as d (
    day, computed_through, computed_at, last_duration_ms, is_partial
  )
  values (
    p_day,
    v_done_through,
    clock_timestamp(),
    (extract(epoch from clock_timestamp() - v_started) * 1000)::integer,
    v_was_partial
  )
  on conflict (day) do update
    set computed_through = excluded.computed_through,
        computed_at = excluded.computed_at,
        last_duration_ms = excluded.last_duration_ms,
        is_partial = excluded.is_partial;

  return v_done_through;
end;
$function$;

-- 1 日分 (JST の p_day) の数字をまとめて返す。p_cut は「この時刻まで」の小計用
-- (今日なら現在時刻、比較日なら同じ経過時間の時刻)。
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
  v_sessions jsonb;
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
  ),
  events_by_hour as (
    select
      floor(extract(epoch from e.hour_start - v_start) / 3600)::integer as h,
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
    where e.hour_start >= v_start
      and e.hour_start < v_end
      and e.locale = p_locale
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
      'purchases_upgrade', coalesce(s.purchases_upgrade, 0),
      'events', jsonb_build_object(
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
    order by hours.h
  )
  into v_hours
  from hours
  left join diagnoses as d on d.h = hours.h
  left join sales as s on s.h = hours.h
  left join events_by_hour as e on e.h = hours.h;

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

  select coalesce(jsonb_object_agg(d.event_name, d.sessions), '{}'::jsonb)
    into v_sessions
    from metrics_funnel_daily as d
   where d.day = p_day
     and d.locale = p_locale;

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

  return jsonb_build_object(
    'day', p_day,
    'hours', v_hours,
    'until_cut', v_until_cut,
    'cohort', v_cohort,
    'sessions', v_sessions,
    'sources', v_sources
  );
end;
$function$;

-- 画面が 1 回の呼び出しで使う入口。イベント集計を追いつかせてから、表示日と
-- 比較日の数字を返す。
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

  -- 友達診断・シェアは「その日に診断した人が、今までにしたか」なので今の時刻まで見る。
  v_day_block := internal_numbers_day(v_day, v_cut, v_now, p_locale, true);
  v_compare_block := internal_numbers_day(v_compare, v_compare_cut, v_now, p_locale, false);

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
      'compare_events_complete', coalesce(
        v_compare_through >= least(v_started - interval '10 seconds', v_compare_start + interval '1 day'),
        false
      ),
      'duration_ms', (extract(epoch from clock_timestamp() - v_started) * 1000)::integer
    ),
    'day', v_day_block,
    'compare', v_compare_block
  );
end;
$function$;

revoke all on function public.metrics_label(text)
  from public, anon, authenticated;
revoke all on function public.metrics_refresh_events(date)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_day(date, timestamptz, timestamptz, text, boolean)
  from public, anon, authenticated;
revoke all on function public.internal_numbers_dashboard(date, date, text)
  from public, anon, authenticated;

grant execute on function public.metrics_label(text) to service_role;
grant execute on function public.metrics_refresh_events(date) to service_role;
grant execute on function public.internal_numbers_day(date, timestamptz, timestamptz, text, boolean)
  to service_role;
grant execute on function public.internal_numbers_dashboard(date, date, text)
  to service_role;

commit;
