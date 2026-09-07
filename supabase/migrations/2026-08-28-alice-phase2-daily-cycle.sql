-- Alice app Phase 2: personal 7-day cycles, daily Big Five check-ins, and journal.
-- Requires 2026-08-28-alice-phase1-transfer-foundation.sql.

begin;

create table if not exists public.weekly_cycles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_number integer not null,
  status text not null default 'active',
  timezone_at_start text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  day_start_at timestamptz[] not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz null,
  constraint weekly_cycles_number_positive check (cycle_number > 0),
  constraint weekly_cycles_status_check check (status in ('active', 'completed')),
  constraint weekly_cycles_time_order check (starts_at < ends_at),
  constraint weekly_cycles_eight_boundaries check (cardinality(day_start_at) = 8),
  constraint weekly_cycles_account_number_unique unique (account_id, cycle_number)
);

create index if not exists idx_weekly_cycles_account_window
  on public.weekly_cycles(account_id, starts_at desc, ends_at desc);

create unique index if not exists uq_weekly_cycles_one_active
  on public.weekly_cycles(account_id)
  where status = 'active';

create table if not exists public.daily_question_bank (
  question_id integer primary key,
  facet_id text not null,
  dimension text not null,
  reversed boolean not null,
  question_logic_version text not null,
  active_from timestamptz not null default now(),
  active_to timestamptz null,
  constraint daily_question_bank_facet_check check (facet_id in (
    'E_assertiveness', 'E_warmth', 'A_cooperation', 'A_sympathy',
    'O_adventurousness', 'O_imagination', 'C_achievement', 'C_orderliness',
    'N_volatility', 'N_anxiety'
  )),
  constraint daily_question_bank_dimension_check check (dimension in ('E', 'A', 'O', 'C', 'N')),
  constraint daily_question_bank_active_window check (active_to is null or active_to > active_from)
);

create table if not exists public.daily_question_texts (
  question_id integer not null references public.daily_question_bank(question_id) on delete cascade,
  locale text not null,
  text text not null,
  primary key (question_id, locale),
  constraint daily_question_text_not_blank check (char_length(text) between 1 and 500)
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles(id) on delete cascade,
  cycle_day integer not null,
  local_date date not null,
  mood text null,
  status text not null default 'in_progress',
  question_ids integer[] not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint daily_checkins_cycle_day_check check (cycle_day between 1 and 7),
  constraint daily_checkins_mood_check check (mood is null or mood in ('clear', 'calm', 'mixed', 'hard')),
  constraint daily_checkins_status_check check (status in ('in_progress', 'completed')),
  constraint daily_checkins_ten_questions check (cardinality(question_ids) = 10),
  constraint daily_checkins_account_cycle_day_unique unique (account_id, cycle_id, cycle_day)
);

create index if not exists idx_daily_checkins_account_started
  on public.daily_checkins(account_id, started_at desc);

create table if not exists public.daily_answers (
  checkin_id uuid not null references public.daily_checkins(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  question_id integer not null references public.daily_question_bank(question_id) on delete restrict,
  facet_id text not null,
  dimension text not null,
  reversed boolean not null,
  answer smallint not null,
  normalized_score numeric(7,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (checkin_id, question_id),
  constraint daily_answers_value_check check (answer between 1 and 7),
  constraint daily_answers_normalized_check check (normalized_score between 0 and 10)
);

create index if not exists idx_daily_answers_account_created
  on public.daily_answers(account_id, created_at desc);

create table if not exists public.daily_results (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles(id) on delete cascade,
  checkin_id uuid not null unique references public.daily_checkins(id) on delete cascade,
  local_date date not null,
  timezone_at_completion text not null,
  facet_scores jsonb not null,
  dimension_scores jsonb not null,
  boundary_distances jsonb not null,
  minimum_boundary_distance numeric(7,4) not null,
  thirty_two_type_id text not null,
  question_set_version text not null,
  scoring_version text not null,
  classification_version text not null,
  completed_at timestamptz not null default now()
);

create index if not exists idx_daily_results_account_date
  on public.daily_results(account_id, local_date desc);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles(id) on delete cascade,
  checkin_id uuid null unique references public.daily_checkins(id) on delete cascade,
  local_date date not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_body_length check (char_length(body) between 1 and 5000)
);

create index if not exists idx_journal_entries_account_date
  on public.journal_entries(account_id, local_date desc);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  cycle_id uuid not null references public.weekly_cycles(id) on delete cascade,
  report_state text not null,
  thirty_two_type_id text null,
  dimension_scores jsonb not null,
  boundary_distances jsonb not null,
  minimum_boundary_distance numeric(7,4) not null,
  stability_score numeric(7,4) null,
  answered_days integer not null,
  answer_count integer not null,
  question_set_version text not null,
  scoring_version text not null,
  classification_version text not null,
  stability_logic_version text null,
  base_profile_snapshot_id uuid not null references public.base_profile_snapshots(id) on delete restrict,
  generated_at timestamptz not null default now(),
  constraint weekly_reports_state_check check (report_state in ('tendency', 'confirmed')),
  constraint weekly_reports_answered_days_check check (answered_days between 0 and 7),
  constraint weekly_reports_account_cycle_unique unique (account_id, cycle_id)
);

insert into public.daily_question_bank (
  question_id, facet_id, dimension, reversed, question_logic_version
) values
  (1, 'E_assertiveness', 'E', false, 'web-big-five-v1'),
  (2, 'E_assertiveness', 'E', false, 'web-big-five-v1'),
  (3, 'E_assertiveness', 'E', true, 'web-big-five-v1'),
  (4, 'E_assertiveness', 'E', false, 'web-big-five-v1'),
  (5, 'E_assertiveness', 'E', true, 'web-big-five-v1'),
  (6, 'E_warmth', 'E', false, 'web-big-five-v1'),
  (7, 'E_warmth', 'E', false, 'web-big-five-v1'),
  (8, 'E_warmth', 'E', true, 'web-big-five-v1'),
  (9, 'E_warmth', 'E', false, 'web-big-five-v1'),
  (10, 'E_warmth', 'E', true, 'web-big-five-v1'),
  (11, 'A_cooperation', 'A', false, 'web-big-five-v1'),
  (12, 'A_cooperation', 'A', false, 'web-big-five-v1'),
  (13, 'A_cooperation', 'A', true, 'web-big-five-v1'),
  (14, 'A_cooperation', 'A', false, 'web-big-five-v1'),
  (15, 'A_cooperation', 'A', true, 'web-big-five-v1'),
  (16, 'A_sympathy', 'A', false, 'web-big-five-v1'),
  (17, 'A_sympathy', 'A', false, 'web-big-five-v1'),
  (18, 'A_sympathy', 'A', true, 'web-big-five-v1'),
  (19, 'A_sympathy', 'A', false, 'web-big-five-v1'),
  (20, 'A_sympathy', 'A', true, 'web-big-five-v1'),
  (21, 'O_adventurousness', 'O', false, 'web-big-five-v1'),
  (22, 'O_adventurousness', 'O', false, 'web-big-five-v1'),
  (23, 'O_adventurousness', 'O', true, 'web-big-five-v1'),
  (24, 'O_adventurousness', 'O', false, 'web-big-five-v1'),
  (25, 'O_adventurousness', 'O', true, 'web-big-five-v1'),
  (26, 'O_imagination', 'O', false, 'web-big-five-v1'),
  (27, 'O_imagination', 'O', false, 'web-big-five-v1'),
  (28, 'O_imagination', 'O', true, 'web-big-five-v1'),
  (29, 'O_imagination', 'O', false, 'web-big-five-v1'),
  (30, 'O_imagination', 'O', true, 'web-big-five-v1'),
  (31, 'C_achievement', 'C', false, 'web-big-five-v1'),
  (32, 'C_achievement', 'C', false, 'web-big-five-v1'),
  (33, 'C_achievement', 'C', true, 'web-big-five-v1'),
  (34, 'C_achievement', 'C', false, 'web-big-five-v1'),
  (35, 'C_achievement', 'C', true, 'web-big-five-v1'),
  (36, 'C_orderliness', 'C', false, 'web-big-five-v1'),
  (37, 'C_orderliness', 'C', false, 'web-big-five-v1'),
  (38, 'C_orderliness', 'C', true, 'web-big-five-v1'),
  (39, 'C_orderliness', 'C', false, 'web-big-five-v1'),
  (40, 'C_orderliness', 'C', true, 'web-big-five-v1'),
  (41, 'N_volatility', 'N', false, 'web-big-five-v1'),
  (42, 'N_volatility', 'N', false, 'web-big-five-v1'),
  (43, 'N_volatility', 'N', true, 'web-big-five-v1'),
  (44, 'N_volatility', 'N', false, 'web-big-five-v1'),
  (45, 'N_volatility', 'N', true, 'web-big-five-v1'),
  (46, 'N_anxiety', 'N', false, 'web-big-five-v1'),
  (47, 'N_anxiety', 'N', false, 'web-big-five-v1'),
  (48, 'N_anxiety', 'N', true, 'web-big-five-v1'),
  (49, 'N_anxiety', 'N', false, 'web-big-five-v1'),
  (50, 'N_anxiety', 'N', true, 'web-big-five-v1')
on conflict (question_id) do update
  set facet_id = excluded.facet_id,
      dimension = excluded.dimension,
      reversed = excluded.reversed,
      question_logic_version = excluded.question_logic_version;

insert into public.daily_question_texts (question_id, locale, text) values
  (1, 'ja-JP', 'グループで意見が割れたとき、自分の考えをはっきり伝える方だ。'),
  (2, 'ja-JP', 'みんなで「どこ行く？」となったら、自分から候補を出す。'),
  (3, 'ja-JP', '言いたいことがあっても、空気を読んで飲み込むことが多い。'),
  (4, 'ja-JP', '違うと思ったら、相手が誰でも「いや、それは」と言える。'),
  (5, 'ja-JP', '大勢の前で発表とか、できれば避けたいタイプだ。'),
  (6, 'ja-JP', '初対面の人とでも、わりとすぐ仲良くなれる。'),
  (7, 'ja-JP', '友達が元気なさそうだと、こっちから話しかけにいく。'),
  (8, 'ja-JP', '知らない人と話すのは、できれば避けたい。'),
  (9, 'ja-JP', '人と話してると、自然と笑顔になっている。'),
  (10, 'ja-JP', '自分から人に深入りすることは少ない方だ。'),
  (11, 'ja-JP', 'グループ作業では、自分の意見より全体の流れを優先する。'),
  (12, 'ja-JP', '友達と意見が違っても、結局相手に合わせることが多い。'),
  (13, 'ja-JP', '自分のやり方を曲げてまで、人に合わせたくない。'),
  (14, 'ja-JP', 'みんなが楽しめるなら、自分が我慢するのは平気だ。'),
  (15, 'ja-JP', '「自分の意見を通したい」と思うことがよくある。'),
  (16, 'ja-JP', '友達が泣いてると、つられて泣きそうになる。'),
  (17, 'ja-JP', '映画や漫画で、登場人物の気持ちに入り込みやすい。'),
  (18, 'ja-JP', '人の感情の起伏には、わりと無関心なほうだ。'),
  (19, 'ja-JP', '友達の表情が少し変わるだけで、何かあったか気になる。'),
  (20, 'ja-JP', '「気持ちを察してほしい」と言われても、よく分からない。'),
  (21, 'ja-JP', '「行ったことない店」と聞くと、つい行きたくなる。'),
  (22, 'ja-JP', '旅行先では、定番より地元の人しか知らない場所を選ぶ。'),
  (23, 'ja-JP', '新しい場所より、慣れた場所のほうが落ち着く。'),
  (24, 'ja-JP', '「やったことないこと」に誘われると、わりと乗る。'),
  (25, 'ja-JP', '初めての経験には、つい慎重になってしまう。'),
  (26, 'ja-JP', 'ぼーっとしてる時、頭の中で勝手にストーリーが浮かぶ。'),
  (27, 'ja-JP', '同じ景色を見ても、人より色々考えてる気がする。'),
  (28, 'ja-JP', '空想や妄想にふけることは、ほとんどない。'),
  (29, 'ja-JP', '「もし○○だったら」を想像するのが好きだ。'),
  (30, 'ja-JP', '現実的なことだけ考えていたいタイプだ。'),
  (31, 'ja-JP', '「これをやり遂げたい」という目標が、いつも頭にある。'),
  (32, 'ja-JP', 'テストや課題で、平均より上を目指すタイプだ。'),
  (33, 'ja-JP', '「のんびり過ごす」が一番の幸せだと思う。'),
  (34, 'ja-JP', '自分なりの目標を立てて、それに向かって動くほうだ。'),
  (35, 'ja-JP', '特に目標がなくても、毎日それなりに楽しい。'),
  (36, 'ja-JP', '机の上やカバンの中は、わりと整理されている。'),
  (37, 'ja-JP', '予定はスケジュール帳やアプリでちゃんと管理する。'),
  (38, 'ja-JP', '部屋が散らかっていても、あまり気にならない。'),
  (39, 'ja-JP', '何かを始める前に、まず段取りを考えるほうだ。'),
  (40, 'ja-JP', '「あとで片付ければいい」とつい放置してしまう。'),
  (41, 'ja-JP', 'イラっとしたら、つい顔や態度に出てしまう。'),
  (42, 'ja-JP', '嫌なことがあると、しばらく機嫌が直らない方だ。'),
  (43, 'ja-JP', '感情が乱れても、表に出さないほうだ。'),
  (44, 'ja-JP', '友達と喧嘩したとき、感情が抑えられなくなる。'),
  (45, 'ja-JP', 'どんな時でも、わりと冷静でいられる。'),
  (46, 'ja-JP', '寝る前、つい今日のことを思い出して考え込む。'),
  (47, 'ja-JP', 'テストや発表の前は、何度も確認しないと不安だ。'),
  (48, 'ja-JP', '先のことを心配することは、あまりない。'),
  (49, 'ja-JP', '「あの言い方、大丈夫だったかな」とよく振り返る。'),
  (50, 'ja-JP', '何か起きてから対処すればいい、と思える方だ。')
on conflict (question_id, locale) do update set text = excluded.text;

create or replace function public.start_alice_daily(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account public.accounts%rowtype;
  v_cycle public.weekly_cycles%rowtype;
  v_last_cycle public.weekly_cycles%rowtype;
  v_checkin public.daily_checkins%rowtype;
  v_timezone text;
  v_anchor_at timestamptz;
  v_anchor_cycle_number integer;
  v_first_end_at timestamptz;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_start_date date;
  v_first_end_date date;
  v_skip_cycles integer;
  v_cycle_number integer;
  v_day_starts timestamptz[] := array[]::timestamptz[];
  v_cycle_day integer := 1;
  v_question_ids integer[] := array[]::integer[];
  v_facets text[] := array[
    'E_assertiveness', 'E_warmth', 'A_cooperation', 'A_sympathy',
    'O_adventurousness', 'O_imagination', 'C_achievement', 'C_orderliness',
    'N_volatility', 'N_anxiety'
  ];
  v_facet text;
  v_question_count integer;
  v_question_offset integer;
  v_question_id integer;
  v_questions jsonb;
  v_result jsonb;
  v_completed_days integer;
  i integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));

  select *
    into v_account
    from public.accounts
   where id = p_account_id
   for update;

  if not found or v_account.active_base_profile_snapshot_id is null then
    raise exception using errcode = 'P0001', message = 'account_not_linked';
  end if;

  select *
    into v_cycle
    from public.weekly_cycles
   where account_id = p_account_id
     and starts_at <= now()
     and ends_at > now()
   order by cycle_number desc
   limit 1;

  if not found then
    update public.weekly_cycles
       set status = 'completed',
           closed_at = coalesce(closed_at, now())
     where account_id = p_account_id
       and status = 'active'
       and ends_at <= now();

    select *
      into v_last_cycle
      from public.weekly_cycles
     where account_id = p_account_id
     order by cycle_number desc
     limit 1;

    if found then
      v_anchor_at := v_last_cycle.ends_at;
      v_anchor_cycle_number := v_last_cycle.cycle_number + 1;
    else
      v_anchor_at := v_account.registered_at;
      v_anchor_cycle_number := 1;
    end if;

    v_timezone := v_account.timezone;
    if not exists (select 1 from pg_timezone_names where name = v_timezone) then
      v_timezone := 'Asia/Tokyo';
    end if;

    v_first_end_date := (v_anchor_at at time zone v_timezone)::date + 7;
    v_first_end_at := v_first_end_date::timestamp at time zone v_timezone;

    if now() < v_first_end_at then
      v_cycle_number := v_anchor_cycle_number;
      v_starts_at := v_anchor_at;
      v_ends_at := v_first_end_at;
    else
      v_skip_cycles := greatest(
        0,
        floor(
          ((now() at time zone v_timezone)::date - v_first_end_date)::numeric / 7
        )::integer
      );
      v_cycle_number := v_anchor_cycle_number + 1 + v_skip_cycles;
      v_start_date := v_first_end_date + (v_skip_cycles * 7);
      v_starts_at := v_start_date::timestamp at time zone v_timezone;
      v_ends_at := (v_start_date + 7)::timestamp at time zone v_timezone;
    end if;

    v_day_starts := array[v_starts_at];
    v_start_date := (v_starts_at at time zone v_timezone)::date;
    for i in 1..7 loop
      v_day_starts := array_append(
        v_day_starts,
        (v_start_date + i)::timestamp at time zone v_timezone
      );
    end loop;

    insert into public.weekly_cycles (
      account_id,
      cycle_number,
      status,
      timezone_at_start,
      starts_at,
      ends_at,
      day_start_at
    ) values (
      p_account_id,
      v_cycle_number,
      'active',
      v_timezone,
      v_starts_at,
      v_ends_at,
      v_day_starts
    )
    on conflict (account_id, cycle_number) do update
      set status = case
            when public.weekly_cycles.ends_at > now() then 'active'
            else public.weekly_cycles.status
          end
    returning * into v_cycle;
  end if;

  for i in 1..7 loop
    if now() >= v_cycle.day_start_at[i]
       and now() < v_cycle.day_start_at[i + 1] then
      v_cycle_day := i;
      exit;
    end if;
  end loop;

  foreach v_facet in array v_facets loop
    select count(*)::integer
      into v_question_count
      from public.daily_question_bank
     where facet_id = v_facet
       and active_from <= now()
       and (active_to is null or active_to > now());

    if v_question_count = 0 then
      raise exception using errcode = 'P0001', message = 'daily_question_bank_incomplete';
    end if;

    v_question_offset := (
      mod(
        mod(
          hashtextextended(
            p_account_id::text || ':' || v_cycle.id::text || ':' || v_facet,
            0
          )::numeric,
          v_question_count
        ) + v_question_count,
        v_question_count
      )::integer + v_cycle_day - 1
    ) % v_question_count;

    select question_id
      into v_question_id
      from public.daily_question_bank
     where facet_id = v_facet
       and active_from <= now()
       and (active_to is null or active_to > now())
     order by question_id
     offset v_question_offset
     limit 1;

    v_question_ids := array_append(v_question_ids, v_question_id);
  end loop;

  insert into public.daily_checkins (
    account_id,
    cycle_id,
    cycle_day,
    local_date,
    question_ids
  ) values (
    p_account_id,
    v_cycle.id,
    v_cycle_day,
    (now() at time zone v_cycle.timezone_at_start)::date,
    v_question_ids
  )
  on conflict (account_id, cycle_id, cycle_day) do update
    set updated_at = now()
  returning * into v_checkin;

  select jsonb_agg(
           jsonb_build_object(
             'question_id', bank.question_id,
             'facet_id', bank.facet_id,
             'dimension', bank.dimension,
             'text', coalesce(local_text.text, ja_text.text),
             'logic_version', bank.question_logic_version
           )
           order by array_position(v_checkin.question_ids, bank.question_id)
         )
    into v_questions
    from public.daily_question_bank bank
    left join public.daily_question_texts local_text
      on local_text.question_id = bank.question_id
     and local_text.locale = v_account.locale
    left join public.daily_question_texts ja_text
      on ja_text.question_id = bank.question_id
     and ja_text.locale = 'ja-JP'
   where bank.question_id = any(v_checkin.question_ids);

  select jsonb_build_object(
           'daily_result_id', id,
           'thirty_two_type_id', thirty_two_type_id,
           'dimension_scores', dimension_scores,
           'minimum_boundary_distance', minimum_boundary_distance,
           'completed_at', completed_at
         )
    into v_result
    from public.daily_results
   where checkin_id = v_checkin.id;

  select count(*)::integer
    into v_completed_days
    from public.daily_checkins
   where account_id = p_account_id
     and cycle_id = v_cycle.id
     and status = 'completed';

  return jsonb_build_object(
    'checkin', jsonb_build_object(
      'id', v_checkin.id,
      'status', v_checkin.status,
      'mood', v_checkin.mood,
      'local_date', v_checkin.local_date,
      'started_at', v_checkin.started_at,
      'completed_at', v_checkin.completed_at
    ),
    'cycle', jsonb_build_object(
      'id', v_cycle.id,
      'cycle_number', v_cycle.cycle_number,
      'day_number', v_cycle_day,
      'completed_days', v_completed_days,
      'starts_at', v_cycle.starts_at,
      'ends_at', v_cycle.ends_at,
      'timezone', v_cycle.timezone_at_start
    ),
    'questions', coalesce(v_questions, '[]'::jsonb),
    'result', v_result
  );
end;
$$;

create or replace function public.prepare_alice_daily_answer()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  v_checkin public.daily_checkins%rowtype;
  v_question public.daily_question_bank%rowtype;
  v_corrected numeric;
begin
  if tg_op = 'UPDATE'
     and (new.checkin_id <> old.checkin_id or new.question_id <> old.question_id) then
    raise exception using errcode = 'P0001', message = 'daily_answer_identity_locked';
  end if;

  select *
    into v_checkin
    from public.daily_checkins
   where id = new.checkin_id;

  if not found
     or v_checkin.status <> 'in_progress'
     or not (new.question_id = any(v_checkin.question_ids)) then
    raise exception using errcode = 'P0001', message = 'daily_answer_not_allowed';
  end if;

  select *
    into v_question
    from public.daily_question_bank
   where question_id = new.question_id;

  if not found or new.answer not between 1 and 7 then
    raise exception using errcode = 'P0001', message = 'daily_answer_invalid';
  end if;

  v_corrected := case when v_question.reversed then 8 - new.answer else new.answer end;
  new.account_id := v_checkin.account_id;
  new.facet_id := v_question.facet_id;
  new.dimension := v_question.dimension;
  new.reversed := v_question.reversed;
  new.normalized_score := round(((v_corrected - 1) / 6) * 10, 4);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_daily_answers_prepare on public.daily_answers;
create trigger trg_daily_answers_prepare
before insert or update on public.daily_answers
for each row execute function public.prepare_alice_daily_answer();

create or replace function public.complete_alice_daily(
  p_account_id uuid,
  p_checkin_id uuid,
  p_mood text,
  p_answers jsonb,
  p_journal_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account public.accounts%rowtype;
  v_checkin public.daily_checkins%rowtype;
  v_cycle public.weekly_cycles%rowtype;
  v_existing_result public.daily_results%rowtype;
  v_result public.daily_results%rowtype;
  v_answer_count integer;
  v_distinct_count integer;
  v_invalid_count integer;
  v_facet_count integer;
  v_dimension_count integer;
  v_facet_scores jsonb;
  v_dimension_scores jsonb;
  v_boundary_distances jsonb;
  v_minimum_distance numeric;
  v_question_set_version text;
  v_type_key text;
  v_base_type text;
  v_type_id text;
  v_completed_days integer;
  v_journal text;
begin
  if p_mood not in ('clear', 'calm', 'mixed', 'hard') then
    raise exception using errcode = 'P0001', message = 'daily_mood_invalid';
  end if;

  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) <> 10 then
    raise exception using errcode = 'P0001', message = 'daily_answers_incomplete';
  end if;

  select *
    into v_account
    from public.accounts
   where id = p_account_id;

  if not found or v_account.active_base_profile_snapshot_id is null then
    raise exception using errcode = 'P0001', message = 'account_not_linked';
  end if;

  select *
    into v_checkin
    from public.daily_checkins
   where id = p_checkin_id
     and account_id = p_account_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'daily_checkin_not_found';
  end if;

  if v_checkin.status = 'completed' then
    select *
      into v_existing_result
      from public.daily_results
     where checkin_id = v_checkin.id;

    if not found then
      raise exception using errcode = 'P0001', message = 'daily_result_missing';
    end if;

    select count(*)::integer
      into v_completed_days
      from public.daily_checkins
     where account_id = p_account_id
       and cycle_id = v_checkin.cycle_id
       and status = 'completed';

    return jsonb_build_object(
      'checkin_id', v_checkin.id,
      'status', 'completed',
      'cycle_id', v_checkin.cycle_id,
      'cycle_day', v_checkin.cycle_day,
      'completed_days', v_completed_days,
      'result', jsonb_build_object(
        'daily_result_id', v_existing_result.id,
        'thirty_two_type_id', v_existing_result.thirty_two_type_id,
        'dimension_scores', v_existing_result.dimension_scores,
        'minimum_boundary_distance', v_existing_result.minimum_boundary_distance,
        'completed_at', v_existing_result.completed_at
      )
    );
  end if;

  select count(*)::integer,
         count(distinct answer.question_id)::integer,
         count(*) filter (
           where answer.question_id is null
              or answer.value is null
              or answer.value not between 1 and 7
              or not (answer.question_id = any(v_checkin.question_ids))
         )::integer
    into v_answer_count, v_distinct_count, v_invalid_count
    from jsonb_to_recordset(p_answers) as answer(question_id integer, value integer);

  if v_answer_count <> 10 or v_distinct_count <> 10 or v_invalid_count <> 0 then
    raise exception using errcode = 'P0001', message = 'daily_answers_invalid';
  end if;

  insert into public.daily_answers (
    checkin_id,
    account_id,
    question_id,
    facet_id,
    dimension,
    reversed,
    answer,
    normalized_score
  )
  select v_checkin.id,
         p_account_id,
         answer.question_id,
         bank.facet_id,
         bank.dimension,
         bank.reversed,
         answer.value,
         0
    from jsonb_to_recordset(p_answers) as answer(question_id integer, value integer)
    join public.daily_question_bank bank on bank.question_id = answer.question_id
  on conflict (checkin_id, question_id) do update
    set answer = excluded.answer,
        updated_at = now();

  select count(distinct facet_id)::integer,
         jsonb_object_agg(facet_id, score order by facet_id)
    into v_facet_count, v_facet_scores
    from (
      select facet_id, round(avg(normalized_score), 4) as score
        from public.daily_answers
       where checkin_id = v_checkin.id
       group by facet_id
    ) facet_aggregate;

  select count(*)::integer,
         jsonb_object_agg(dimension, score order by dimension)
    into v_dimension_count, v_dimension_scores
    from (
      select dimension, round(avg(normalized_score), 4) as score
        from public.daily_answers
       where checkin_id = v_checkin.id
       group by dimension
    ) dimension_aggregate;

  if v_facet_count <> 10 or v_dimension_count <> 5 then
    raise exception using errcode = 'P0001', message = 'daily_scoring_incomplete';
  end if;

  v_boundary_distances := jsonb_build_object(
    'E', round(abs((v_dimension_scores ->> 'E')::numeric - 5) / 5, 4),
    'A', round(abs((v_dimension_scores ->> 'A')::numeric - 5) / 5, 4),
    'O', round(abs((v_dimension_scores ->> 'O')::numeric - 5) / 5, 4),
    'C', round(abs((v_dimension_scores ->> 'C')::numeric - 5) / 5, 4),
    'N', round(abs((v_dimension_scores ->> 'N')::numeric - 5) / 5, 4)
  );
  v_minimum_distance := least(
    (v_boundary_distances ->> 'E')::numeric,
    (v_boundary_distances ->> 'A')::numeric,
    (v_boundary_distances ->> 'O')::numeric,
    (v_boundary_distances ->> 'C')::numeric,
    (v_boundary_distances ->> 'N')::numeric
  );

  v_type_key :=
    case when (v_dimension_scores ->> 'O')::numeric >= 5 then '+' else '-' end ||
    case when (v_dimension_scores ->> 'C')::numeric >= 5 then '+' else '-' end ||
    case when (v_dimension_scores ->> 'E')::numeric >= 5 then '+' else '-' end ||
    case when (v_dimension_scores ->> 'A')::numeric >= 5 then '+' else '-' end;

  v_base_type := case v_type_key
    when '++++' then 'sparkle-dolphin'
    when '+++-' then 'ambition-lion'
    when '++-+' then 'quiet-owl'
    when '++--' then 'seeker-wolf'
    when '+-++' then 'idea-monkey'
    when '+-+-' then 'whim-fox'
    when '+--+' then 'dreamer-rabbit'
    when '+---' then 'fantasy-cat'
    when '-+++' then 'caretaker-dog'
    when '-++-' then 'brisk-tiger'
    when '-+-+' then 'earnest-elephant'
    when '-+--' then 'steady-turtle'
    when '--++' then 'smiley-panda'
    when '--+-' then 'playful-raccoon'
    when '---+' then 'gentle-koala'
    else 'solo-hedgehog'
  end;
  v_type_id := v_base_type || case
    when (v_dimension_scores ->> 'N')::numeric >= 5 then '__N'
    else '__R'
  end;

  select string_agg(
           distinct bank.question_logic_version,
           ',' order by bank.question_logic_version
         )
    into v_question_set_version
    from public.daily_question_bank bank
   where bank.question_id = any(v_checkin.question_ids);

  select *
    into v_cycle
    from public.weekly_cycles
   where id = v_checkin.cycle_id;

  insert into public.daily_results (
    account_id,
    cycle_id,
    checkin_id,
    local_date,
    timezone_at_completion,
    facet_scores,
    dimension_scores,
    boundary_distances,
    minimum_boundary_distance,
    thirty_two_type_id,
    question_set_version,
    scoring_version,
    classification_version
  ) values (
    p_account_id,
    v_checkin.cycle_id,
    v_checkin.id,
    v_checkin.local_date,
    v_cycle.timezone_at_start,
    v_facet_scores,
    v_dimension_scores,
    v_boundary_distances,
    v_minimum_distance,
    v_type_id,
    coalesce(v_question_set_version, 'web-big-five-v1'),
    'alice-daily-big-five-v1',
    'classify-thirty-two-v1'
  )
  returning * into v_result;

  v_journal := nullif(btrim(coalesce(p_journal_body, '')), '');
  if v_journal is null then
    delete from public.journal_entries where checkin_id = v_checkin.id;
  else
    if char_length(v_journal) > 5000 then
      raise exception using errcode = 'P0001', message = 'journal_too_long';
    end if;

    insert into public.journal_entries (
      account_id,
      cycle_id,
      checkin_id,
      local_date,
      body
    ) values (
      p_account_id,
      v_checkin.cycle_id,
      v_checkin.id,
      v_checkin.local_date,
      v_journal
    )
    on conflict (checkin_id) do update
      set body = excluded.body,
          updated_at = now();
  end if;

  update public.daily_checkins
     set mood = p_mood,
         status = 'completed',
         completed_at = now(),
         updated_at = now()
   where id = v_checkin.id;

  select count(*)::integer
    into v_completed_days
    from public.daily_checkins
   where account_id = p_account_id
     and cycle_id = v_checkin.cycle_id
     and status = 'completed';

  return jsonb_build_object(
    'checkin_id', v_checkin.id,
    'status', 'completed',
    'cycle_id', v_checkin.cycle_id,
    'cycle_day', v_checkin.cycle_day,
    'completed_days', v_completed_days,
    'result', jsonb_build_object(
      'daily_result_id', v_result.id,
      'thirty_two_type_id', v_result.thirty_two_type_id,
      'dimension_scores', v_result.dimension_scores,
      'minimum_boundary_distance', v_result.minimum_boundary_distance,
      'completed_at', v_result.completed_at
    )
  );
end;
$$;

create or replace function public.touch_alice_mutable_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prepare_alice_journal_entry()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  v_checkin public.daily_checkins%rowtype;
begin
  if new.checkin_id is null then
    raise exception using errcode = 'P0001', message = 'journal_checkin_required';
  end if;

  if tg_op = 'UPDATE'
     and (
       new.account_id <> old.account_id
       or new.cycle_id <> old.cycle_id
       or new.checkin_id <> old.checkin_id
       or new.local_date <> old.local_date
     ) then
    raise exception using errcode = 'P0001', message = 'journal_identity_locked';
  end if;

  select *
    into v_checkin
    from public.daily_checkins
   where id = new.checkin_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'journal_not_allowed';
  end if;

  new.account_id := v_checkin.account_id;
  new.cycle_id := v_checkin.cycle_id;
  new.local_date := v_checkin.local_date;
  new.body := btrim(new.body);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_journal_entries_prepare on public.journal_entries;
create trigger trg_journal_entries_prepare
before insert or update on public.journal_entries
for each row execute function public.prepare_alice_journal_entry();

drop trigger if exists trg_daily_checkins_touch_updated_at on public.daily_checkins;
create trigger trg_daily_checkins_touch_updated_at
before update on public.daily_checkins
for each row execute function public.touch_alice_mutable_updated_at();

drop trigger if exists trg_journal_entries_touch_updated_at on public.journal_entries;
create trigger trg_journal_entries_touch_updated_at
before update on public.journal_entries
for each row execute function public.touch_alice_mutable_updated_at();

alter table public.weekly_cycles enable row level security;
alter table public.daily_question_bank enable row level security;
alter table public.daily_question_texts enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.daily_answers enable row level security;
alter table public.daily_results enable row level security;
alter table public.journal_entries enable row level security;
alter table public.weekly_reports enable row level security;

drop policy if exists "account owner can read cycles" on public.weekly_cycles;
create policy "account owner can read cycles"
  on public.weekly_cycles for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "authenticated can read daily question bank" on public.daily_question_bank;
create policy "authenticated can read daily question bank"
  on public.daily_question_bank for select to authenticated
  using (true);

drop policy if exists "authenticated can read daily question texts" on public.daily_question_texts;
create policy "authenticated can read daily question texts"
  on public.daily_question_texts for select to authenticated
  using (true);

drop policy if exists "account owner can read daily checkins" on public.daily_checkins;
create policy "account owner can read daily checkins"
  on public.daily_checkins for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can update daily checkin draft" on public.daily_checkins;
create policy "account owner can update daily checkin draft"
  on public.daily_checkins for update to authenticated
  using ((select auth.uid()) = account_id and status = 'in_progress')
  with check ((select auth.uid()) = account_id and status = 'in_progress');

drop policy if exists "account owner can read daily answers" on public.daily_answers;
create policy "account owner can read daily answers"
  on public.daily_answers for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can insert daily answer drafts" on public.daily_answers;
create policy "account owner can insert daily answer drafts"
  on public.daily_answers for insert to authenticated
  with check (
    (select auth.uid()) = account_id
    and exists (
      select 1
        from public.daily_checkins checkin
       where checkin.id = checkin_id
         and checkin.account_id = (select auth.uid())
         and checkin.status = 'in_progress'
    )
  );

drop policy if exists "account owner can update daily answer drafts" on public.daily_answers;
create policy "account owner can update daily answer drafts"
  on public.daily_answers for update to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id);

drop policy if exists "account owner can delete daily answer drafts" on public.daily_answers;
create policy "account owner can delete daily answer drafts"
  on public.daily_answers for delete to authenticated
  using (
    (select auth.uid()) = account_id
    and exists (
      select 1
        from public.daily_checkins checkin
       where checkin.id = checkin_id
         and checkin.status = 'in_progress'
    )
  );

drop policy if exists "account owner can read daily results" on public.daily_results;
create policy "account owner can read daily results"
  on public.daily_results for select to authenticated
  using ((select auth.uid()) = account_id);

drop policy if exists "account owner can manage journals" on public.journal_entries;
create policy "account owner can manage journals"
  on public.journal_entries for all to authenticated
  using ((select auth.uid()) = account_id)
  with check ((select auth.uid()) = account_id);

drop policy if exists "account owner can read weekly reports" on public.weekly_reports;
create policy "account owner can read weekly reports"
  on public.weekly_reports for select to authenticated
  using ((select auth.uid()) = account_id);

grant select on
  public.weekly_cycles,
  public.daily_question_bank,
  public.daily_question_texts,
  public.daily_checkins,
  public.daily_answers,
  public.daily_results,
  public.journal_entries,
  public.weekly_reports
to authenticated;

grant update (mood, updated_at) on public.daily_checkins to authenticated;
grant insert (checkin_id, question_id, answer) on public.daily_answers to authenticated;
grant update (checkin_id, question_id, answer) on public.daily_answers to authenticated;
grant delete on public.daily_answers to authenticated;
grant insert (account_id, cycle_id, checkin_id, local_date, body)
  on public.journal_entries to authenticated;
grant update (account_id, cycle_id, checkin_id, local_date, body, updated_at)
  on public.journal_entries to authenticated;
grant delete on public.journal_entries to authenticated;

revoke all on function public.start_alice_daily(uuid) from public, anon, authenticated;
revoke all on function public.complete_alice_daily(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.start_alice_daily(uuid) to service_role;
grant execute on function public.complete_alice_daily(uuid, uuid, text, jsonb, text)
  to service_role;

commit;
